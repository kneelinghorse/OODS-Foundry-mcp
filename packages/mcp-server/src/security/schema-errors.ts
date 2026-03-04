import { formatValidationErrors, type ValidationErrorDetail } from './errors.js';
import { patchExampleHint } from '../tools/repl.patch-hint.js';

type AjvError = {
  keyword: string;
  instancePath: string;
  params: Record<string, unknown>;
  message?: string;
};

export type SchemaInputErrorDetails = {
  message: string;
  details: ValidationErrorDetail[];
  hint?: string;
  expected?: Record<string, string>;
};

function needsPatchHint(tool: string, errors: AjvError[] | null | undefined): boolean {
  if (tool !== 'repl.validate' || !errors) return false;
  return errors.some((err) => {
    if (!err) return false;
    if (typeof err.instancePath === 'string' && err.instancePath.startsWith('/patch')) return true;
    return err.keyword === 'required' && (err.params as any)?.missingProperty === 'patch';
  });
}

export function formatSchemaInputError(tool: string, errors: AjvError[] | null | undefined): SchemaInputErrorDetails {
  const formatted = formatValidationErrors(errors as any);
  const result: SchemaInputErrorDetails = {
    message: formatted.message,
    details: formatted.details,
  };

  if (needsPatchHint(tool, errors)) {
    result.hint = patchExampleHint();
    result.expected = { patch: 'JSON Patch array or node patch object(s)' };
  }

  return result;
}
