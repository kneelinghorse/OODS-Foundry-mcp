/**
 * Shared codegen utilities for object schema type mapping, event handler
 * stub generation, and prop-value formatting.
 *
 * Both react-emitter and vue-emitter consume these; framework-specific
 * differences (e.g. React.FormEvent vs Event) are injected via the
 * HandlerSignatureMap parameter.
 */
import type { UiElement, FieldSchemaEntry } from '../schemas/generated.js';
import { getContentStrategy, type ContentStrategy } from './content-strategy.js';

// ---------------------------------------------------------------------------
// Field type mapping (object schema → TypeScript types)
// ---------------------------------------------------------------------------

const FIELD_TYPE_MAP: Record<string, string> = {
  string: 'string',
  integer: 'number',
  number: 'number',
  boolean: 'boolean',
  datetime: 'string',
  email: 'string',
  date: 'string',
  url: 'string',
  uuid: 'string',
  object: 'Record<string, unknown>',
  array: 'unknown[]',
};

export function mapFieldType(entry: FieldSchemaEntry): string {
  if (entry.enum && entry.enum.length > 0) {
    return entry.enum.map((v) => `'${v}'`).join(' | ');
  }
  return FIELD_TYPE_MAP[entry.type] ?? 'unknown';
}

export function snakeToCamel(name: string): string {
  return name.replace(/_([a-z])/g, (_, c: string) => c.toUpperCase());
}

// ---------------------------------------------------------------------------
// Handler signature types
// ---------------------------------------------------------------------------

export type HandlerSignature = { params: string; tsParams: string };
export type HandlerSignatureMap = Record<string, HandlerSignature>;

// ---------------------------------------------------------------------------
// Binding collection (tree walk)
// ---------------------------------------------------------------------------

/**
 * Collect all unique handler names from bindings across the element tree.
 * Returns a map of handler name → binding key for signature lookup.
 */
export function collectBindings(screens: UiElement[]): Map<string, string> {
  const handlers = new Map<string, string>();
  const stack = [...screens];
  while (stack.length > 0) {
    const node = stack.pop()!;
    if (node.bindings) {
      for (const [bindingKey, handlerName] of Object.entries(node.bindings)) {
        if (!handlers.has(handlerName)) {
          handlers.set(handlerName, bindingKey);
        }
      }
    }
    if (node.children) stack.push(...node.children);
  }
  return handlers;
}

// ---------------------------------------------------------------------------
// Handler stub generation
// ---------------------------------------------------------------------------

/**
 * Generate handler stubs as const arrow functions with typed parameters.
 * The `signatures` map is framework-specific (React vs Vue param types).
 * The optional `indentPrefix` controls leading whitespace (React needs `  `).
 */
export function generateHandlerStubs(
  handlers: Map<string, string>,
  typescript: boolean,
  signatures: HandlerSignatureMap,
  indentPrefix = '',
): string {
  if (handlers.size === 0) return '';

  const lines: string[] = [];
  for (const [handlerName, bindingKey] of Array.from(handlers.entries()).sort(([a], [b]) => a.localeCompare(b))) {
    const baseKey = bindingKey.replace(/_\w+$/, '');
    const sig = signatures[baseKey] ?? signatures[bindingKey];
    const params = typescript ? (sig?.tsParams ?? '()') : (sig?.params ?? '()');
    lines.push(`${indentPrefix}const ${handlerName} = ${params} => { /* TODO: implement ${handlerName} */ };`);
  }

  return lines.join('\n');
}

// ---------------------------------------------------------------------------
// Prop default value formatting
// ---------------------------------------------------------------------------

/**
 * Format a prop value for type-safe JSX/Vue attribute output.
 * Uses objectSchema field metadata to pick the right literal format:
 *  - enum string → string literal (quoted)
 *  - number/integer → bare numeric
 *  - boolean → bare boolean
 *  - string → quoted string
 * Falls back to JSON.stringify for complex types.
 */
export function formatPropValue(
  value: unknown,
  fieldName: string,
  objectSchema?: Record<string, FieldSchemaEntry>,
): { formatted: string; isExpression: boolean } {
  if (value === null || value === undefined) {
    return { formatted: 'undefined', isExpression: true };
  }

  const entry = objectSchema?.[fieldName];
  const fieldType = entry?.type;

  if (typeof value === 'boolean') {
    return { formatted: String(value), isExpression: true };
  }
  if (typeof value === 'number') {
    return { formatted: String(value), isExpression: true };
  }
  if (typeof value === 'string') {
    // If the field is an enum, still emit as a quoted string — the type system
    // handles enforcement via the union type in the Props interface.
    return { formatted: value, isExpression: false };
  }
  if (fieldType === 'object' || fieldType === 'array' || typeof value === 'object') {
    return { formatted: JSON.stringify(value), isExpression: true };
  }

  return { formatted: String(value), isExpression: false };
}

/**
 * Collect prop default values from UiElements that have both a `props.field`
 * matching an objectSchema field and a default value on the element's props.
 * Returns a map of camelCase prop name → formatted value.
 */
export function collectPropDefaults(
  screens: UiElement[],
  objectSchema: Record<string, FieldSchemaEntry>,
): Map<string, { formatted: string; isExpression: boolean }> {
  const defaults = new Map<string, { formatted: string; isExpression: boolean }>();
  const schemaFields = new Set(Object.keys(objectSchema));

  const stack = [...screens];
  while (stack.length > 0) {
    const node = stack.pop()!;
    if (node.props && typeof node.props === 'object') {
      const props = node.props as Record<string, unknown>;
      // Check each prop key — if it matches a schema field, capture the value
      for (const [key, value] of Object.entries(props)) {
        if (schemaFields.has(key) && value !== undefined && !defaults.has(snakeToCamel(key))) {
          defaults.set(snakeToCamel(key), formatPropValue(value, key, objectSchema));
        }
      }
    }
    if (node.children) stack.push(...node.children);
  }

  return defaults;
}

// ---------------------------------------------------------------------------
// Field → prop enrichment from objectSchema metadata
// ---------------------------------------------------------------------------

const SEMANTIC_TYPE_TO_INPUT: Record<string, string> = {
  email: 'email',
  url: 'url',
  date: 'date',
  datetime: 'datetime-local',
  integer: 'number',
  number: 'number',
};

function humanizeFieldName(fieldName: string): string {
  return fieldName
    .replace(/_/g, ' ')
    .replace(/\b\w/g, (c) => c.toUpperCase());
}

function humanizeEnumValue(value: string): string {
  return value
    .replace(/[-_]/g, ' ')
    .replace(/\b\w/g, (c) => c.toUpperCase());
}

export interface FieldPropEnrichment {
  label?: string;
  placeholder?: string;
  required?: boolean;
  options?: Array<{ label: string; value: string }>;
  type?: string;
}

/**
 * Derive additional props from objectSchema metadata for a field-bound component.
 * Returns null if the node has no field binding or no enrichments are needed.
 * Does not override props that are already explicitly set on the node.
 */
export function resolveFieldProps(
  node: UiElement,
  objectSchema?: Record<string, FieldSchemaEntry>,
): FieldPropEnrichment | null {
  const fieldProp = node.props?.field;
  if (typeof fieldProp !== 'string' || !fieldProp) return null;
  if (!objectSchema || !objectSchema[fieldProp]) return null;

  const entry = objectSchema[fieldProp];
  const strategy = getContentStrategy(node.component);
  if (strategy === 'none') return null;

  const existing = (node.props as Record<string, unknown>) ?? {};
  const props: FieldPropEnrichment = {};

  // Label: humanize field name for label-prop and status-prop components
  if (!existing.label && (strategy === 'label-prop' || strategy === 'status-prop')) {
    props.label = humanizeFieldName(fieldProp);
  }

  // Enrichments specific to form input components (value-prop strategy)
  if (strategy === 'value-prop') {
    if (!existing.placeholder && entry.description) {
      props.placeholder = entry.description;
    }
    if (entry.required && existing.required === undefined) {
      props.required = true;
    }
    if (!existing.type) {
      const inputType = SEMANTIC_TYPE_TO_INPUT[entry.type];
      if (inputType) props.type = inputType;
    }
  }

  // Enum options for Select-like components
  if (
    entry.enum && entry.enum.length > 0 &&
    !existing.options &&
    (node.component === 'Select' || node.component === 'StatusSelector')
  ) {
    props.options = entry.enum.map((v) => ({ label: humanizeEnumValue(v), value: v }));
  }

  return Object.keys(props).length > 0 ? props : null;
}

// ---------------------------------------------------------------------------
// Field → component content resolution for codegen prop binding
// ---------------------------------------------------------------------------

export type FieldContentResolution = {
  /** The content strategy used */
  strategy: ContentStrategy;
  /** The camelCase field name for code injection */
  fieldName: string;
  /** The prop name to inject on (for value-prop, label-prop, status-prop) */
  propName?: string;
  /** Whether this field should be injected as children content */
  isChildren: boolean;
};

/**
 * Resolve how a field should be injected into a component's codegen output.
 * Returns null if the component has no field binding or uses strategy 'none'.
 */
export function resolveChildContent(
  node: UiElement,
  objectSchema?: Record<string, FieldSchemaEntry>,
): FieldContentResolution | null {
  const fieldProp = node.props?.field;
  if (typeof fieldProp !== 'string' || !fieldProp) return null;
  if (!objectSchema || !objectSchema[fieldProp]) return null;

  const strategy = getContentStrategy(node.component);
  if (strategy === 'none') return null;

  const fieldName = snakeToCamel(fieldProp);

  switch (strategy) {
    case 'children':
      return { strategy, fieldName, isChildren: true };
    case 'value-prop':
      return { strategy, fieldName, propName: 'value', isChildren: false };
    case 'label-prop':
      return { strategy, fieldName, propName: 'label', isChildren: false };
    case 'status-prop':
      return { strategy, fieldName, propName: 'status', isChildren: false };
    default:
      return null;
  }
}
