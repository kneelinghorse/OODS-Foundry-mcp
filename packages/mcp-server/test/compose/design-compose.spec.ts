/**
 * Contract tests for the design.compose MCP tool (s51-m03).
 *
 * Validates:
 * 1. design.compose registered and callable
 * 2. Intent 'dashboard with metrics and sidebar' → valid dashboard UiSchema
 * 3. Intent 'user registration form' → form layout with input components
 * 4. Auto-validate: returned schema passes repl.validate
 * 5. Component selections include reasoning
 * 6. Layout auto-detection from intent keywords
 * 7. Error handling for edge cases
 */
import { describe, it, expect } from 'vitest';
import { handle } from '../../src/tools/design.compose.js';
import type { DesignComposeOutput } from '../../src/tools/design.compose.js';

/* ------------------------------------------------------------------ */
/*  Helpers                                                            */
/* ------------------------------------------------------------------ */

function slotNames(output: DesignComposeOutput): string[] {
  return output.selections.map(s => s.slotName);
}

/* ------------------------------------------------------------------ */
/*  Core handler contracts                                             */
/* ------------------------------------------------------------------ */

describe('design.compose — core contracts', () => {
  it('handler is callable', async () => {
    const result = await handle({ intent: 'dashboard' });
    expect(result).toBeTruthy();
    expect(result.status).toBe('ok');
  });

  it('returns required output fields', async () => {
    const result = await handle({ intent: 'simple dashboard' });
    expect(result.status).toBeDefined();
    expect(result.layout).toBeDefined();
    expect(result.schema).toBeDefined();
    expect(result.selections).toBeInstanceOf(Array);
    expect(result.warnings).toBeInstanceOf(Array);
  });

  it('schema has version and screens', async () => {
    const result = await handle({ intent: 'dashboard with metrics' });
    expect(result.schema.version).toBe('2026.02');
    expect(result.schema.screens).toHaveLength(1);
  });

  it('includes meta with intent and layout info', async () => {
    const result = await handle({ intent: 'dashboard with metrics' });
    expect(result.meta).toBeTruthy();
    expect(result.meta!.intentParsed).toBeTruthy();
    expect(result.meta!.layoutDetected).toBeTruthy();
    expect(result.meta!.slotCount).toBeGreaterThan(0);
    expect(result.meta!.nodeCount).toBeGreaterThan(0);
  });
});

/* ------------------------------------------------------------------ */
/*  Layout auto-detection                                              */
/* ------------------------------------------------------------------ */

describe('design.compose — layout auto-detection', () => {
  it('"dashboard with metrics and sidebar" → dashboard layout', async () => {
    const result = await handle({ intent: 'dashboard with metrics and sidebar' });
    expect(result.layout).toBe('dashboard');
  });

  it('"user registration form" → form layout', async () => {
    const result = await handle({ intent: 'user registration form' });
    expect(result.layout).toBe('form');
  });

  it('"product detail page with tabs" → detail layout', async () => {
    const result = await handle({ intent: 'product detail page with tabs' });
    expect(result.layout).toBe('detail');
  });

  it('"searchable inventory list" → list layout', async () => {
    const result = await handle({ intent: 'searchable inventory list' });
    expect(result.layout).toBe('list');
  });

  it('"browse catalog" → list layout', async () => {
    const result = await handle({ intent: 'browse catalog' });
    expect(result.layout).toBe('list');
  });

  it('"analytics overview" → dashboard layout', async () => {
    const result = await handle({ intent: 'analytics overview' });
    expect(result.layout).toBe('dashboard');
  });

  it('"configure settings" → form layout', async () => {
    const result = await handle({ intent: 'configure settings' });
    expect(result.layout).toBe('form');
  });

  it('explicit layout overrides auto-detection', async () => {
    const result = await handle({ intent: 'some generic UI', layout: 'form' });
    expect(result.layout).toBe('form');
  });

  it('unknown intent defaults to dashboard with low confidence warning', async () => {
    const result = await handle({ intent: 'something completely unrelated xyz' });
    expect(result.layout).toBe('dashboard');
    expect(result.warnings.some(w => w.code === 'LOW_LAYOUT_CONFIDENCE')).toBe(true);
  });
});

/* ------------------------------------------------------------------ */
/*  Dashboard intent                                                   */
/* ------------------------------------------------------------------ */

describe('design.compose — dashboard intent', () => {
  it('produces valid UiSchema that passes validation', async () => {
    const result = await handle({ intent: 'dashboard with metrics and sidebar' });
    expect(result.status).toBe('ok');
    expect(result.validation?.status).toBe('ok');
    expect(result.validation?.errors).toHaveLength(0);
  });

  it('includes header, metrics, main-content, sidebar slots', async () => {
    const result = await handle({ intent: 'dashboard with metrics and sidebar' });
    const names = slotNames(result);
    expect(names).toContain('header');
    expect(names).toContain('metrics');
    expect(names).toContain('main-content');
    expect(names).toContain('sidebar');
  });

  it('each selection has candidates with reasoning', async () => {
    const result = await handle({ intent: 'dashboard with metrics and sidebar' });
    for (const sel of result.selections) {
      expect(sel.candidates.length).toBeGreaterThan(0);
      expect(sel.candidates[0].reason).toBeTruthy();
      expect(sel.candidates[0].confidence).toBeGreaterThan(0);
    }
  });

  it('respects metricColumns preference', async () => {
    const result = await handle({
      intent: 'dashboard',
      layout: 'dashboard',
      preferences: { metricColumns: 2 },
    });
    expect(result.status).toBe('ok');
    // The Grid node should have columns=2
    const json = JSON.stringify(result.schema);
    expect(json).toContain('"columns":2');
  });
});

/* ------------------------------------------------------------------ */
/*  Form intent                                                        */
/* ------------------------------------------------------------------ */

describe('design.compose — form intent', () => {
  it('"user registration form" produces form layout with inputs', async () => {
    const result = await handle({ intent: 'user registration form' });
    expect(result.status).toBe('ok');
    expect(result.layout).toBe('form');
    expect(result.validation?.status).toBe('ok');

    // Should have form-related slots
    const names = slotNames(result);
    expect(names).toContain('title');
    expect(names).toContain('actions');
    // Field slots
    expect(names.some(n => n.startsWith('field-'))).toBe(true);
  });

  it('field slot selections prefer Input or Select', async () => {
    const result = await handle({ intent: 'create new account form' });
    const fieldSelections = result.selections.filter(s => s.slotName.startsWith('field-'));
    expect(fieldSelections.length).toBeGreaterThan(0);
    for (const sel of fieldSelections) {
      const topNames = sel.candidates.slice(0, 3).map(c => c.name);
      expect(
        topNames.some(n => n === 'Input' || n === 'Select' || n === 'TagInput'),
        `Expected Input/Select/TagInput in field candidates, got ${topNames.join(', ')}`,
      ).toBe(true);
    }
  });

  it('respects fieldGroups preference', async () => {
    const r3 = await handle({ intent: 'form', layout: 'form', preferences: { fieldGroups: 3 } });
    const r5 = await handle({ intent: 'form', layout: 'form', preferences: { fieldGroups: 5 } });
    const fields3 = r3.selections.filter(s => s.slotName.startsWith('field-')).length;
    const fields5 = r5.selections.filter(s => s.slotName.startsWith('field-')).length;
    expect(fields5).toBeGreaterThan(fields3);
  });
});

/* ------------------------------------------------------------------ */
/*  Detail intent                                                      */
/* ------------------------------------------------------------------ */

describe('design.compose — detail intent', () => {
  it('"product detail page" produces detail layout', async () => {
    const result = await handle({ intent: 'product detail page' });
    expect(result.layout).toBe('detail');
    expect(result.validation?.status).toBe('ok');
  });

  it('includes tab slots', async () => {
    const result = await handle({ intent: 'user profile detail view' });
    const names = slotNames(result);
    expect(names.some(n => n.startsWith('tab-'))).toBe(true);
  });

  it('respects tabLabels preference', async () => {
    const result = await handle({
      intent: 'detail',
      layout: 'detail',
      preferences: { tabLabels: ['Overview', 'History'] },
    });
    expect(result.status).toBe('ok');
    const json = JSON.stringify(result.schema);
    expect(json).toContain('Overview');
    expect(json).toContain('History');
  });
});

/* ------------------------------------------------------------------ */
/*  List intent                                                        */
/* ------------------------------------------------------------------ */

describe('design.compose — list intent', () => {
  it('"searchable inventory list" produces list layout', async () => {
    const result = await handle({ intent: 'searchable inventory list' });
    expect(result.layout).toBe('list');
    expect(result.validation?.status).toBe('ok');
  });

  it('includes search, filters, items, pagination slots', async () => {
    const result = await handle({ intent: 'browse product catalog' });
    const names = slotNames(result);
    expect(names).toContain('items');
    expect(names).toContain('search');
    expect(names).toContain('filters');
    expect(names).toContain('pagination');
  });
});

/* ------------------------------------------------------------------ */
/*  Component overrides                                                */
/* ------------------------------------------------------------------ */

describe('design.compose — component overrides', () => {
  it('respects componentOverrides in preferences', async () => {
    const result = await handle({
      intent: 'list',
      layout: 'list',
      preferences: { componentOverrides: { items: 'Table' } },
    });
    const itemsSel = result.selections.find(s => s.slotName === 'items');
    expect(itemsSel).toBeTruthy();
    expect(itemsSel!.selectedComponent).toBe('Table');
    expect(itemsSel!.candidates[0].reason).toContain('user override');
  });
});

/* ------------------------------------------------------------------ */
/*  Validation toggle                                                  */
/* ------------------------------------------------------------------ */

describe('design.compose — validation', () => {
  it('validation is on by default', async () => {
    const result = await handle({ intent: 'dashboard' });
    expect(result.validation).toBeTruthy();
    expect(result.validation!.status).not.toBe('skipped');
  });

  it('validation can be skipped', async () => {
    const result = await handle({
      intent: 'dashboard',
      options: { validate: false },
    });
    expect(result.validation?.status).toBe('skipped');
  });

  it('all 4 layouts produce valid schemas', async () => {
    for (const layout of ['dashboard', 'form', 'detail', 'list'] as const) {
      const result = await handle({ intent: layout, layout });
      expect(result.validation?.status, `${layout} validation failed`).toBe('ok');
      expect(result.validation?.errors, `${layout} has validation errors`).toHaveLength(0);
    }
  });
});

/* ------------------------------------------------------------------ */
/*  Theme preference                                                   */
/* ------------------------------------------------------------------ */

describe('design.compose — theme', () => {
  it('applies theme when provided', async () => {
    const result = await handle({
      intent: 'dashboard',
      layout: 'dashboard',
      preferences: { theme: 'dark' },
    });
    expect(result.schema.theme).toBe('dark');
  });
});
