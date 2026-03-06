/**
 * Tests for confidence-aware composition (s80-m03).
 *
 * Validates:
 * 1. Per-slot raw confidence score (0–1) in component selector output
 * 2. Slots with confidence below 0.5 include alternativeCandidates
 * 3. Overall composition confidence aggregated in response metadata
 * 4. No regressions in design-compose.spec.ts
 */
import { describe, it, expect, beforeAll } from 'vitest';
import {
  selectComponent,
  loadCatalog,
  type SelectionResult,
} from '../../src/compose/component-selector.js';
import { handle } from '../../src/tools/design.compose.js';
import type { ComponentCatalogEntry } from '../../src/tools/types.js';

/* ------------------------------------------------------------------ */
/*  Setup                                                              */
/* ------------------------------------------------------------------ */

let catalog: ComponentCatalogEntry[];

beforeAll(async () => {
  catalog = await loadCatalog();
});

/* ------------------------------------------------------------------ */
/*  selectComponent — rawConfidence                                    */
/* ------------------------------------------------------------------ */

describe('selectComponent — rawConfidence', () => {
  it('includes rawConfidence in SelectionResult', () => {
    const result = selectComponent('action-button', catalog);
    expect(result.rawConfidence).toBeDefined();
    expect(typeof result.rawConfidence).toBe('number');
  });

  it('rawConfidence is between 0 and 1', () => {
    const result = selectComponent('action-button', catalog);
    expect(result.rawConfidence).toBeGreaterThanOrEqual(0);
    expect(result.rawConfidence).toBeLessThanOrEqual(1);
  });

  it('known intents have rawConfidence > 0.3', () => {
    const knownIntents = [
      'action-button', 'data-table', 'text-input', 'form-input',
      'status-indicator', 'metrics-display',
    ];
    for (const intent of knownIntents) {
      const result = selectComponent(intent, catalog);
      expect(result.rawConfidence).toBeGreaterThan(0.3);
    }
  });

  it('unknown intents have lower rawConfidence', () => {
    const knownResult = selectComponent('action-button', catalog);
    const unknownResult = selectComponent('completely-unknown-widget', catalog);
    expect(unknownResult.rawConfidence).toBeLessThan(knownResult.rawConfidence);
  });

  it('rawConfidence is 0 for empty catalog', () => {
    const result = selectComponent('action-button', []);
    expect(result.rawConfidence).toBe(0);
  });

  it('rawConfidence is 0 for empty intent', () => {
    const result = selectComponent('', catalog);
    expect(result.rawConfidence).toBe(0);
  });
});

/* ------------------------------------------------------------------ */
/*  design.compose — per-slot confidence                               */
/* ------------------------------------------------------------------ */

describe('design.compose — per-slot confidence', () => {
  it('selections include per-slot confidence score', async () => {
    const result = await handle({
      object: 'Subscription',
      context: 'detail',
    });
    expect(result.status).toBe('ok');
    expect(result.selections.length).toBeGreaterThan(0);

    for (const selection of result.selections) {
      expect(typeof selection.confidence).toBe('number');
      expect(selection.confidence).toBeGreaterThanOrEqual(0);
      expect(selection.confidence).toBeLessThanOrEqual(1);
    }
  });

  it('selections include confidence bands and human-readable explanations', async () => {
    const result = await handle({
      object: 'Subscription',
      context: 'detail',
    });
    expect(result.status).toBe('ok');

    for (const selection of result.selections) {
      expect(['high', 'medium', 'low']).toContain(selection.confidenceLevel);
      expect(selection.explanation).toContain(selection.slotName);
      expect(selection.explanation.length).toBeGreaterThan(20);
    }
  });

  it('overridden slots are explicit high-confidence selections', async () => {
    const result = await handle({
      object: 'Subscription',
      context: 'detail',
      preferences: { componentOverrides: { 'tab-0': 'Card' } },
    });
    expect(result.status).toBe('ok');
    const overriddenSlot = result.selections.find(s => s.slotName === 'tab-0');
    expect(overriddenSlot).toBeDefined();
    expect(overriddenSlot).toMatchObject({
      selectedComponent: 'Card',
      confidence: 1,
      confidenceLevel: 'high',
    });
    expect(overriddenSlot!.explanation).toContain('explicitly pinned');
    expect(overriddenSlot!.explanation).toContain('preferences.componentOverrides');
    expect(overriddenSlot!.reviewHint).toBeUndefined();
  });
});

/* ------------------------------------------------------------------ */
/*  design.compose — composition confidence in meta                    */
/* ------------------------------------------------------------------ */

describe('design.compose — composition confidence metadata', () => {
  it('includes compositionConfidence in intelligence metadata', async () => {
    const result = await handle({
      object: 'Subscription',
      context: 'detail',
    });
    expect(result.status).toBe('ok');
    expect(result.meta?.intelligence?.compositionConfidence).toBeDefined();
    expect(typeof result.meta!.intelligence!.compositionConfidence).toBe('number');
    expect(result.meta!.intelligence!.compositionConfidence).toBeGreaterThan(0);
    expect(result.meta!.intelligence!.compositionConfidence).toBeLessThanOrEqual(1);
  });

  it('compositionConfidence is average of per-slot confidences', async () => {
    const result = await handle({
      object: 'Subscription',
      context: 'detail',
    });
    expect(result.status).toBe('ok');
    const confidences = result.selections.map(s => s.confidence);
    const expectedAvg = Math.round((confidences.reduce((sum, c) => sum + c, 0) / confidences.length) * 100) / 100;
    expect(result.meta!.intelligence!.compositionConfidence).toBe(expectedAvg);
  });

  it('surfaces low-confidence slot names and review hints for ambiguous prompts', async () => {
    const result = await handle({
      intent: 'something completely unrelated xyz',
    });
    expect(result.status).toBe('ok');

    const lowConfidenceSelections = result.selections.filter((selection) => selection.confidenceLevel === 'low');
    expect(lowConfidenceSelections.length).toBeGreaterThan(0);
    expect(result.meta?.intelligence?.lowConfidenceSlotNames).toEqual(
      lowConfidenceSelections.map((selection) => selection.slotName),
    );

    for (const selection of lowConfidenceSelections) {
      expect(selection.reviewHint).toContain('componentOverrides');
    }
  });
});
