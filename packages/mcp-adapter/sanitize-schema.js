/**
 * Sanitizes JSON Schema for MCP client compatibility.
 *
 * Claude's API (and other strict MCP clients) reject schemas containing
 * top-level allOf/oneOf/anyOf. The native server validates with AJV anyway —
 * adapter schemas are for agent discovery only.
 *
 * Transforms applied:
 * 1. Strip top-level allOf, oneOf, anyOf
 * 2. Flatten nested oneOf/anyOf to their first variant
 * 3. Remove $schema, $id, title meta-keywords (not part of MCP input_schema)
 * 4. Replace $ref with { type: "object" } stub (clients can't resolve local refs)
 */

const META_KEYWORDS = new Set(['$schema', '$id', 'title']);
const COMPOSITION_KEYWORDS = new Set(['allOf', 'oneOf', 'anyOf']);

export function sanitizeSchema(schema, isRoot = true) {
  if (schema === null || typeof schema !== 'object') return schema;
  if (Array.isArray(schema)) return schema.map(item => sanitizeSchema(item, false));

  // Replace $ref with a generic object stub
  if ('$ref' in schema) {
    return { type: 'object', description: '(complex schema — see server docs)' };
  }

  const out = {};

  for (const [key, value] of Object.entries(schema)) {
    // Strip top-level meta-keywords
    if (isRoot && META_KEYWORDS.has(key)) {
      continue;
    }

    // Strip top-level composition keywords (allOf/oneOf/anyOf)
    if (isRoot && COMPOSITION_KEYWORDS.has(key)) {
      continue;
    }

    // Flatten nested oneOf/anyOf to first variant
    if (!isRoot && (key === 'oneOf' || key === 'anyOf') && Array.isArray(value) && value.length > 0) {
      const firstVariant = sanitizeSchema(value[0], false);
      if (typeof firstVariant === 'object' && firstVariant !== null && !Array.isArray(firstVariant)) {
        Object.assign(out, firstVariant);
      }
      continue;
    }

    out[key] = sanitizeSchema(value, false);
  }

  return out;
}
