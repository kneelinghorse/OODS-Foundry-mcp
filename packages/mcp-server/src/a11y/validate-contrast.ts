import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import { DEFAULT_CONTRAST_RULES, evaluateContrastRules } from '@oods/a11y-tools';
import type { ContrastEvaluation } from '@oods/a11y-tools';

import type { ReplIssue } from '../schemas/generated.js';
import { flattenDTCGLayers, toFlatTokenMap } from './token-color-resolver.js';
import type { DTCGTokenData } from './token-color-resolver.js';

// ---------------------------------------------------------------------------
// Token data loading
// ---------------------------------------------------------------------------

const __dirname = fileURLToPath(new URL('.', import.meta.url));
const REPO_ROOT = path.resolve(__dirname, '../../../../');
const ARTIFACT_DIR = path.join(REPO_ROOT, 'artifacts', 'structured-data');
const MANIFEST_PATH = path.join(ARTIFACT_DIR, 'manifest.json');

function readJson(filePath: string): Record<string, unknown> {
  return JSON.parse(fs.readFileSync(filePath, 'utf8'));
}

/**
 * Load the DTCG token data from the structured data artifact directory.
 * Follows the manifest to find the token file, falling back to a glob match.
 */
export function loadTokenData(): DTCGTokenData | null {
  try {
    let tokenPath: string | null = null;

    if (fs.existsSync(MANIFEST_PATH)) {
      const manifest = readJson(MANIFEST_PATH) as { artifacts?: Array<{ name?: string; path?: string; file?: string }> };
      const artifact = manifest.artifacts?.find((a) => a.name === 'tokens');
      const source = artifact?.path ?? artifact?.file;
      if (source) {
        const resolved = path.isAbsolute(source) ? source : path.resolve(REPO_ROOT, source);
        if (fs.existsSync(resolved)) tokenPath = resolved;
      }
    }

    if (!tokenPath) {
      const entries = fs.readdirSync(ARTIFACT_DIR).filter((f) => f.startsWith('oods-tokens') && f.endsWith('.json'));
      entries.sort().reverse(); // most recent first
      if (entries.length > 0) {
        tokenPath = path.join(ARTIFACT_DIR, entries[0]);
      }
    }

    if (!tokenPath || !fs.existsSync(tokenPath)) return null;

    const data = readJson(tokenPath);
    if (!data.layers || typeof data.layers !== 'object') return null;

    return data as unknown as DTCGTokenData;
  } catch {
    return null;
  }
}

// ---------------------------------------------------------------------------
// Contrast evaluation → ReplIssue mapping
// ---------------------------------------------------------------------------

function wcagLevel(threshold: number): string {
  return threshold >= 4.5 ? 'AA' : 'AA (large text/graphics)';
}

function formatFailure(evaluation: ContrastEvaluation): ReplIssue {
  const { rule, ratio, threshold } = evaluation;
  const ratioText = Number.isFinite(ratio) ? `${ratio}:1` : 'unmeasurable';
  const level = wcagLevel(threshold);

  return {
    code: 'A11Y_CONTRAST',
    message: rule.summary,
    hint: `${rule.target} fails WCAG ${level} — contrast ratio ${ratioText}, minimum ${threshold}:1 required.`,
    severity: 'warning',
  };
}

/**
 * Run all default contrast rules against token data and return ReplIssue
 * entries for any failures.
 *
 * @param tokenData DTCG token data from the structured data artifact.
 * @returns Array of ReplIssue with code `A11Y_CONTRAST` and severity `warning`.
 */
export function validateContrast(tokenData: DTCGTokenData): ReplIssue[] {
  const flatMap = flattenDTCGLayers(tokenData);
  const flatTokenMap = toFlatTokenMap(flatMap);

  const evaluations = evaluateContrastRules(flatTokenMap, {
    prefix: 'oods',
    rules: DEFAULT_CONTRAST_RULES,
  });

  return evaluations.filter((e) => !e.passed).map(formatFailure);
}
