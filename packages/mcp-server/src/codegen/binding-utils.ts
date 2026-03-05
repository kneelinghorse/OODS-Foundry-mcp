/**
 * Shared codegen utilities for object schema type mapping, event handler
 * stub generation, and prop-value formatting.
 *
 * Both react-emitter and vue-emitter consume these; framework-specific
 * differences (e.g. React.FormEvent vs Event) are injected via the
 * HandlerSignatureMap parameter.
 */
import type { UiElement, FieldSchemaEntry } from '../schemas/generated.js';

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
