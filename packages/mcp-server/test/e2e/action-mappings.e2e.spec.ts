/**
 * Sprint 88 / 88.1 — E2E integration test for Stage1 BridgeSummary → design.compose.
 *
 * Reads the real Stage1 run from the adjacent Stage1 repo:
 *   ../Stage1/out/oods-s88/stage1/linear-app/aa22b12d-bd6a-4e71-90e0-399954a36a70/artifacts/bridge_summary.json
 *
 * Stage1 BridgeSummary exposes two complementary feeds for the consumer:
 *   • summary.action_mappings[]   — verb→trait vocabulary
 *     entry shape: { orcaVerb, oodsTrait, suggestedAction }
 *   • actions[]                   — per-component action instances
 *     entry shape: { actionId, name, verb, sourceComponent, targetEntity, confidence, confidenceLabel }
 *
 * design.compose accepts both via `actionMappings` and `actionInstances`. Matching
 * requires that the composed object actually carries the trait named in
 * action_mappings; otherwise entries are filtered out and resolvedActions stays
 * empty (safe no-op).
 *
 * On this run, oodsTrait is "interactive" — none of our example objects carry
 * that trait today, so the real-data assertions verify: (a) the pipeline reads
 * the real shape without crashing, (b) alias fields (orcaVerb, suggestedAction)
 * are accepted, (c) filtered-out no-match path produces a clean output.
 * Synthetic lifecycle coverage (Archivable/Cancellable) remains so we keep
 * regression coverage of the full matching path.
 */
import { describe, it, expect } from 'vitest';
import { readFileSync, existsSync } from 'node:fs';
import { resolve } from 'node:path';
import { handle as pipelineHandle } from '../../src/tools/pipeline.js';
import type { ActionMapping, ActionInstance } from '../../src/tools/design.compose.js';
import type { UiElement, UiSchema } from '../../src/schemas/generated.js';

const STAGE1_BRIDGE_SUMMARY = resolve(
  __dirname,
  '../../../../../Stage1/out/oods-s88/stage1/linear-app/aa22b12d-bd6a-4e71-90e0-399954a36a70/artifacts/bridge_summary.json',
);

function loadStage1BridgeSummary(): {
  action_mappings: ActionMapping[];
  actions: ActionInstance[];
} | null {
  if (!existsSync(STAGE1_BRIDGE_SUMMARY)) return null;
  const raw = JSON.parse(readFileSync(STAGE1_BRIDGE_SUMMARY, 'utf8'));
  return {
    action_mappings: raw.summary?.action_mappings ?? [],
    actions: raw.actions ?? [],
  };
}

// Synthetic lifecycle fixture — kept so matching path retains regression coverage
// regardless of whether Stage1 emits lifecycle traits on a given run.
const syntheticLifecycleMappings: ActionMapping[] = [
  { verb: 'cancel',     oodsTrait: 'Cancellable',          object: 'Subscription', slot: 'actions', confidence: 0.88 },
  { verb: 'reactivate', oodsTrait: 'lifecycle/Cancellable', object: 'Subscription', slot: 'actions', confidence: 0.72 },
  { verb: 'transition', oodsTrait: 'Stateful',             object: 'Subscription', slot: 'actions', confidence: 0.81 },
  { verb: 'archive',    oodsTrait: 'Archivable',           object: 'Subscription', slot: 'actions', confidence: 0.75 },
];

function collectActions(schema: UiSchema): Record<string, string[]> {
  const out: Record<string, string[]> = {};
  const walk = (el: UiElement) => {
    if (Array.isArray(el.props?.actions)) {
      const slotIntent = typeof el.meta?.intent === 'string' && el.meta.intent.startsWith('slot:')
        ? el.meta.intent.slice(5)
        : el.component;
      out[slotIntent] = el.props.actions as string[];
    }
    el.children?.forEach(walk);
  };
  schema.screens.forEach(walk);
  return out;
}

describe('E2E — Stage1 BridgeSummary → pipeline → design.compose', () => {
  it('reconciles synthetic lifecycle action_mappings against composed Subscription', async () => {
    const result = await pipelineHandle({
      object: 'Subscription',
      context: 'detail',
      actionMappings: syntheticLifecycleMappings,
      options: { skipRender: true },
    });

    expect(result.error).toBeUndefined();
    expect(result.compose.object).toBe('Subscription');

    const resolved = result.compose.resolvedActions ?? [];
    const resolvedTraits = resolved.map(r => r.trait);
    expect(resolvedTraits).toContain('Cancellable');
    expect(resolvedTraits).toContain('Stateful');
    expect(resolvedTraits).not.toContain('Archivable'); // not carried by Subscription

    expect(resolved.find(r => r.trait === 'Cancellable')?.verbs).toEqual(['cancel', 'reactivate']);
    expect(resolved.find(r => r.trait === 'Stateful')?.verbs).toEqual(['transition']);
  });

  it('empty action_mappings is a safe no-op through the pipeline', async () => {
    const result = await pipelineHandle({
      object: 'Subscription',
      context: 'detail',
      actionMappings: [],
      options: { skipRender: true },
    });

    expect(result.error).toBeUndefined();
    expect(result.compose.resolvedActions).toBeUndefined();
  });

  it('absent action_mappings preserves pre-Sprint-88 pipeline output shape', async () => {
    const baseline = await pipelineHandle({
      object: 'Subscription',
      context: 'detail',
      options: { skipRender: true },
    });
    expect(baseline.error).toBeUndefined();
    expect(baseline.compose.resolvedActions).toBeUndefined();
  });
});

describe('E2E — real Stage1 linear.app BridgeSummary (run aa22b12d)', () => {
  const bridge = loadStage1BridgeSummary();

  it.runIf(bridge !== null)('bridge_summary.json is on disk and has expected top-level shape', () => {
    expect(bridge).not.toBeNull();
    expect(Array.isArray(bridge!.action_mappings)).toBe(true);
    expect(Array.isArray(bridge!.actions)).toBe(true);
    // Sanity: fixture shape assumptions the consumer depends on.
    for (const m of bridge!.action_mappings) {
      expect(typeof (m.orcaVerb ?? m.verb)).toBe('string');
      expect(typeof (m.oodsTrait ?? m.trait)).toBe('string');
    }
    for (const a of bridge!.actions) {
      expect(typeof a.verb).toBe('string');
    }
  });

  it.runIf(bridge !== null)('accepts Stage1 alias fields (orcaVerb, suggestedAction) without crashing', async () => {
    const result = await pipelineHandle({
      object: 'Subscription',
      context: 'detail',
      actionMappings: bridge!.action_mappings,
      actionInstances: bridge!.actions,
      options: { skipRender: true },
    });

    expect(result.error).toBeUndefined();
    expect(result.compose.object).toBe('Subscription');
    // On this run oodsTrait is "interactive" — Subscription doesn't carry it,
    // so resolvedActions is either absent or an empty array. Either is valid.
    const resolved = result.compose.resolvedActions ?? [];
    expect(resolved.every(r => typeof r.trait === 'string' && Array.isArray(r.verbs))).toBe(true);
    // No example object in the repo carries the "interactive" trait today —
    // document the current state so the assertion flips when one does.
    expect(resolved.find(r => r.trait === 'interactive')).toBeUndefined();
  });

  it.runIf(bridge !== null)('merging real actionInstances with a synthetic vocabulary that includes Subscription traits produces per-slot actions', async () => {
    // Stage1 emits verbs "submit"/"toggle" on per-component instances. Compose a
    // vocabulary that maps those verbs onto a trait Subscription actually carries
    // (Stateful) to prove the merge path wires instances → resolvedActions.
    const vocabulary: ActionMapping[] = [
      { verb: 'submit', oodsTrait: 'Stateful' },
      { verb: 'toggle', oodsTrait: 'Stateful' },
    ];
    const result = await pipelineHandle({
      object: 'Subscription',
      context: 'detail',
      actionMappings: vocabulary,
      actionInstances: bridge!.actions,
      options: { skipRender: true },
    });

    expect(result.error).toBeUndefined();
    const resolved = result.compose.resolvedActions ?? [];
    const stateful = resolved.find(r => r.trait === 'Stateful');
    expect(stateful).toBeDefined();
    // Instances contribute both verbs.
    expect(stateful!.verbs).toEqual(expect.arrayContaining(['submit', 'toggle']));
  });
});
