import type { UiElement, UiLayout, UiSchema, UiStyle, FieldSchemaEntry } from '../schemas/generated.js';
import type { CodegenIssue, CodegenOptions, CodegenResult } from './types.js';
import type { HandlerSignatureMap } from './binding-utils.js';
import {
  buildTailwindStaticClasses,
  buildTailwindVariantExpression,
  collectTailwindVariantDefinitions,
  type TailwindVariantDefinition,
} from './tailwind-codegen-utils.js';
import {
  mapFieldType,
  snakeToCamel,
  collectBindings,
  generateHandlerStubs,
  collectPropDefaults,
  resolveChildContent,
} from './binding-utils.js';

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
    if (layout.type === 'stack') {
      s.alignItems = value;
    } else if (layout.type === 'inline') {
      s.justifyContent = value;
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
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([key, value]) => `${key}: '${value}'`)
    .join(', ');
  return `{ ${entries} }`;
}

function isReservedProp(key: string, omitClassProps = false): boolean {
  if (key === 'children' || key === 'style') return true;
  if (omitClassProps && (key === 'className' || key === 'class')) return true;
  return false;
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

function propsToJsxAttrs(props: Record<string, unknown>, omitClassProps = false): string {
  const parts: string[] = [];
  for (const [key, value] of Object.entries(props).sort(([a], [b]) => a.localeCompare(b))) {
    if (isReservedProp(key, omitClassProps) || value === undefined) continue;
    if (typeof value === 'boolean') {
      parts.push(boolAttr(key, value));
    } else {
      parts.push(`${key}=${jsonValueToJsx(value)}`);
    }
  }
  return parts.join(' ');
}

function escapeDoubleQuotedAttr(value: string): string {
  return value.replace(/"/g, '\\"');
}

function escapeSingleQuotedExpr(value: string): string {
  return value.replace(/\\/g, '\\\\').replace(/'/g, "\\'");
}

function buildReactClassAttr(staticClasses: string, variantExpression: string | null): string | null {
  const hasStatic = staticClasses.trim().length > 0;

  if (variantExpression && hasStatic) {
    return `className={[${variantExpression}, '${escapeSingleQuotedExpr(staticClasses)}'].filter(Boolean).join(' ')}`;
  }
  if (variantExpression) {
    return `className={${variantExpression}}`;
  }
  if (hasStatic) {
    return `className="${escapeDoubleQuotedAttr(staticClasses)}"`;
  }
  return null;
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

function emitNode(
  node: UiElement,
  depth: number,
  warnings: CodegenIssue[],
  options: CodegenOptions,
  tailwindVariants: Map<string, TailwindVariantDefinition>,
  objectSchema?: Record<string, FieldSchemaEntry>,
): string {
  const tag = node.component;
  const computedStyle = mergeStyleObjects(
    resolveLayoutStyles(node.layout),
    resolveStyleTokens(node.style),
  );
  const propsObject = node.props && typeof node.props === 'object'
    ? (node.props as Record<string, unknown>)
    : null;
  const tailwindVariant = tailwindVariants.get(tag);

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
  if (propsObject) {
    const propsStr = propsToJsxAttrs(propsObject, options.styling === 'tailwind');
    if (propsStr) attrParts.push(propsStr);
  }

  // Event bindings (e.g., onSubmit={handleSubmit})
  if (node.bindings && typeof node.bindings === 'object') {
    for (const [eventKey, handlerName] of Object.entries(node.bindings).sort(([a], [b]) => a.localeCompare(b))) {
      attrParts.push(`${eventKey}={${handlerName}}`);
    }
  }

  if (options.styling === 'tailwind') {
    const variantExpression = buildTailwindVariantExpression(node, tailwindVariant);
    const staticClasses = buildTailwindStaticClasses(node, computedStyle, {
      includeVariantFallback: !tailwindVariant,
    });
    const classAttr = buildReactClassAttr(staticClasses, variantExpression);
    if (classAttr) attrParts.push(classAttr);
  } else if (Object.keys(computedStyle).length > 0) {
    // Merged style attribute
    attrParts.push(`style={${styleObjToJsx(computedStyle)}}`);
  }

  const attrs = attrParts.length > 0 ? ` ${attrParts.join(' ')}` : '';

  // Children
  const children = Array.isArray(node.children) ? node.children : [];

  // Sidebar layout needs wrapper elements
  if (node.layout?.type === 'sidebar' && children.length > 0) {
    const [mainChild, ...asideChildren] = children;
    const mainJsx = mainChild ? emitNode(mainChild, depth + 2, warnings, options, tailwindVariants, objectSchema) : '';
    const asideJsxParts = asideChildren.map((c) => emitNode(c, depth + 2, warnings, options, tailwindVariants, objectSchema));

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
    const innerJsx = children.map((c) => emitNode(c, depth + 2, warnings, options, tailwindVariants, objectSchema)).join('\n');
    let sectionClassOrStyle = '';
    if (options.styling === 'tailwind') {
      const sectionClasses = buildTailwindStaticClasses(node, computedStyle, {
        includeUserClass: false,
        includeInteractiveStates: false,
        includeVariantFallback: false,
      });
      if (sectionClasses) {
        sectionClassOrStyle = ` className="${escapeDoubleQuotedAttr(sectionClasses)}"`;
      }
    } else if (Object.keys(computedStyle).length > 0) {
      sectionClassOrStyle = ` style={${styleObjToJsx(computedStyle)}}`;
    }

    // Section wraps the component output
    const sectionOpen = `<section data-layout="section" data-layout-node-id="${node.id}"${sectionClassOrStyle}>`;
    const componentOpen = `<${tag} id="${node.id}" data-oods-component="${tag}"`;

    // Props for inner component (without layout style — that's on section)
    const innerAttrParts: string[] = [];
    if (propsObject) {
      const propsStr = propsToJsxAttrs(propsObject, options.styling === 'tailwind');
      if (propsStr) innerAttrParts.push(propsStr);
    }
    if (options.styling === 'tailwind') {
      const variantExpression = buildTailwindVariantExpression(node, tailwindVariant);
      const staticClasses = buildTailwindStaticClasses(node, {}, {
        includeVariantFallback: !tailwindVariant,
      });
      const classAttr = buildReactClassAttr(staticClasses, variantExpression);
      if (classAttr) innerAttrParts.push(classAttr);
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

  // Self-closing if no children — but inject field content if bound
  if (children.length === 0) {
    const fieldContent = resolveChildContent(node, objectSchema);
    if (fieldContent) {
      if (fieldContent.isChildren) {
        return `<${tag}${attrs}>{${fieldContent.fieldName}}</${tag}>`;
      }
      // Prop-based injection: add prop to attrs
      const propAttr = `${fieldContent.propName}={${fieldContent.fieldName}}`;
      return `<${tag}${attrs} ${propAttr} />`;
    }
    return `<${tag}${attrs} />`;
  }

  const childrenJsx = children.map((c) => emitNode(c, depth + 1, warnings, options, tailwindVariants, objectSchema)).join('\n');
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
// Object schema → TypeScript type mapping (delegates to binding-utils)
// ---------------------------------------------------------------------------

/**
 * Generate a typed PageProps interface from the UiSchema's objectSchema.
 * Required fields are non-optional; optional fields use `?`.
 */
function generatePagePropsInterface(
  objectSchema: Record<string, FieldSchemaEntry>,
): string {
  const lines: string[] = ['export interface PageProps {'];

  for (const [fieldName, entry] of Object.entries(objectSchema).sort(([a], [b]) => a.localeCompare(b))) {
    const tsType = mapFieldType(entry);
    const optional = entry.required ? '' : '?';
    const camelName = snakeToCamel(fieldName);

    if (entry.description) {
      lines.push(`  /** ${entry.description} */`);
    }
    lines.push(`  ${camelName}${optional}: ${tsType};`);
  }

  lines.push('}');
  return lines.join('\n');
}

// ---------------------------------------------------------------------------
// React-specific handler signatures (delegates to shared generateHandlerStubs)
// ---------------------------------------------------------------------------

const REACT_HANDLER_SIGNATURES: HandlerSignatureMap = {
  onSubmit:   { params: '(e)',        tsParams: '(e: React.FormEvent)' },
  onChange:   { params: '(value)',     tsParams: '(value: unknown)' },
  onRowClick: { params: '(row)',      tsParams: '(row: Record<string, unknown>)' },
  onSort:     { params: '(column)',   tsParams: '(column: string)' },
  onFilter:   { params: '(criteria)', tsParams: '(criteria: Record<string, unknown>)' },
  onEdit:     { params: '()',         tsParams: '()' },
  onDelete:   { params: '()',         tsParams: '()' },
};

// ---------------------------------------------------------------------------
// Top-level code assembly
// ---------------------------------------------------------------------------

function buildImportBlock(components: Set<string>, includeCva: boolean): string {
  const sorted = Array.from(components).sort();
  const lines: string[] = [
    `import React from 'react';`,
    `import { ${sorted.join(', ')} } from '@oods/components';`,
  ];
  if (includeCva) {
    lines.push(`import { cva } from 'class-variance-authority';`);
  }
  return lines.join('\n');
}

function buildImportList(_components: Set<string>, includeCva: boolean): string[] {
  return includeCva
    ? ['react', '@oods/components', 'class-variance-authority']
    : ['react', '@oods/components'];
}

/**
 * React/TSX emitter — generates importable React component code from a UiSchema.
 */
export function emit(schema: UiSchema, options: CodegenOptions): CodegenResult {
  const warnings: CodegenIssue[] = [];
  const components = collectComponents(schema.screens);
  const tailwindVariants = options.styling === 'tailwind'
    ? collectTailwindVariantDefinitions(schema.screens)
    : new Map<string, TailwindVariantDefinition>();

  // Generate JSX for each screen
  const screenJsx = schema.screens
    .map((screen) => emitNode(screen, 2, warnings, options, tailwindVariants, schema.objectSchema))
    .join('\n');

  // Build the complete file
  const importBlock = buildImportBlock(components, tailwindVariants.size > 0);
  const imports = buildImportList(components, tailwindVariants.size > 0);

  const typeAnnotations = options.typescript ? generatePropTypes(components) : '';
  const hasObjectSchema = schema.objectSchema && Object.keys(schema.objectSchema).length > 0;
  const pagePropsInterface = options.typescript && hasObjectSchema
    ? generatePagePropsInterface(schema.objectSchema!)
    : '';
  const returnType = options.typescript
    ? (hasObjectSchema ? ': React.FC<PageProps>' : ': React.FC')
    : '';

  const lines: string[] = [
    importBlock,
    '',
  ];

  // Emit token overrides as CSS variable declarations comment
  if (schema.tokenOverrides && Object.keys(schema.tokenOverrides).length > 0) {
    lines.push('/**');
    lines.push(' * Object-level token overrides (apply via CSS custom properties):');
    for (const [key, value] of Object.entries(schema.tokenOverrides).sort(([a], [b]) => a.localeCompare(b))) {
      const varName = `--token-${key.replace(/[.\s_]+/g, '-')}`;
      lines.push(` *   ${varName}: ${value};`);
    }
    lines.push(' */');
    lines.push('');
  }

  // Emit PageProps interface when objectSchema is present
  if (pagePropsInterface) {
    lines.push(pagePropsInterface, '');
  }

  if (typeAnnotations) {
    lines.push(typeAnnotations, '');
  }

  // Collect and generate handler stubs from bindings
  const handlers = collectBindings(schema.screens);
  const handlerStubs = generateHandlerStubs(handlers, options.typescript, REACT_HANDLER_SIGNATURES, '  ');

  // Collect prop defaults from objectSchema field values on elements
  const propDefaults = hasObjectSchema
    ? collectPropDefaults(schema.screens, schema.objectSchema!)
    : null;

  lines.push(`export const GeneratedUI${returnType} = () => {`);

  if (handlerStubs) {
    lines.push(handlerStubs);
    lines.push('');
  }

  // Emit prop default declarations from objectSchema field values
  if (propDefaults && propDefaults.size > 0) {
    for (const [propName, { formatted, isExpression }] of propDefaults) {
      const rhs = isExpression ? formatted : `'${formatted.replace(/'/g, "\\'")}'`;
      lines.push(`  const ${propName} = ${rhs};`);
    }
    lines.push('');
  }

  if (tailwindVariants.size > 0) {
    const sortedDefinitions = Array.from(tailwindVariants.values())
      .sort((a, b) => a.variableName.localeCompare(b.variableName));
    for (const { definition } of sortedDefinitions) {
      lines.push(indent(definition, 1));
    }
    lines.push('');
  }

  lines.push(
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
