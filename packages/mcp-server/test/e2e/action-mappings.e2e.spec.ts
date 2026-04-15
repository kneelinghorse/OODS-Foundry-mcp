/**
 * Sprint 88 — E2E integration test for Stage1 action_mappings → design.compose.
 *
 * Mirrors the reconciliation pipeline:
 *   Stage1 BridgeSummary (action_mappings[])
 *     → pipeline.handle({ object, actionMappings })
 *     → output.compose.resolvedActions + per-node props.actions
 *
 * Baseline fixture: synthetic reconciliation output modeled on Stage1 run 6d75dde3
 * (linear.app, S38). The fresh linear.app run requested 2026-04-15 will replace
 * this fixture when the artifact arrives.
 *
 * Subscription in examples/objects/Subscription.object.yaml carries
 * lifecycle/Stateful and lifecycle/Cancellable. Mappings can be keyed by the
 * unqualified trait name ("Cancellable") or the path-qualified form
 * ("lifecycle/Cancellable") — the consumer matches on the final segment.
 */
import { describe, it, expect } from 'vitest';
import { handle as pipelineHandle } from '../../src/tools/pipeline.js';
import type { ActionMapping } from '../../src/tools/design.compose.js';
import type { UiElement, UiSchema } from '../../src/schemas/generated.js';

// Synthetic Stage1 BridgeSummary.action_mappings[] (flat verb-keyed, per contract §2c)
const stage1BridgeSummary: { action_mappings: ActionMapping[] } = {
  action_mappings: [
    {
      verb: 'cancel',
      oodsTrait: 'Cancellable',
      object: 'Subscription',
      slot: 'actions',
      confidence: 0.88,
    },
    {
      verb: 'reactivate',
      oodsTrait: 'lifecycle/Cancellable', // path-qualified form also accepted
      object: 'Subscription',
      slot: 'actions',
      confidence: 0.72,
    },
    {
      verb: 'transition',
      oodsTrait: 'Stateful',
      object: 'Subscription',
      slot: 'actions',
      confidence: 0.81,
    },
    // Trait not carried by Subscription — must be filtered out by consumer.
    {
      verb: 'archive',
      oodsTrait: 'Archivable',
      object: 'Subscription',
      slot: 'actions',
      confidence: 0.75,
    },
  ],
};

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

describe('E2E — Stage1 action_mappings → pipeline → design.compose', () => {
  it('reconciles action_mappings against composed Subscription and annotates output', async () => {
    const result = await pipelineHandle({
      object: 'Subscription',
      context: 'detail',
      actionMappings: stage1BridgeSummary.action_mappings,
      options: { skipRender: true },
    });

    // Pipeline succeeded
    expect(result.error).toBeUndefined();
    expect(result.compose.object).toBe('Subscription');

    // resolvedActions is present and filtered to traits actually on the object
    const resolved = result.compose.resolvedActions ?? [];
    const resolvedTraits = resolved.map(r => r.trait);
    expect(resolvedTraits).toContain('Cancellable');
    expect(resolvedTraits).toContain('Stateful');
    expect(resolvedTraits).not.toContain('Archivable'); // filtered — not on Subscription

    const cancellableVerbs = resolved.find(r => r.trait === 'Cancellable')?.verbs ?? [];
    expect(cancellableVerbs).toEqual(['cancel', 'reactivate']);
    const statefulVerbs = resolved.find(r => r.trait === 'Stateful')?.verbs ?? [];
    expect(statefulVerbs).toEqual(['transition']);
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
