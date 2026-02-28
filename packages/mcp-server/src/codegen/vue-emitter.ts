import type { UiElement, UiLayout, UiSchema, UiStyle } from '../schemas/generated.js';
import type { CodegenIssue, CodegenOptions, CodegenResult } from './types.js';

// ---------------------------------------------------------------------------
// Token + layout helpers (shared logic with tree-renderer.ts / react-emitter.ts)
// ---------------------------------------------------------------------------

function normalizeToken(token: string): string {
  return token.trim().replace(/[.\s_]+/g, '-');
}

function tokenVar(group: string, token: string): string {
  return `var(--ref-${group}-${normalizeToken(token)})`;
}

const ALIGN_MAP: Record<NonNullable<UiLayout['align']>, string> = {
  start: 'flex-start',
  center: 'center',
  end: 'flex-end',
  'space-between': 'space-between',
};

type CssDecl = Record<string, string>;

function resolveLayoutStyles(layout?: UiLayout): CssDecl {
  if (!layout?.type) return {};
  const s: CssDecl = {};

  switch (layout.type) {
    case 'stack':
      s.display = 'flex';
      s['flex-direction'] = 'column';
      break;
    case 'inline':
      s.display = 'flex';
      s['flex-direction'] = 'row';
      break;
    case 'grid':
      s.display = 'grid';
      s['grid-template-columns'] = 'repeat(auto-fit, minmax(0, 1fr))';
      break;
    case 'sidebar':
      s.display = 'grid';
      s['grid-template-columns'] = 'minmax(0, 1fr) minmax(16rem, 24rem)';
      s['align-items'] = 'start';
      break;
    case 'section':
      s.display = 'block';
      break;
  }

  if (layout.align) {
    const value = ALIGN_MAP[layout.align];
    if (layout.type === 'stack' || layout.type === 'inline') {
      s['align-items'] = value;
    } else {
      s['justify-content'] = value;
    }
  }

  if (layout.gapToken) {
    s.gap = tokenVar('spacing', layout.gapToken);
  }

  return s;
}

function resolveStyleTokens(style?: UiStyle): CssDecl {
  if (!style) return {};
  const s: CssDecl = {};
  if (style.spacingToken) s.padding = tokenVar('spacing', style.spacingToken);
  if (style.radiusToken) s['border-radius'] = tokenVar('radius', style.radiusToken);
  if (style.shadowToken) s['box-shadow'] = tokenVar('shadow', style.shadowToken);
  if (style.colorToken) s.color = tokenVar('color', style.colorToken);
  if (style.typographyToken) s.font = tokenVar('typography', style.typographyToken);
  return s;
}

function mergeDecl(layout: CssDecl, tokens: CssDecl): CssDecl {
  return { ...layout, ...tokens };
}

function declToInlineStyle(decl: CssDecl): string {
  return Object.entries(decl)
    .map(([prop, val]) => `${prop}: ${val}`)
    .join('; ');
}

// ---------------------------------------------------------------------------
// Template helpers
// ---------------------------------------------------------------------------

function ind(code: string, depth: number): string {
  const pad = '  '.repeat(depth);
  return code
    .split('\n')
    .map((line) => (line.trim() ? `${pad}${line}` : ''))
    .join('\n');
}

function isReservedProp(key: string): boolean {
  return key === 'children' || key === 'style';
}

function propToVueAttr(key: string, value: unknown): string {
  if (value === undefined) return '';
  if (typeof value === 'string') return `${key}="${value.replace(/"/g, '&quot;')}"`;
  if (typeof value === 'boolean') return value ? key : `:${key}="false"`;
  if (typeof value === 'number') return `:${key}="${value}"`;
  // Arrays and objects use v-bind with JSON
  return `:${key}="${JSON.stringify(value).replace(/"/g, "'")}"`;
}

function propsToVueAttrs(props: Record<string, unknown>): string {
  const parts: string[] = [];
  for (const [key, value] of Object.entries(props)) {
    if (isReservedProp(key) || value === undefined) continue;
    const attr = propToVueAttr(key, value);
    if (attr) parts.push(attr);
  }
  return parts.join(' ');
}

// ---------------------------------------------------------------------------
// Collect unique component names
// ---------------------------------------------------------------------------

function collectComponents(screens: UiElement[]): Set<string> {
  const names = new Set<string>();
  const stack = [...screens];
  while (stack.length > 0) {
    const node = stack.pop()!;
    names.add(node.component);
    if (node.children) stack.push(...node.children);
  }
  return names;
}

// ---------------------------------------------------------------------------
// Template tree emitter
// ---------------------------------------------------------------------------

function emitTemplateNode(node: UiElement, depth: number, warnings: CodegenIssue[]): string {
  const tag = node.component;
  const computedStyle = mergeDecl(
    resolveLayoutStyles(node.layout),
    resolveStyleTokens(node.style),
  );

  // Build attributes
  const attrParts: string[] = [];
  attrParts.push(`id="${node.id}"`);
  attrParts.push(`data-oods-component="${tag}"`);

  if (node.layout?.type) {
    attrParts.push(`data-layout="${node.layout.type}"`);
  }

  if (node.props && typeof node.props === 'object') {
    const propsStr = propsToVueAttrs(node.props as Record<string, unknown>);
    if (propsStr) attrParts.push(propsStr);
  }

  const inlineStyle = declToInlineStyle(computedStyle);
  if (inlineStyle) {
    attrParts.push(`style="${inlineStyle}"`);
  }

  const attrs = attrParts.length > 0 ? ` ${attrParts.join(' ')}` : '';
  const children = Array.isArray(node.children) ? node.children : [];

  // Sidebar layout
  if (node.layout?.type === 'sidebar' && children.length > 0) {
    const [mainChild, ...asideChildren] = children;
    const mainTemplate = mainChild ? emitTemplateNode(mainChild, depth + 2, warnings) : '';
    const asideTemplates = asideChildren.map((c) => emitTemplateNode(c, depth + 2, warnings));

    const inner = [
      `<div data-sidebar-main>`,
      mainTemplate ? ind(mainTemplate, 1) : '',
      `</div>`,
      `<aside data-sidebar-aside>`,
      ...asideTemplates.map((t) => ind(t, 1)),
      `</aside>`,
    ]
      .filter(Boolean)
      .join('\n');

    return `<${tag}${attrs}>\n${ind(inner, depth + 1)}\n${'  '.repeat(depth)}</${tag}>`;
  }

  // Section layout
  if (node.layout?.type === 'section') {
    const sectionStyle = inlineStyle ? ` style="${inlineStyle}"` : '';
    const innerChildren = children.map((c) => emitTemplateNode(c, depth + 2, warnings)).join('\n');

    const innerAttrParts: string[] = [`id="${node.id}"`, `data-oods-component="${tag}"`];
    if (node.props && typeof node.props === 'object') {
      const propsStr = propsToVueAttrs(node.props as Record<string, unknown>);
      if (propsStr) innerAttrParts.push(propsStr);
    }
    const innerAttrs = ` ${innerAttrParts.join(' ')}`;

    if (children.length === 0) {
      return `<section data-layout="section" data-layout-node-id="${node.id}"${sectionStyle}>\n${ind(`<${tag}${innerAttrs} />`, depth + 1)}\n${'  '.repeat(depth)}</section>`;
    }

    return [
      `<section data-layout="section" data-layout-node-id="${node.id}"${sectionStyle}>`,
      ind(`<${tag}${innerAttrs}>`, depth + 1),
      ind(innerChildren, 0),
      ind(`</${tag}>`, depth + 1),
      `${'  '.repeat(depth)}</section>`,
    ].join('\n');
  }

  // Self-closing
  if (children.length === 0) {
    return `<${tag}${attrs} />`;
  }

  const childrenTemplate = children.map((c) => emitTemplateNode(c, depth + 1, warnings)).join('\n');
  return `<${tag}${attrs}>\n${ind(childrenTemplate, depth + 1)}\n${'  '.repeat(depth)}</${tag}>`;
}

// ---------------------------------------------------------------------------
// Script setup block
// ---------------------------------------------------------------------------

function buildScriptSetup(components: Set<string>, options: CodegenOptions): string {
  const sorted = Array.from(components).sort();
  const lines: string[] = [];

  if (options.typescript) {
    lines.push(`<script setup lang="ts">`);
  } else {
    lines.push(`<script setup>`);
  }

  lines.push(`import { ${sorted.join(', ')} } from '@oods/components';`);

  if (options.typescript) {
    lines.push('');
    lines.push(`defineProps<{`);
    lines.push(`  // Props can be extended here`);
    lines.push(`}>();`);
  }

  lines.push(`</script>`);
  return lines.join('\n');
}

// ---------------------------------------------------------------------------
// Scoped style block (token CSS variables)
// ---------------------------------------------------------------------------

function collectTokenStyles(screens: UiElement[]): CssDecl[] {
  const styles: CssDecl[] = [];
  const stack = [...screens];
  while (stack.length > 0) {
    const node = stack.pop()!;
    const decl = mergeDecl(resolveLayoutStyles(node.layout), resolveStyleTokens(node.style));
    if (Object.keys(decl).length > 0) {
      styles.push(decl);
    }
    if (node.children) stack.push(...node.children);
  }
  return styles;
}

function buildScopedStyle(screens: UiElement[], options: CodegenOptions): string | null {
  if (options.styling !== 'tokens') return null;

  const allStyles = collectTokenStyles(screens);
  // Only include a style block if there are token references
  const hasTokenRefs = allStyles.some((decl) =>
    Object.values(decl).some((v) => v.includes('var(--ref-')),
  );

  if (!hasTokenRefs) return null;

  const lines = [
    `<style scoped>`,
    `/* Token CSS variables are consumed via inline styles. */`,
    `/* Add component-scoped overrides here as needed. */`,
    `</style>`,
  ];
  return lines.join('\n');
}

// ---------------------------------------------------------------------------
// Top-level assembly
// ---------------------------------------------------------------------------

/**
 * Vue 3 SFC emitter — generates a Vue Single File Component from a UiSchema.
 */
export function emit(schema: UiSchema, options: CodegenOptions): CodegenResult {
  const warnings: CodegenIssue[] = [];
  const components = collectComponents(schema.screens);

  // Build template block
  const screenTemplates = schema.screens
    .map((screen) => emitTemplateNode(screen, 1, warnings))
    .join('\n');

  const templateBlock = [
    `<template>`,
    ind(screenTemplates, 1),
    `</template>`,
  ].join('\n');

  // Build script setup block
  const scriptBlock = buildScriptSetup(components, options);

  // Build optional scoped style block
  const styleBlock = buildScopedStyle(schema.screens, options);

  // Assemble SFC
  const blocks = [templateBlock, '', scriptBlock];
  if (styleBlock) {
    blocks.push('', styleBlock);
  }
  blocks.push('');

  const code = blocks.join('\n');

  return {
    status: 'ok',
    framework: 'vue',
    code,
    fileExtension: '.vue',
    imports: ['@oods/components'],
    warnings,
  };
}
