import type { UiElement, UiLayout, UiSchema, UiStyle, FieldSchemaEntry } from '../schemas/generated.js';
import type { CodegenIssue, CodegenOptions, CodegenResult } from './types.js';
import type { HandlerSignatureMap } from './binding-utils.js';
import {
  buildTailwindStaticClasses,
  buildTailwindVariantExpression,
  collectTailwindVariantDefinitions,
  responsiveLayoutClasses,
  type TailwindVariantDefinition,
} from './tailwind-codegen-utils.js';
import {
  mapFieldType,
  snakeToCamel,
  collectBindings,
  generateHandlerStubs,
  collectPropDefaults,
  resolveChildContent,
  resolveFieldProps,
} from './binding-utils.js';

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
    if (layout.type === 'stack') {
      s['align-items'] = value;
    } else if (layout.type === 'inline') {
      s['justify-content'] = value;
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
    .sort(([a], [b]) => a.localeCompare(b))
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

function isReservedProp(key: string, omitClassProps = false): boolean {
  if (key === 'children' || key === 'style') return true;
  if (omitClassProps && key === 'class') return true;
  return false;
}

function propToVueAttr(key: string, value: unknown): string {
  if (value === undefined) return '';
  if (typeof value === 'string') return `${key}="${value.replace(/"/g, '&quot;')}"`;
  if (typeof value === 'boolean') return value ? key : `:${key}="false"`;
  if (typeof value === 'number') return `:${key}="${value}"`;
  // Arrays and objects use v-bind with JSON
  return `:${key}="${JSON.stringify(value).replace(/"/g, "'")}"`;
}

function propsToVueAttrs(props: Record<string, unknown>, omitClassProps = false): string {
  const parts: string[] = [];
  for (const [key, value] of Object.entries(props).sort(([a], [b]) => a.localeCompare(b))) {
    if (isReservedProp(key, omitClassProps) || value === undefined) continue;
    const attr = propToVueAttr(key, value);
    if (attr) parts.push(attr);
  }
  return parts.join(' ');
}

function escapeDoubleQuotedAttr(value: string): string {
  return value.replace(/"/g, '&quot;');
}

function escapeSingleQuotedExpr(value: string): string {
  return value.replace(/\\/g, '\\\\').replace(/'/g, "\\'");
}

function buildVueClassAttr(staticClasses: string, variantExpression: string | null): string | null {
  const hasStatic = staticClasses.trim().length > 0;

  if (variantExpression && hasStatic) {
    return `:class="[${variantExpression}, '${escapeSingleQuotedExpr(staticClasses)}']"`;
  }
  if (variantExpression) {
    return `:class="${variantExpression}"`;
  }
  if (hasStatic) {
    return `class="${escapeDoubleQuotedAttr(staticClasses)}"`;
  }
  return null;
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

function emitTemplateNode(
  node: UiElement,
  depth: number,
  warnings: CodegenIssue[],
  options: CodegenOptions,
  tailwindVariants: Map<string, TailwindVariantDefinition>,
  objectSchema?: Record<string, FieldSchemaEntry>,
): string {
  const tag = node.component;
  const computedStyle = mergeDecl(
    resolveLayoutStyles(node.layout),
    resolveStyleTokens(node.style),
  );
  let propsObject = node.props && typeof node.props === 'object'
    ? { ...(node.props as Record<string, unknown>) }
    : null;
  const tailwindVariant = tailwindVariants.get(tag);

  // Enrich props from objectSchema metadata (labels, placeholders, required, options, type)
  const enriched = resolveFieldProps(node, objectSchema);
  if (enriched) {
    if (!propsObject) propsObject = {};
    for (const [key, value] of Object.entries(enriched)) {
      if (propsObject[key] === undefined) propsObject[key] = value;
    }
  }

  // Build attributes
  const attrParts: string[] = [];
  attrParts.push(`id="${node.id}"`);
  attrParts.push(`data-oods-component="${tag}"`);

  if (node.layout?.type) {
    attrParts.push(`data-layout="${node.layout.type}"`);
  }

  if (propsObject) {
    const propsStr = propsToVueAttrs(propsObject, options.styling === 'tailwind');
    if (propsStr) attrParts.push(propsStr);
  }

  // v-model for form input components when bound to a field
  if (FORM_INPUT_COMPONENTS.has(tag) && propsObject?.field && typeof propsObject.field === 'string') {
    const fieldName = snakeToCamel(propsObject.field as string);
    attrParts.push(`v-model="${fieldName}"`);
  }

  // Event bindings (e.g., @submit="handleSubmit")
  if (node.bindings && typeof node.bindings === 'object') {
    for (const [eventKey, handlerName] of Object.entries(node.bindings).sort(([a], [b]) => a.localeCompare(b))) {
      // Convert React-style onXxx to Vue @xxx
      const vueEvent = eventKey.replace(/^on([A-Z])/, (_, c: string) => c.toLowerCase());
      attrParts.push(`@${vueEvent}="${handlerName}"`);
    }
  }

  if (options.styling === 'tailwind') {
    const variantExpression = buildTailwindVariantExpression(node, tailwindVariant);
    const baseClasses = buildTailwindStaticClasses(node, computedStyle, {
      includeVariantFallback: !tailwindVariant,
    });
    const responsive = responsiveLayoutClasses(node.layout);
    const staticClasses = responsive ? `${baseClasses} ${responsive}`.trim() : baseClasses;
    const classAttr = buildVueClassAttr(staticClasses, variantExpression);
    if (classAttr) attrParts.push(classAttr);
  } else {
    const inlineStyle = declToInlineStyle(computedStyle);
    if (inlineStyle) {
      attrParts.push(`style="${inlineStyle}"`);
    }
  }

  const attrs = attrParts.length > 0 ? ` ${attrParts.join(' ')}` : '';
  const children = Array.isArray(node.children) ? node.children : [];

  // Sidebar layout
  if (node.layout?.type === 'sidebar' && children.length > 0) {
    const [mainChild, ...asideChildren] = children;
    const mainTemplate = mainChild ? emitTemplateNode(mainChild, depth + 2, warnings, options, tailwindVariants, objectSchema) : '';
    const asideTemplates = asideChildren
      .map((c) => emitTemplateNode(c, depth + 2, warnings, options, tailwindVariants, objectSchema));

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
    let sectionClassOrStyle = '';
    if (options.styling === 'tailwind') {
      const sectionClasses = buildTailwindStaticClasses(node, computedStyle, {
        includeUserClass: false,
        includeInteractiveStates: false,
        includeVariantFallback: false,
      });
      sectionClassOrStyle = sectionClasses ? ` class="${escapeDoubleQuotedAttr(sectionClasses)}"` : '';
    } else {
      const inlineStyle = declToInlineStyle(computedStyle);
      sectionClassOrStyle = inlineStyle ? ` style="${inlineStyle}"` : '';
    }
    const innerChildren = children
      .map((c) => emitTemplateNode(c, depth + 2, warnings, options, tailwindVariants, objectSchema))
      .join('\n');

    const innerAttrParts: string[] = [`id="${node.id}"`, `data-oods-component="${tag}"`];
    if (propsObject) {
      const propsStr = propsToVueAttrs(propsObject, options.styling === 'tailwind');
      if (propsStr) innerAttrParts.push(propsStr);
    }
    // Event bindings belong on the component, not the section wrapper
    if (node.bindings && typeof node.bindings === 'object') {
      for (const [eventKey, handlerName] of Object.entries(node.bindings).sort(([a], [b]) => a.localeCompare(b))) {
        const vueEvent = eventKey.replace(/^on([A-Z])/, (_, c: string) => c.toLowerCase());
        innerAttrParts.push(`@${vueEvent}="${handlerName}"`);
      }
    }
    if (options.styling === 'tailwind') {
      const variantExpression = buildTailwindVariantExpression(node, tailwindVariant);
      const staticClasses = buildTailwindStaticClasses(node, {}, {
        includeVariantFallback: !tailwindVariant,
      });
      const classAttr = buildVueClassAttr(staticClasses, variantExpression);
      if (classAttr) innerAttrParts.push(classAttr);
    }
    const innerAttrs = ` ${innerAttrParts.join(' ')}`;

    if (children.length === 0) {
      return `<section data-layout="section" data-layout-node-id="${node.id}"${sectionClassOrStyle}>\n${ind(`<${tag}${innerAttrs} />`, depth + 1)}\n${'  '.repeat(depth)}</section>`;
    }

    return [
      `<section data-layout="section" data-layout-node-id="${node.id}"${sectionClassOrStyle}>`,
      ind(`<${tag}${innerAttrs}>`, depth + 1),
      ind(innerChildren, 0),
      ind(`</${tag}>`, depth + 1),
      `${'  '.repeat(depth)}</section>`,
    ].join('\n');
  }

  // Self-closing — but inject field content if bound
  if (children.length === 0) {
    const fieldContent = resolveChildContent(node, objectSchema);
    if (fieldContent) {
      if (fieldContent.isChildren) {
        return `<${tag}${attrs}>{{ ${fieldContent.fieldName} }}</${tag}>`;
      }
      const propAttr = `:${fieldContent.propName}="${fieldContent.fieldName}"`;
      return `<${tag}${attrs} ${propAttr} />`;
    }
    return `<${tag}${attrs} />`;
  }

  const childrenTemplate = children
    .map((c) => emitTemplateNode(c, depth + 1, warnings, options, tailwindVariants, objectSchema))
    .join('\n');
  return `<${tag}${attrs}>\n${ind(childrenTemplate, depth + 1)}\n${'  '.repeat(depth)}</${tag}>`;
}

// ---------------------------------------------------------------------------
// Vue-specific handler signatures (delegates to shared binding-utils)
// ---------------------------------------------------------------------------

const VUE_HANDLER_SIGNATURES: HandlerSignatureMap = {
  onSubmit:   { params: '(e)',        tsParams: '(e: Event)' },
  onChange:   { params: '(value)',     tsParams: '(value: unknown)' },
  onRowClick: { params: '(row)',      tsParams: '(row: Record<string, unknown>)' },
  onSort:     { params: '(column)',   tsParams: '(column: string)' },
  onFilter:   { params: '(criteria)', tsParams: '(criteria: Record<string, unknown>)' },
  onEdit:     { params: '()',         tsParams: '()' },
  onDelete:   { params: '()',         tsParams: '()' },
};

// ---------------------------------------------------------------------------
// Vue reactivity helpers
// ---------------------------------------------------------------------------

const FORM_INPUT_COMPONENTS = new Set(['Input', 'Select', 'Textarea', 'TagInput', 'DatePicker', 'Toggle', 'Checkbox', 'Switch']);

const LIST_CONTEXT_BINDINGS = new Set(['onRowClick', 'onSort', 'onFilter', 'onPageChange']);

function isFormSchema(screens: UiElement[]): boolean {
  // List/table contexts use props even when they contain filter inputs
  for (const screen of screens) {
    if (screen.bindings) {
      const hasListBinding = Object.keys(screen.bindings).some(k => LIST_CONTEXT_BINDINGS.has(k));
      if (hasListBinding) return false;
    }
  }
  const stack = [...screens];
  while (stack.length > 0) {
    const node = stack.pop()!;
    if (FORM_INPUT_COMPONENTS.has(node.component)) return true;
    if (node.children) stack.push(...node.children);
  }
  return false;
}

/** Map field type to a sensible ref() default value. */
function fieldRefDefault(entry: FieldSchemaEntry): string {
  if (entry.enum && entry.enum.length > 0) return `'${entry.enum[0]}'`;
  switch (entry.type) {
    case 'boolean': return 'false';
    case 'integer': case 'number': return '0';
    case 'array': return '[]';
    case 'object': return '{}';
    default: return "''";
  }
}

/** Detect derivable computed properties from field names. */
function detectComputedProperties(
  objectSchema: Record<string, FieldSchemaEntry>,
): Array<{ name: string; expression: string; deps: string[] }> {
  const fields = Object.keys(objectSchema);
  const computed: Array<{ name: string; expression: string; deps: string[] }> = [];

  // firstName + lastName → fullName
  const hasFirst = fields.some(f => /^first.?name$/i.test(f));
  const hasLast = fields.some(f => /^last.?name$/i.test(f));
  if (hasFirst && hasLast) {
    const firstName = fields.find(f => /^first.?name$/i.test(f))!;
    const lastName = fields.find(f => /^last.?name$/i.test(f))!;
    const firstCamel = snakeToCamel(firstName);
    const lastCamel = snakeToCamel(lastName);
    computed.push({
      name: 'fullName',
      expression: `\`\${${firstCamel}.value} \${${lastCamel}.value}\`.trim()`,
      deps: [firstCamel, lastCamel],
    });
  }

  // street + city → fullAddress
  const hasStreet = fields.some(f => /^(?:street|address)$/i.test(f));
  const hasCity = fields.some(f => /^city$/i.test(f));
  if (hasStreet && hasCity) {
    const street = fields.find(f => /^(?:street|address)$/i.test(f))!;
    const city = fields.find(f => /^city$/i.test(f))!;
    const streetCamel = snakeToCamel(street);
    const cityCamel = snakeToCamel(city);
    const stateField = fields.find(f => /^state$/i.test(f));
    if (stateField) {
      const stateCamel = snakeToCamel(stateField);
      computed.push({
        name: 'fullAddress',
        expression: `[${streetCamel}.value, ${cityCamel}.value, ${stateCamel}.value].filter(Boolean).join(', ')`,
        deps: [streetCamel, cityCamel, stateCamel],
      });
    } else {
      computed.push({
        name: 'fullAddress',
        expression: `[${streetCamel}.value, ${cityCamel}.value].filter(Boolean).join(', ')`,
        deps: [streetCamel, cityCamel],
      });
    }
  }

  return computed;
}

// ---------------------------------------------------------------------------
// Script setup block
// ---------------------------------------------------------------------------

function buildScriptSetup(
  components: Set<string>,
  options: CodegenOptions,
  tailwindVariants: Map<string, TailwindVariantDefinition>,
  objectSchema?: Record<string, FieldSchemaEntry>,
  screens?: UiElement[],
): string {
  const sorted = Array.from(components).sort();
  const lines: string[] = [];
  const hasObjectSchema = objectSchema && Object.keys(objectSchema).length > 0;
  const includeCva = tailwindVariants.size > 0;
  const formMode = hasObjectSchema && screens ? isFormSchema(screens) : false;

  if (options.typescript) {
    lines.push(`<script setup lang="ts">`);
  } else {
    lines.push(`<script setup>`);
  }

  // Vue reactivity imports
  if (formMode) {
    const computedProps = hasObjectSchema ? detectComputedProperties(objectSchema!) : [];
    const vueImports = ['ref'];
    if (computedProps.length > 0) vueImports.push('computed');
    lines.push(`import { ${vueImports.sort().join(', ')} } from 'vue';`);
  }

  lines.push(`import { ${sorted.join(', ')} } from '@oods/components';`);
  if (includeCva) {
    lines.push(`import { cva } from 'class-variance-authority';`);
  }

  if (includeCva) {
    lines.push('');
    const definitions = Array.from(tailwindVariants.values())
      .sort((a, b) => a.variableName.localeCompare(b.variableName));
    for (const { definition } of definitions) {
      lines.push(definition);
    }
  }

  if (formMode && hasObjectSchema) {
    // Vue 3 Composition API: ref() for each form field
    lines.push('');
    const sortedFields = Object.entries(objectSchema!).sort(([a], [b]) => a.localeCompare(b));
    for (const [fieldName, entry] of sortedFields) {
      const camelName = snakeToCamel(fieldName);
      const defaultValue = fieldRefDefault(entry);
      const tsType = options.typescript ? mapFieldType(entry) : null;

      if (entry.description) {
        lines.push(`/** ${entry.description} */`);
      }
      if (tsType) {
        lines.push(`const ${camelName} = ref<${tsType}>(${defaultValue});`);
      } else {
        lines.push(`const ${camelName} = ref(${defaultValue});`);
      }
    }

    // computed() for derived values
    const computedProps = detectComputedProperties(objectSchema!);
    if (computedProps.length > 0) {
      lines.push('');
      for (const cp of computedProps) {
        lines.push(`const ${cp.name} = computed(() => ${cp.expression});`);
      }
    }
  } else if (options.typescript && hasObjectSchema) {
    // Non-form: use defineProps for display components
    lines.push('');
    lines.push('interface Props {');
    for (const [fieldName, entry] of Object.entries(objectSchema!).sort(([a], [b]) => a.localeCompare(b))) {
      const tsType = mapFieldType(entry);
      const optional = entry.required ? '' : '?';
      const camelName = snakeToCamel(fieldName);
      if (entry.description) {
        lines.push(`  /** ${entry.description} */`);
      }
      lines.push(`  ${camelName}${optional}: ${tsType};`);
    }
    lines.push('}');
    lines.push('');
    const fieldNames = Object.keys(objectSchema!)
      .map(snakeToCamel)
      .sort();
    lines.push(`const { ${fieldNames.join(', ')} } = defineProps<Props>();`);
  } else if (options.typescript) {
    lines.push('');
    lines.push(`defineProps<{`);
    lines.push(`  // Props can be extended here`);
    lines.push(`}>();`);
  }

  // Handler stubs from bindings
  if (screens) {
    const handlers = collectBindings(screens);
    const stubs = generateHandlerStubs(handlers, options.typescript, VUE_HANDLER_SIGNATURES);
    if (stubs) {
      lines.push('');
      lines.push(stubs);
    }
  }

  // Prop default declarations from objectSchema field values on elements
  if (hasObjectSchema && screens) {
    const propDefaults = collectPropDefaults(screens, objectSchema!);
    if (propDefaults.size > 0) {
      lines.push('');
      for (const [propName, { formatted, isExpression }] of propDefaults) {
        const rhs = isExpression ? formatted : `'${formatted.replace(/'/g, "\\'")}'`;
        lines.push(`const ${propName} = ${rhs};`);
      }
    }
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
  const tailwindVariants = options.styling === 'tailwind'
    ? collectTailwindVariantDefinitions(schema.screens)
    : new Map<string, TailwindVariantDefinition>();

  // Build template block
  const screenTemplates = schema.screens
    .map((screen) => emitTemplateNode(screen, 1, warnings, options, tailwindVariants, schema.objectSchema))
    .join('\n');

  const templateBlock = [
    `<template>`,
    ind(screenTemplates, 1),
    `</template>`,
  ].join('\n');

  // Build script setup block
  const scriptBlock = buildScriptSetup(
    components,
    options,
    tailwindVariants,
    schema.objectSchema,
    schema.screens,
  );

  // Build optional scoped style block
  const styleBlock = buildScopedStyle(schema.screens, options);

  // Inject token overrides as CSS custom properties
  let tokenStyle = '';
  if (schema.tokenOverrides && Object.keys(schema.tokenOverrides).length > 0) {
    const declarations = Object.entries(schema.tokenOverrides)
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([key, value]) => `  --token-${key.replace(/[.\s_]+/g, '-')}: ${value};`)
      .join('\n');
    tokenStyle = `<style>\n:root {\n${declarations}\n}\n</style>`;
  }

  // Assemble SFC
  const blocks = [templateBlock, '', scriptBlock];
  if (styleBlock) {
    blocks.push('', styleBlock);
  }
  if (tokenStyle) {
    blocks.push('', tokenStyle);
  }
  blocks.push('');

  const code = blocks.join('\n');

  return {
    status: 'ok',
    framework: 'vue',
    code,
    fileExtension: '.vue',
    imports: tailwindVariants.size > 0
      ? ['@oods/components', 'class-variance-authority']
      : ['@oods/components'],
    warnings,
  };
}
