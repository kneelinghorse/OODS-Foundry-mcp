import path from 'node:path';
import fs from 'node:fs';
import { todayDir, loadPolicy, withinAllowed } from '../lib/security.js';
import { writeTranscript, writeBundleIndex } from '../lib/transcript.js';
import { DEFAULT_CONTRAST_RULES, evaluateContrastRules } from '@oods/a11y-tools';
import type { ContrastEvaluation } from '@oods/a11y-tools';
import { flattenDTCGLayers, toFlatTokenMap } from '../a11y/token-color-resolver.js';
import { loadTokenData } from '../a11y/validate-contrast.js';
import type { GenericOutput } from './types.js';
import type { UiSchema, UiElement } from '../schemas/generated.js';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

type A11yScanInput = {
  apply?: boolean;
  schema?: UiSchema;
};

type RuleResult = {
  ruleId: string;
  target: string;
  summary: string;
  passed: boolean;
  ratio: number;
  threshold: number;
  foreground: { token: string; hex: string; cssVariable: string };
  background: { token: string; hex: string; cssVariable: string };
  hint?: string;
};

type A11yReport = {
  generatedAt: string;
  tokenSource: string | null;
  summary: {
    totalChecks: number;
    passed: number;
    failed: number;
    complianceStatus: 'compliant' | 'non-compliant';
  };
  rules: RuleResult[];
  components?: string[];
};

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function collectComponents(schema: UiSchema): string[] {
  const names = new Set<string>();
  function walk(el: UiElement) {
    names.add(el.component);
    if (Array.isArray(el.children)) {
      el.children.forEach(walk);
    }
  }
  if (Array.isArray(schema.screens)) {
    schema.screens.forEach(walk);
  }
  return [...names].sort();
}

function wcagLevel(threshold: number): string {
  return threshold >= 4.5 ? 'AA' : 'AA (large text/graphics)';
}

function mapEvaluation(ev: ContrastEvaluation): RuleResult {
  const result: RuleResult = {
    ruleId: ev.rule.ruleId,
    target: ev.rule.target,
    summary: ev.rule.summary,
    passed: ev.passed,
    ratio: Number.isFinite(ev.ratio) ? ev.ratio : -1,
    threshold: ev.threshold,
    foreground: {
      token: ev.foreground.key,
      hex: ev.foreground.value,
      cssVariable: ev.foreground.cssVariable,
    },
    background: {
      token: ev.background.key,
      hex: ev.background.value,
      cssVariable: ev.background.cssVariable,
    },
  };

  if (!ev.passed) {
    const ratioText = Number.isFinite(ev.ratio) ? `${ev.ratio}:1` : 'unmeasurable';
    result.hint = `${ev.rule.target} fails WCAG ${wcagLevel(ev.threshold)} — contrast ratio ${ratioText}, minimum ${ev.threshold}:1 required.`;
  }

  return result;
}

function buildInlineSummary(report: A11yReport): string {
  const { summary, rules } = report;
  const lines = [
    `A11y scan: ${summary.totalChecks} checks, ${summary.passed} passed, ${summary.failed} failed — ${summary.complianceStatus.toUpperCase()}.`,
  ];
  const failures = rules.filter((r) => !r.passed);
  if (failures.length > 0) {
    lines.push('Failures:');
    for (const f of failures) {
      lines.push(`  - ${f.ruleId}: ${f.hint ?? f.summary}`);
    }
  }
  if (report.components && report.components.length > 0) {
    lines.push(`Components in scope: ${report.components.length}`);
  }
  return lines.join('\n');
}

// ---------------------------------------------------------------------------
// Handler
// ---------------------------------------------------------------------------

export async function handle(input: A11yScanInput = {}): Promise<GenericOutput> {
  const policy = loadPolicy();
  const base = todayDir(policy.artifactsBase);
  const outDir = path.join(base, 'a11y.scan');
  const startedAt = new Date();
  const artifacts: string[] = [];

  // Load token data
  const tokenData = loadTokenData();
  if (!tokenData) {
    throw new Error('Token data could not be loaded from artifacts/structured-data/. Run pnpm refresh:data first.');
  }

  // Flatten and evaluate contrast rules
  const flatMap = flattenDTCGLayers(tokenData);
  const flatTokenMap = toFlatTokenMap(flatMap);
  const evaluations = evaluateContrastRules(flatTokenMap, {
    prefix: 'oods',
    rules: DEFAULT_CONTRAST_RULES,
  });

  // Build report
  const rules = evaluations.map(mapEvaluation);
  const passed = rules.filter((r) => r.passed).length;
  const failed = rules.filter((r) => !r.passed).length;

  const report: A11yReport = {
    generatedAt: startedAt.toISOString(),
    tokenSource: 'artifacts/structured-data/oods-tokens (via DTCG layers)',
    summary: {
      totalChecks: rules.length,
      passed,
      failed,
      complianceStatus: failed === 0 ? 'compliant' : 'non-compliant',
    },
    rules,
  };

  // Include component inventory if UiSchema provided
  if (input.schema) {
    report.components = collectComponents(input.schema);
  }

  // Write artifact if apply=true
  if (input.apply) {
    const file = path.join(outDir, 'a11y-report.json');
    if (!withinAllowed(policy.artifactsBase, file)) throw new Error('Path not allowed');
    fs.mkdirSync(outDir, { recursive: true });
    fs.writeFileSync(file, JSON.stringify(report, null, 2));
    artifacts.push(file);
  }

  const transcriptPath = writeTranscript(outDir, {
    tool: 'a11y.scan',
    input: { apply: input.apply, hasSchema: Boolean(input.schema) },
    apply: Boolean(input.apply),
    artifacts,
    startTime: startedAt,
    endTime: new Date(),
  });
  const bundleIndexPath = writeBundleIndex(outDir, [transcriptPath, ...artifacts]);

  return {
    artifacts,
    transcriptPath,
    bundleIndexPath,
    preview: {
      summary: buildInlineSummary(report),
      notes: failed > 0
        ? [`${failed} contrast check${failed === 1 ? '' : 's'} failed WCAG thresholds.`]
        : ['All contrast checks pass.'],
    },
  };
}
