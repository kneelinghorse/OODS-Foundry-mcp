/**
 * OODS Foundry Error Code Registry — v1
 *
 * Code format:
 *   OODS-V{NNN}  validation errors   (bad input, schema mismatch)
 *   OODS-N{NNN}  not-found errors     (missing entity, expired ref)
 *   OODS-C{NNN}  conflict errors      (duplicate, state clash)
 *   OODS-S{NNN}  server errors        (infrastructure, timeout)
 *   OODS-R{NNN}  rate-limit errors    (throttle, concurrency)
 *
 * Commitment: registered codes will not be renamed or reassigned
 * without a deprecation period of at least one minor version.
 */

import { randomUUID } from 'node:crypto';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export type ErrorCategory =
  | 'validation'
  | 'not_found'
  | 'conflict'
  | 'server_error'
  | 'rate_limit';

export interface ErrorDefinition {
  code: string;
  category: ErrorCategory;
  message: string;
  retryable: boolean;
}

export interface StructuredError {
  code: string;
  category: ErrorCategory;
  message: string;
  retryable: boolean;
  details?: unknown;
  incidentId: string;
}

// ---------------------------------------------------------------------------
// Registry
// ---------------------------------------------------------------------------

const registry: ReadonlyMap<string, ErrorDefinition> = new Map<string, ErrorDefinition>([

  // ── Validation: Input & Schema ──────────────────────────────────────────
  ['OODS-V001', { code: 'OODS-V001', category: 'validation', message: 'Input validation failed', retryable: true }],
  ['OODS-V002', { code: 'OODS-V002', category: 'validation', message: 'Output validation failed', retryable: false }],
  ['OODS-V003', { code: 'OODS-V003', category: 'validation', message: 'Missing required field', retryable: true }],
  ['OODS-V004', { code: 'OODS-V004', category: 'validation', message: 'Invalid slug format', retryable: true }],
  ['OODS-V005', { code: 'OODS-V005', category: 'validation', message: 'Unknown framework', retryable: true }],
  ['OODS-V006', { code: 'OODS-V006', category: 'validation', message: 'Unknown component', retryable: true }],
  ['OODS-V007', { code: 'OODS-V007', category: 'validation', message: 'DSL schema validation failed', retryable: true }],
  ['OODS-V008', { code: 'OODS-V008', category: 'validation', message: 'Duplicate node ID', retryable: true }],
  ['OODS-V009', { code: 'OODS-V009', category: 'validation', message: 'Missing schema', retryable: true }],
  ['OODS-V010', { code: 'OODS-V010', category: 'validation', message: 'Missing base tree', retryable: true }],
  ['OODS-V011', { code: 'OODS-V011', category: 'validation', message: 'Missing patch', retryable: true }],
  ['OODS-V012', { code: 'OODS-V012', category: 'validation', message: 'Unsupported billing object', retryable: true }],
  ['OODS-V013', { code: 'OODS-V013', category: 'validation', message: 'Unknown fixture provider', retryable: true }],
  ['OODS-V014', { code: 'OODS-V014', category: 'validation', message: 'No fixture providers selected', retryable: true }],
  ['OODS-V015', { code: 'OODS-V015', category: 'validation', message: 'No packages resolved for release verification', retryable: true }],

  // ── Validation: Patch operations ────────────────────────────────────────
  ['OODS-V100', { code: 'OODS-V100', category: 'validation', message: 'Invalid JSON pointer', retryable: true }],
  ['OODS-V101', { code: 'OODS-V101', category: 'validation', message: 'Unsafe path segment', retryable: false }],
  ['OODS-V102', { code: 'OODS-V102', category: 'validation', message: 'Invalid patch operation', retryable: true }],
  ['OODS-V103', { code: 'OODS-V103', category: 'validation', message: 'Cannot patch document root', retryable: false }],
  ['OODS-V104', { code: 'OODS-V104', category: 'validation', message: 'Patch path not found', retryable: true }],
  ['OODS-V105', { code: 'OODS-V105', category: 'validation', message: 'Invalid array index', retryable: true }],
  ['OODS-V106', { code: 'OODS-V106', category: 'validation', message: 'Patch apply failed', retryable: false }],
  ['OODS-V107', { code: 'OODS-V107', category: 'validation', message: 'Invalid patch entry', retryable: true }],
  ['OODS-V108', { code: 'OODS-V108', category: 'validation', message: 'Node patch missing nodeId', retryable: true }],
  ['OODS-V109', { code: 'OODS-V109', category: 'validation', message: 'Empty patch array', retryable: true }],
  ['OODS-V110', { code: 'OODS-V110', category: 'validation', message: 'Invalid patch type', retryable: true }],
  ['OODS-V111', { code: 'OODS-V111', category: 'validation', message: 'Unsupported patch op', retryable: true }],
  ['OODS-V112', { code: 'OODS-V112', category: 'validation', message: 'Invalid remove target', retryable: true }],
  ['OODS-V113', { code: 'OODS-V113', category: 'validation', message: 'Unsafe key', retryable: false }],

  ['OODS-V114', { code: 'OODS-V114', category: 'validation', message: 'Mixed patch formats', retryable: true }],
  ['OODS-V115', { code: 'OODS-V115', category: 'validation', message: 'JSON Patch array required', retryable: true }],
  ['OODS-V116', { code: 'OODS-V116', category: 'validation', message: 'Low layout confidence', retryable: true }],
  ['OODS-V117', { code: 'OODS-V117', category: 'validation', message: 'Object composition warning', retryable: false }],
  ['OODS-V118', { code: 'OODS-V118', category: 'validation', message: 'Resolution warning', retryable: false }],
  ['OODS-V119', { code: 'OODS-V119', category: 'validation', message: 'Unknown components in schema', retryable: true }],

  // ── Validation: Viz ──────────────────────────────────────────────────
  ['OODS-V120', { code: 'OODS-V120', category: 'validation', message: 'Invalid chart type', retryable: true }],
  ['OODS-V121', { code: 'OODS-V121', category: 'validation', message: 'Missing viz traits', retryable: true }],
  ['OODS-V122', { code: 'OODS-V122', category: 'validation', message: 'No viz mark traits on object', retryable: true }],

  // ── Validation: Brand/Map ───────────────────────────────────────────────
  ['OODS-V200', { code: 'OODS-V200', category: 'validation', message: 'Map validation failed', retryable: true }],
  ['OODS-V201', { code: 'OODS-V201', category: 'validation', message: 'map.apply input invalid', retryable: true }],

  // ── Not Found ───────────────────────────────────────────────────────────
  ['OODS-N001', { code: 'OODS-N001', category: 'not_found', message: 'Unknown tool', retryable: false }],
  ['OODS-N002', { code: 'OODS-N002', category: 'not_found', message: 'Schema not found', retryable: false }],
  ['OODS-N003', { code: 'OODS-N003', category: 'not_found', message: 'SchemaRef not found', retryable: true }],
  ['OODS-N004', { code: 'OODS-N004', category: 'not_found', message: 'SchemaRef expired', retryable: true }],
  ['OODS-N005', { code: 'OODS-N005', category: 'not_found', message: 'Object not found', retryable: false }],
  ['OODS-N006', { code: 'OODS-N006', category: 'not_found', message: 'Patch node not found', retryable: true }],
  ['OODS-N007', { code: 'OODS-N007', category: 'not_found', message: 'Artifact not found', retryable: false }],
  ['OODS-N008', { code: 'OODS-N008', category: 'not_found', message: 'Fixture object not found', retryable: false }],
  ['OODS-N009', { code: 'OODS-N009', category: 'not_found', message: 'Registry manifest missing', retryable: false }],
  ['OODS-N010', { code: 'OODS-N010', category: 'not_found', message: 'Registry unavailable', retryable: false }],
  ['OODS-N011', { code: 'OODS-N011', category: 'not_found', message: 'Token data missing', retryable: false }],
  ['OODS-N012', { code: 'OODS-N012', category: 'not_found', message: 'A11y token data missing', retryable: false }],
  ['OODS-N013', { code: 'OODS-N013', category: 'not_found', message: 'Registry fallback used', retryable: false }],
  ['OODS-N014', { code: 'OODS-N014', category: 'not_found', message: 'Registry snapshot payload missing', retryable: false }],

  // ── Conflict ────────────────────────────────────────────────────────────
  ['OODS-C001', { code: 'OODS-C001', category: 'conflict', message: 'Schema ref missing after compose', retryable: false }],
  ['OODS-C002', { code: 'OODS-C002', category: 'conflict', message: 'Tag already exists', retryable: false }],

  // ── Server Error ────────────────────────────────────────────────────────
  ['OODS-S001', { code: 'OODS-S001', category: 'server_error', message: 'Policy denied', retryable: false }],
  ['OODS-S002', { code: 'OODS-S002', category: 'server_error', message: 'Execution timeout', retryable: true }],
  ['OODS-S003', { code: 'OODS-S003', category: 'server_error', message: 'Bad request', retryable: false }],
  ['OODS-S004', { code: 'OODS-S004', category: 'server_error', message: 'Object load failed', retryable: false }],
  ['OODS-S005', { code: 'OODS-S005', category: 'server_error', message: 'Catalog load failed', retryable: true }],
  ['OODS-S006', { code: 'OODS-S006', category: 'server_error', message: 'HTML render failed', retryable: false }],
  ['OODS-S007', { code: 'OODS-S007', category: 'server_error', message: 'Fragment render failed', retryable: false }],
  ['OODS-S008', { code: 'OODS-S008', category: 'server_error', message: 'Fixture load failed', retryable: false }],
  ['OODS-S009', { code: 'OODS-S009', category: 'server_error', message: 'Pipeline step failed', retryable: false }],
  ['OODS-S010', { code: 'OODS-S010', category: 'server_error', message: 'Compose step exception', retryable: false }],
  ['OODS-S011', { code: 'OODS-S011', category: 'server_error', message: 'Validate step exception', retryable: false }],
  ['OODS-S012', { code: 'OODS-S012', category: 'server_error', message: 'Render step exception', retryable: false }],
  ['OODS-S013', { code: 'OODS-S013', category: 'server_error', message: 'Codegen step exception', retryable: false }],
  ['OODS-S014', { code: 'OODS-S014', category: 'server_error', message: 'Save step exception', retryable: false }],
  ['OODS-S015', { code: 'OODS-S015', category: 'server_error', message: 'Path not allowed', retryable: false }],
  ['OODS-S016', { code: 'OODS-S016', category: 'server_error', message: 'Artifact filename empty', retryable: false }],
  ['OODS-S017', { code: 'OODS-S017', category: 'server_error', message: 'Artifact filename unsafe', retryable: false }],
  ['OODS-S018', { code: 'OODS-S018', category: 'server_error', message: 'Fixture provider mismatch', retryable: false }],

  // ── Rate Limit ──────────────────────────────────────────────────────────
  ['OODS-R001', { code: 'OODS-R001', category: 'rate_limit', message: 'Rate limit exceeded', retryable: true }],
  ['OODS-R002', { code: 'OODS-R002', category: 'rate_limit', message: 'Concurrency limit exceeded', retryable: true }],
]);

// ---------------------------------------------------------------------------
// Lookup helpers
// ---------------------------------------------------------------------------

export function getDefinition(code: string): ErrorDefinition | undefined {
  return registry.get(code);
}

export function isRetryable(code: string): boolean {
  return registry.get(code)?.retryable ?? false;
}

export function allCodes(): readonly ErrorDefinition[] {
  return [...registry.values()];
}

// ---------------------------------------------------------------------------
// Error factory
// ---------------------------------------------------------------------------

export function createError(code: string, context?: { message?: string; details?: unknown }): StructuredError {
  const def = registry.get(code);
  if (!def) {
    return {
      code,
      category: 'server_error',
      message: context?.message ?? `Unknown error code: ${code}`,
      retryable: false,
      details: context?.details,
      incidentId: randomUUID(),
    };
  }
  return {
    code: def.code,
    category: def.category,
    message: context?.message ?? def.message,
    retryable: def.retryable,
    details: context?.details,
    incidentId: randomUUID(),
  };
}

// ---------------------------------------------------------------------------
// Legacy bridge: maps old ERROR_CODES constants → new OODS codes
// ---------------------------------------------------------------------------

export const LEGACY_CODE_MAP: Record<string, string> = {
  SCHEMA_INPUT: 'OODS-V001',
  SCHEMA_OUTPUT: 'OODS-V002',
  UNKNOWN_TOOL: 'OODS-N001',
  POLICY_DENIED: 'OODS-S001',
  TIMEOUT: 'OODS-S002',
  BAD_REQUEST: 'OODS-S003',
  RATE_LIMIT: 'OODS-R001',
  CONCURRENCY: 'OODS-R002',
};
