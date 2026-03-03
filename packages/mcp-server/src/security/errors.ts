import { randomUUID } from 'node:crypto';

export type TypedError = {
  code: string;
  message: string;
  details?: unknown;
  incidentId: string;
};

export function err(code: string, message: string, details?: unknown): TypedError {
  return { code, message, details, incidentId: randomUUID() };
}

export const ERROR_CODES = {
  POLICY_DENIED: 'POLICY_DENIED',
  RATE_LIMIT: 'RATE_LIMIT',
  CONCURRENCY: 'CONCURRENCY',
  TIMEOUT: 'TIMEOUT',
  SCHEMA_INPUT: 'SCHEMA_INPUT',
  SCHEMA_OUTPUT: 'SCHEMA_OUTPUT',
  BAD_REQUEST: 'BAD_REQUEST',
  UNKNOWN_TOOL: 'UNKNOWN_TOOL',
} as const;

// ---------------------------------------------------------------------------
// Agent-friendly validation error formatting
// ---------------------------------------------------------------------------

export type ValidationErrorDetail = {
  field: string;
  message: string;
  keyword: string;
};

export type FormattedValidationResult = {
  message: string;
  details: ValidationErrorDetail[];
};

/**
 * Converts raw AJV error objects into agent-readable messages so agents can
 * self-correct without needing to consult documentation.
 */
export function formatValidationErrors(
  errors: Array<{ keyword: string; instancePath: string; params: Record<string, unknown>; message?: string }> | null | undefined,
): FormattedValidationResult {
  if (!errors || errors.length === 0) {
    return { message: 'Input validation failed', details: [] };
  }

  const details: ValidationErrorDetail[] = errors.map((e) => {
    const field = e.instancePath ? e.instancePath.replace(/^\//, '').replace(/\//g, '.') : '(root)';

    switch (e.keyword) {
      case 'enum': {
        const allowed = (e.params.allowedValues as string[]) ?? [];
        return {
          field,
          message: `field '${field}' must be one of: ${allowed.join(', ')}`,
          keyword: 'enum',
        };
      }
      case 'required': {
        const missing = (e.params.missingProperty as string) ?? 'unknown';
        return {
          field: missing,
          message: `missing required field: '${missing}'`,
          keyword: 'required',
        };
      }
      case 'type': {
        const expected = (e.params.type as string) ?? 'unknown';
        return {
          field,
          message: `field '${field}' must be ${expected}`,
          keyword: 'type',
        };
      }
      case 'additionalProperties': {
        const extra = (e.params.additionalProperty as string) ?? 'unknown';
        return {
          field: extra,
          message: `unknown field '${extra}' is not allowed`,
          keyword: 'additionalProperties',
        };
      }
      default:
        return {
          field,
          message: e.message ?? `validation failed (${e.keyword})`,
          keyword: e.keyword,
        };
    }
  });

  const summary = details.map((d) => d.message).join('; ');
  return { message: `Input validation failed: ${summary}`, details };
}
