import type { UiElement, UiLayout, UiSchema, UiStyle } from '../schemas/generated.js';
import type { CodegenIssue, CodegenOptions, CodegenResult } from './types.js';

// ---------------------------------------------------------------------------
// Token + layout helpers (mirrors tree-renderer.ts logic in React style format)
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

type StyleObj = Record<string, string>;

function resolveLayoutStyles(layout?: UiLayout): StyleObj {
  if (!layout?.type) return {};
  const s: StyleObj = {};

  switch (layout.type) {
    case 'stack':
      s.display = 'flex';
      s.flexDirection = 'column';
      break;
    case 'inline':
      s.display = 'flex';
      s.flexDirection = 'row';
      break;
    case 'grid':
      s.display = 'grid';
      s.gridTemplateColumns = 'repeat(auto-fit, minmax(0, 1fr))';
      break;
    case 'sidebar':
      s.display = 'grid';
      s.gridTemplateColumns = 'minmax(0, 1fr) minmax(16rem, 24rem)';
      s.alignItems = 'start';
      break;
    case 'section':
      s.display = 'block';
      break;
  }

  if (layout.align) {
    const value = ALIGN_MAP[layout.align];
    if (layout.type === 'stack' || layout.type === 'inline') {
      s.alignItems = value;
    } else {
      s.justifyContent = value;
    }
  }

  if (layout.gapToken) {
    s.gap = tokenVar('spacing', layout.gapToken);
  }

  return s;
}

function resolveStyleTokens(style?: UiStyle): StyleObj {
  if (!style) return {};
  const s: StyleObj = {};
  if (style.spacingToken) s.padding = tokenVar('spacing', style.spacingToken);
  if (style.radiusToken) s.borderRadius = tokenVar('radius', style.radiusToken);
  if (style.shadowToken) s.boxShadow = tokenVar('shadow', style.shadowToken);
  if (style.colorToken) s.color = tokenVar('color', style.colorToken);
  if (style.typographyToken) s.font = tokenVar('typography', style.typographyToken);
  return s;
}

function mergeStyleObjects(layout: StyleObj, tokens: StyleObj): StyleObj {
  return { ...layout, ...tokens };
}

// ---------------------------------------------------------------------------
// JSX string helpers
// ---------------------------------------------------------------------------

function indent(code: string, depth: number): string {
  const pad = '  '.repeat(depth);
  return code
    .split('\n')
    .map((line) => (line.trim() ? `${pad}${line}` : ''))
    .join('\n');
}

function styleObjToJsx(style: StyleObj): string {
  if (Object.keys(style).length === 0) return '';
  const entries = Object.entries(style)
    .map(([key, value]) => `${key}: '${value}'`)
    .join(', ');
  return `{{ ${entries} }}`;
}

function isReservedProp(key: string): boolean {
  return key === 'children' || key === 'style';
}

function jsonValueToJsx(value: unknown): string {
  if (value === null) return '{null}';
  if (value === undefined) return '{undefined}';
  if (typeof value === 'string') return `"${value.replace(/"/g, '\\"')}"`;
  if (typeof value === 'boolean') return value ? '' : `{${String(value)}}`;
  if (typeof value === 'number') return `{${String(value)}}`;
  return `{${JSON.stringify(value)}}`;
}

function boolAttr(key: string, value: unknown): string {
  if (value === true) return key;
  if (value === false) return `${key}={false}`;
  return `${key}=${jsonValueToJsx(value)}`;
}

function propsToJsxAttrs(props: Record<string, unknown>): string {
  const parts: string[] = [];
  for (const [key, value] of Object.entries(props)) {
    if (isReservedProp(key) || value === undefined) continue;
    if (typeof value === 'boolean') {
      parts.push(boolAttr(key, value));
    } else {
      parts.push(`${key}=${jsonValueToJsx(value)}`);
    }
  }
  return parts.join(' ');
}

// ---------------------------------------------------------------------------
// JSX tree emitter
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

function emitNode(node: UiElement, depth: number, warnings: CodegenIssue[]): string {
  const tag = node.component;
  const computedStyle = mergeStyleObjects(
    resolveLayoutStyles(node.layout),
    resolveStyleTokens(node.style),
  );

  // Build attributes list
  const attrParts: string[] = [];

  // id is always passed
  attrParts.push(`id="${node.id}"`);

  // data-oods-component for runtime identification
  attrParts.push(`data-oods-component="${tag}"`);

  // layout data attribute
  if (node.layout?.type) {
    attrParts.push(`data-layout="${node.layout.type}"`);
  }

  // Spread user props (except style and children)
  if (node.props && typeof node.props === 'object') {
    const propsStr = propsToJsxAttrs(node.props as Record<string, unknown>);
    if (propsStr) attrParts.push(propsStr);
  }

  // Merged style attribute
  if (Object.keys(computedStyle).length > 0) {
    attrParts.push(`style={${styleObjToJsx(computedStyle)}}`);
  }

  const attrs = attrParts.length > 0 ? ` ${attrParts.join(' ')}` : '';

  // Children
  const children = Array.isArray(node.children) ? node.children : [];

  // Sidebar layout needs wrapper elements
  if (node.layout?.type === 'sidebar' && children.length > 0) {
    const [mainChild, ...asideChildren] = children;
    const mainJsx = mainChild ? emitNode(mainChild, depth + 2, warnings) : '';
    const asideJsxParts = asideChildren.map((c) => emitNode(c, depth + 2, warnings));

    const inner = [
      `<div data-sidebar-main>`,
      mainJsx ? indent(mainJsx, 1) : '',
      `</div>`,
      `<aside data-sidebar-aside>`,
      ...asideJsxParts.map((jsx) => indent(jsx, 1)),
      `</aside>`,
    ]
      .filter(Boolean)
      .join('\n');

    return `<${tag}${attrs}>\n${indent(inner, depth + 1)}\n${'  '.repeat(depth)}</${tag}>`;
  }

  // Section layout wraps in a section element
  if (node.layout?.type === 'section') {
    const innerJsx = children.map((c) => emitNode(c, depth + 2, warnings)).join('\n');
    const sectionStyle = Object.keys(computedStyle).length > 0 ? ` style={${styleObjToJsx(computedStyle)}}` : '';

    // Section wraps the component output
    const sectionOpen = `<section data-layout="section" data-layout-node-id="${node.id}"${sectionStyle}>`;
    const componentOpen = `<${tag} id="${node.id}" data-oods-component="${tag}"`;

    // Props for inner component (without layout style — that's on section)
    const innerAttrParts: string[] = [];
    if (node.props && typeof node.props === 'object') {
      const propsStr = propsToJsxAttrs(node.props as Record<string, unknown>);
      if (propsStr) innerAttrParts.push(propsStr);
    }
    const innerAttrs = innerAttrParts.length > 0 ? ` ${innerAttrParts.join(' ')}` : '';

    if (children.length === 0) {
      return `${sectionOpen}\n${indent(`${componentOpen}${innerAttrs} />`, 1)}\n${'  '.repeat(depth)}</section>`;
    }

    return [
      sectionOpen,
      indent(`${componentOpen}${innerAttrs}>`, 1),
      indent(innerJsx, 0),
      indent(`</${tag}>`, 1),
      `${'  '.repeat(depth)}</section>`,
    ].join('\n');
  }

  // Self-closing if no children
  if (children.length === 0) {
    return `<${tag}${attrs} />`;
  }

  const childrenJsx = children.map((c) => emitNode(c, depth + 1, warnings)).join('\n');
  return `<${tag}${attrs}>\n${indent(childrenJsx, depth + 1)}\n${'  '.repeat(depth)}</${tag}>`;
}

// ---------------------------------------------------------------------------
// TypeScript prop type generation
// ---------------------------------------------------------------------------

function generatePropTypes(components: Set<string>): string {
  const types = Array.from(components)
    .sort()
    .map((name) => `type ${name}Props = React.ComponentPropsWithoutRef<typeof ${name}>;`)
    .join('\n');
  return types;
}

// ---------------------------------------------------------------------------
// Top-level code assembly
// ---------------------------------------------------------------------------

function buildImportBlock(components: Set<string>): string {
  const sorted = Array.from(components).sort();
  const lines: string[] = [
    `import React from 'react';`,
    `import { ${sorted.join(', ')} } from '@oods/components';`,
  ];
  return lines.join('\n');
}

function buildImportList(_components: Set<string>): string[] {
  return ['react', '@oods/components'];
}

/**
 * React/TSX emitter — generates importable React component code from a UiSchema.
 */
export function emit(schema: UiSchema, options: CodegenOptions): CodegenResult {
  const warnings: CodegenIssue[] = [];
  const components = collectComponents(schema.screens);

  // Generate JSX for each screen
  const screenJsx = schema.screens
    .map((screen) => emitNode(screen, 2, warnings))
    .join('\n');

  // Build the complete file
  const importBlock = buildImportBlock(components);
  const imports = buildImportList(components);

  const typeAnnotations = options.typescript ? generatePropTypes(components) : '';
  const returnType = options.typescript ? ': React.FC' : '';

  const lines: string[] = [
    importBlock,
    '',
  ];

  if (typeAnnotations) {
    lines.push(typeAnnotations, '');
  }

  lines.push(
    `export const GeneratedUI${returnType} = () => {`,
    `  return (`,
    `    <>`,
    indent(screenJsx, 3),
    `    </>`,
    `  );`,
    `};`,
    '',
  );

  const code = lines.join('\n');

  return {
    status: 'ok',
    framework: 'react',
    code,
    fileExtension: options.typescript ? '.tsx' : '.jsx',
    imports,
    warnings,
  };
}
