/**
 * Contract tests for the object slot filler (s62-m03).
 *
 * Validates:
 * 1. fillSlotsWithObject maps SlotPlan entries to template slots
 * 2. Position-based heuristic: top→header, main→main-content/tabs, bottom→footer, sidebar→sidebar
 * 3. Multiple entries in same slot stacked as children by priority
 * 4. Component existence validated against catalog
 * 5. Unfilled required slots fall back to selectComponent()
 * 6. Trait-defined props written into UiElement.props
 * 7. componentOverrides from preferences override view_extension placement
 */
import { describe, it, expect, beforeEach } from 'vitest';
import { fillSlotsWithObject, type FillResult } from '../../src/compose/object-slot-filler.js';
import { collectViewExtensions, type SlotPlan } from '../../src/compose/view-extension-collector.js';
import { loadObject } from '../../src/objects/object-loader.js';
import { composeObject, type ComposedObject } from '../../src/objects/trait-composer.js';
import { detailTemplate } from '../../src/compose/templates/detail.js';
import { listTemplate } from '../../src/compose/templates/list.js';
import { dashboardTemplate } from '../../src/compose/templates/dashboard.js';
import { formTemplate } from '../../src/compose/templates/form.js';
import { resetIdCounter, type TemplateResult } from '../../src/compose/templates/types.js';
import { loadCatalog } from '../../src/compose/component-selector.js';
import type { ComponentCatalogSummary } from '../../src/tools/types.js';
import type { UiElement } from '../../src/schemas/generated.js';

/* ------------------------------------------------------------------ */
/*  Helpers                                                            */
/* ------------------------------------------------------------------ */

let catalog: ComponentCatalogSummary[];
let subscription: ComposedObject;

beforeEach(async () => {
  catalog = await loadCatalog();
  subscription = composeObject(loadObject('Subscription'));
});

function getDetailTemplate(): TemplateResult {
  resetIdCounter();
  return detailTemplate({ tabCount: 3, tabLabels: ['Overview', 'History', 'Settings'] });
}

function findAllElements(result: FillResult, predicate: (el: UiElement) => boolean): UiElement[] {
  const found: UiElement[] = [];
  const walk = (el: UiElement) => {
    if (predicate(el)) found.push(el);
    el.children?.forEach(walk);
  };
  result.schema.screens.forEach(walk);
  return found;
}

/* ------------------------------------------------------------------ */
/*  Core placement contracts                                           */
/* ------------------------------------------------------------------ */

describe('fillSlotsWithObject — core placement', () => {
  it('returns schema, placements, and warnings', () => {
    const template = getDetailTemplate();
    const { plan } = collectViewExtensions(subscription, 'detail');
    const result = fillSlotsWithObject(template, plan, catalog);

    expect(result.schema).toBeDefined();
    expect(result.schema.screens).toHaveLength(1);
    expect(result.placements).toBeInstanceOf(Array);
    expect(result.warnings).toBeInstanceOf(Array);
  });

  it('placements contain slot filling decisions', () => {
    const template = getDetailTemplate();
    const { plan } = collectViewExtensions(subscription, 'detail');
    const result = fillSlotsWithObject(template, plan, catalog);

    expect(result.placements.length).toBeGreaterThan(0);
    for (const p of result.placements) {
      expect(p.slotName).toBeTruthy();
      expect(['view_extension', 'override', 'fallback']).toContain(p.source);
      expect(p.components.length).toBeGreaterThan(0);
    }
  });
});

/* ------------------------------------------------------------------ */
/*  Position heuristics                                                */
/* ------------------------------------------------------------------ */

describe('fillSlotsWithObject — position heuristics', () => {
  it('position=top maps to header slot', () => {
    const template = getDetailTemplate();
    const topPlan: SlotPlan[] = [{
      component: 'StatusTimeline',
      sourceTrait: 'lifecycle/Stateful',
      position: 'top',
      priority: 40,
      props: { field: 'status' },
    }];
    const result = fillSlotsWithObject(template, topPlan, catalog);
    const headerPlacement = result.placements.find((p) => p.slotName === 'header');
    expect(headerPlacement).toBeDefined();
    expect(headerPlacement!.components).toContain('StatusTimeline');
  });

  it('position=main distributes to tab slots in detail template', () => {
    const template = getDetailTemplate();
    const mainPlan: SlotPlan[] = [
      { component: 'CompA', sourceTrait: 'trait-a', position: 'main', priority: 10, props: {} },
      { component: 'CompB', sourceTrait: 'trait-b', position: 'main', priority: 5, props: {} },
    ];
    const result = fillSlotsWithObject(template, mainPlan, catalog);

    const tabPlacements = result.placements.filter((p) => p.slotName.startsWith('tab-'));
    expect(tabPlacements.length).toBeGreaterThan(0);
  });

  it('position=sidebar maps to metadata slot in detail template', () => {
    const template = getDetailTemplate();
    const sidebarPlan: SlotPlan[] = [{
      component: 'MetadataPanel',
      sourceTrait: 'core/Classifiable',
      position: 'sidebar',
      priority: 0,
      props: {},
    }];
    const result = fillSlotsWithObject(template, sidebarPlan, catalog);
    const metaPlacement = result.placements.find((p) => p.slotName === 'metadata');
    expect(metaPlacement).toBeDefined();
    expect(metaPlacement!.components).toContain('MetadataPanel');
  });
});

/* ------------------------------------------------------------------ */
/*  Stacking behavior                                                  */
/* ------------------------------------------------------------------ */

describe('fillSlotsWithObject — stacking', () => {
  it('multiple entries targeting same slot are stacked', () => {
    const template = getDetailTemplate();
    const plan: SlotPlan[] = [
      { component: 'StatusBadge', sourceTrait: 'trait-a', position: 'top', priority: 20, props: {} },
      { component: 'AlertBanner', sourceTrait: 'trait-b', position: 'top', priority: 10, props: {} },
    ];
    const result = fillSlotsWithObject(template, plan, catalog);
    const headerPlacement = result.placements.find((p) => p.slotName === 'header');
    expect(headerPlacement).toBeDefined();
    expect(headerPlacement!.components).toHaveLength(2);
    expect(headerPlacement!.components).toContain('StatusBadge');
    expect(headerPlacement!.components).toContain('AlertBanner');
  });

  it('stacked elements wrapped in Stack container', () => {
    const template = getDetailTemplate();
    const plan: SlotPlan[] = [
      { component: 'CompA', sourceTrait: 'trait-a', position: 'top', priority: 20, props: {} },
      { component: 'CompB', sourceTrait: 'trait-b', position: 'top', priority: 10, props: {} },
    ];
    const result = fillSlotsWithObject(template, plan, catalog);

    // Find the header slot element — it should be a Stack with 2 children
    const stacks = findAllElements(result, (el) =>
      el.component === 'Stack' && (el.children?.length ?? 0) >= 2 &&
      el.children!.some((c) => c.component === 'CompA') &&
      el.children!.some((c) => c.component === 'CompB'),
    );
    expect(stacks.length).toBeGreaterThan(0);
  });
});

/* ------------------------------------------------------------------ */
/*  Catalog validation                                                 */
/* ------------------------------------------------------------------ */

describe('fillSlotsWithObject — catalog validation', () => {
  it('warns when component not in catalog', () => {
    const template = getDetailTemplate();
    const plan: SlotPlan[] = [{
      component: 'FakeComponent',
      sourceTrait: 'test/Fake',
      position: 'top',
      priority: 0,
      props: {},
    }];
    const result = fillSlotsWithObject(template, plan, catalog);
    expect(result.warnings.some((w) => w.includes('FakeComponent'))).toBe(true);
  });
});

/* ------------------------------------------------------------------ */
/*  Fallback behavior                                                  */
/* ------------------------------------------------------------------ */

describe('fillSlotsWithObject — fallback', () => {
  it('unfilled required slots fall back to selectComponent', () => {
    const template = getDetailTemplate();
    // Empty plan — no view extensions
    const result = fillSlotsWithObject(template, [], catalog, undefined, 'subscription detail');

    // header is required and should be filled via fallback
    const headerPlacement = result.placements.find((p) => p.slotName === 'header');
    expect(headerPlacement).toBeDefined();
    expect(headerPlacement!.source).toBe('fallback');
    expect(headerPlacement!.components.length).toBeGreaterThan(0);
  });
});

/* ------------------------------------------------------------------ */
/*  Props propagation                                                  */
/* ------------------------------------------------------------------ */

describe('fillSlotsWithObject — props', () => {
  it('trait-defined props written into UiElement.props', () => {
    const template = getDetailTemplate();
    const plan: SlotPlan[] = [{
      component: 'StatusTimeline',
      sourceTrait: 'lifecycle/Stateful',
      position: 'top',
      priority: 40,
      props: { field: 'status', historyField: 'state_history' },
    }];
    const result = fillSlotsWithObject(template, plan, catalog);

    const elements = findAllElements(result, (el) => el.component === 'StatusTimeline');
    expect(elements.length).toBeGreaterThan(0);
    expect(elements[0].props).toHaveProperty('field', 'status');
    expect(elements[0].props).toHaveProperty('historyField', 'state_history');
  });
});

/* ------------------------------------------------------------------ */
/*  Component overrides                                                */
/* ------------------------------------------------------------------ */

describe('fillSlotsWithObject — componentOverrides', () => {
  it('overrides take precedence over view_extension placement', () => {
    const template = getDetailTemplate();
    const plan: SlotPlan[] = [{
      component: 'StatusTimeline',
      sourceTrait: 'lifecycle/Stateful',
      position: 'top',
      priority: 40,
      props: { field: 'status' },
    }];
    const overrides = { header: 'CustomHeader' };
    const result = fillSlotsWithObject(template, plan, catalog, overrides);

    const headerPlacement = result.placements.find((p) => p.slotName === 'header');
    expect(headerPlacement).toBeDefined();
    expect(headerPlacement!.source).toBe('override');
    expect(headerPlacement!.components).toEqual(['CustomHeader']);
  });

  it('non-overridden slots still filled by view_extensions', () => {
    const template = getDetailTemplate();
    const { plan } = collectViewExtensions(subscription, 'detail');
    const overrides = { header: 'CustomHeader' };
    const result = fillSlotsWithObject(template, plan, catalog, overrides);

    // At least one non-override placement should exist
    const veOrFallback = result.placements.filter((p) => p.source !== 'override');
    expect(veOrFallback.length).toBeGreaterThan(0);
  });
});

/* ------------------------------------------------------------------ */
/*  Integration: real object data                                      */
/* ------------------------------------------------------------------ */

describe('fillSlotsWithObject — integration with Subscription', () => {
  it('fills detail template from Subscription view_extensions', () => {
    const template = getDetailTemplate();
    const { plan } = collectViewExtensions(subscription, 'detail');
    const result = fillSlotsWithObject(template, plan, catalog);

    expect(result.schema.screens).toHaveLength(1);
    expect(result.placements.length).toBeGreaterThan(0);
  });

  it('fills list template from Subscription view_extensions', () => {
    resetIdCounter();
    const template = listTemplate({});
    const { plan } = collectViewExtensions(subscription, 'list');
    const result = fillSlotsWithObject(template, plan, catalog);

    expect(result.schema.screens).toHaveLength(1);
    expect(result.placements.length).toBeGreaterThan(0);
  });
});
