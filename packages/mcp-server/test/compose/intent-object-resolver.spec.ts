/**
 * Contract tests for intent-object resolver (s62-m06).
 *
 * Validates:
 * 1. intent + object: intent drives layout, object drives components
 * 2. object only: synthetic intent generated as '{name} {context} view'
 * 3. Intent auto-detection: object names recognized in intent string
 * 4. Context auto-detection: 'detail', 'list', 'form' extracted from intent
 * 5. Unknown object name returns error with closest-match suggestion
 * 6. Existing intent-only path completely unaffected
 */
import { describe, it, expect } from 'vitest';
import {
  resolveIntentObject,
  fuzzyMatchObject,
} from '../../src/compose/intent-object-resolver.js';
import { handle } from '../../src/tools/design.compose.js';

/* ------------------------------------------------------------------ */
/*  resolveIntentObject — unit tests                                   */
/* ------------------------------------------------------------------ */

describe('resolveIntentObject — explicit object + intent', () => {
  it('passes through explicit intent and object', () => {
    const result = resolveIntentObject('billing overview', 'Subscription', 'detail');
    expect(result.intent).toBe('billing overview');
    expect(result.object).toBe('Subscription');
    expect(result.context).toBe('detail');
    expect(result.objectSource).toBe('explicit');
    expect(result.contextSource).toBe('explicit');
    expect(result.intentSource).toBe('explicit');
  });

  it('intent drives layout, object is preserved for component selection', () => {
    const result = resolveIntentObject('dashboard metrics overview', 'Subscription', 'detail');
    // Intent has dashboard keywords — layout detection will pick dashboard
    // Object is preserved for view_extension placement
    expect(result.intent).toBe('dashboard metrics overview');
    expect(result.object).toBe('Subscription');
  });
});

describe('resolveIntentObject — object only (no intent)', () => {
  it('generates synthetic intent from object + context', () => {
    const result = resolveIntentObject(undefined, 'Subscription', 'detail');
    expect(result.intent).toBe('Subscription detail view');
    expect(result.intentSource).toBe('synthetic');
    expect(result.object).toBe('Subscription');
    expect(result.objectSource).toBe('explicit');
  });

  it('generates synthetic intent with default context when none provided', () => {
    const result = resolveIntentObject(undefined, 'User', undefined);
    expect(result.intent).toBe('User detail view');
    expect(result.intentSource).toBe('synthetic');
  });

  it('generates synthetic intent with list context', () => {
    const result = resolveIntentObject('', 'Product', 'list');
    expect(result.intent).toBe('Product list view');
    expect(result.intentSource).toBe('synthetic');
  });
});

describe('resolveIntentObject — auto-detect object from intent', () => {
  it('detects Subscription in intent string', () => {
    const result = resolveIntentObject('Subscription detail view', undefined, undefined);
    expect(result.object).toBe('Subscription');
    expect(result.objectSource).toBe('auto-detected');
  });

  it('detects User in intent string', () => {
    const result = resolveIntentObject('show User profile', undefined, undefined);
    expect(result.object).toBe('User');
    expect(result.objectSource).toBe('auto-detected');
  });

  it('case-insensitive detection', () => {
    const result = resolveIntentObject('subscription detail view', undefined, undefined);
    expect(result.object).toBe('Subscription');
    expect(result.objectSource).toBe('auto-detected');
  });

  it('does not auto-detect when explicit object is provided', () => {
    const result = resolveIntentObject('User profile view', 'Subscription', undefined);
    // Explicit object takes precedence
    expect(result.object).toBe('Subscription');
    expect(result.objectSource).toBe('explicit');
  });

  it('returns no object when intent has no known object names', () => {
    const result = resolveIntentObject('dashboard with metrics', undefined, undefined);
    expect(result.object).toBeUndefined();
    expect(result.objectSource).toBeUndefined();
  });
});

describe('resolveIntentObject — auto-detect context from intent', () => {
  it('detects detail context from "detail" keyword', () => {
    const result = resolveIntentObject('Subscription detail view', undefined, undefined);
    expect(result.context).toBe('detail');
    expect(result.contextSource).toBe('auto-detected');
  });

  it('detects list context from "list" keyword', () => {
    const result = resolveIntentObject('product list page', undefined, undefined);
    expect(result.context).toBe('list');
    expect(result.contextSource).toBe('auto-detected');
  });

  it('detects form context from "edit" keyword', () => {
    const result = resolveIntentObject('edit user form', undefined, undefined);
    expect(result.context).toBe('form');
    expect(result.contextSource).toBe('auto-detected');
  });

  it('detects list context from "table" keyword', () => {
    const result = resolveIntentObject('subscription table', undefined, undefined);
    expect(result.context).toBe('list');
    expect(result.contextSource).toBe('auto-detected');
  });

  it('does not auto-detect when explicit context is provided', () => {
    const result = resolveIntentObject('subscription table view', undefined, 'detail');
    expect(result.context).toBe('detail');
    expect(result.contextSource).toBe('explicit');
  });
});

/* ------------------------------------------------------------------ */
/*  fuzzyMatchObject                                                   */
/* ------------------------------------------------------------------ */

describe('fuzzyMatchObject', () => {
  it('suggests closest match for misspelled object', () => {
    const result = fuzzyMatchObject('Subscripion');
    expect(result).toBeDefined();
    expect(result!.match).toBe('Subscription');
    expect(result!.similarity).toBeGreaterThan(0.5);
  });

  it('suggests closest match for Usr → User', () => {
    const result = fuzzyMatchObject('Usr');
    expect(result).toBeDefined();
    expect(result!.match).toBe('User');
    expect(result!.similarity).toBeGreaterThan(0.4);
  });

  it('returns a result for completely unknown name', () => {
    const result = fuzzyMatchObject('Zzzzzzzzz');
    expect(result).toBeDefined();
    expect(result!.similarity).toBeLessThan(0.5);
  });
});

/* ------------------------------------------------------------------ */
/*  Integration: design.compose hybrid mode                            */
/* ------------------------------------------------------------------ */

describe('design.compose — hybrid mode (intent + object)', () => {
  it('intent drives layout, object drives objectUsed', async () => {
    const result = await handle({
      intent: 'billing overview',
      object: 'Subscription',
      context: 'detail',
    });
    expect(result.status).toBe('ok');
    expect(result.objectUsed).toBeDefined();
    expect(result.objectUsed!.name).toBe('Subscription');
  });

  it('dashboard intent with object still uses object data', async () => {
    const result = await handle({
      intent: 'dashboard metrics overview',
      object: 'Subscription',
      layout: 'dashboard',
    });
    expect(result.status).toBe('ok');
    expect(result.layout).toBe('dashboard');
    expect(result.objectUsed).toBeDefined();
    expect(result.objectUsed!.name).toBe('Subscription');
  });
});

describe('design.compose — object only (no intent)', () => {
  it('object + context generates synthetic intent and succeeds', async () => {
    const result = await handle({
      object: 'Subscription',
      context: 'detail',
    });
    expect(result.status).toBe('ok');
    expect(result.objectUsed).toBeDefined();
    expect(result.objectUsed!.name).toBe('Subscription');
    expect(result.meta!.intentSynthetic).toBe(true);
    expect(result.meta!.intentParsed).toBe('Subscription detail view');
  });

  it('object only (no context) defaults to detail', async () => {
    const result = await handle({
      object: 'User',
    });
    expect(result.status).toBe('ok');
    expect(result.objectUsed!.name).toBe('User');
    expect(result.meta!.intentSynthetic).toBe(true);
  });
});

describe('design.compose — intent auto-detection', () => {
  it('recognizes object name in intent and auto-detects', async () => {
    const result = await handle({
      intent: 'Subscription detail view',
    });
    expect(result.status).toBe('ok');
    expect(result.objectUsed).toBeDefined();
    expect(result.objectUsed!.name).toBe('Subscription');
    expect(result.meta!.objectAutoDetected).toBe('Subscription');
  });

  it('recognizes context in intent and auto-detects', async () => {
    const result = await handle({
      intent: 'Subscription detail view',
    });
    expect(result.meta!.contextAutoDetected).toBe('detail');
  });

  it('auto-detected object + context infers layout correctly', async () => {
    const result = await handle({
      intent: 'Subscription list page',
    });
    expect(result.status).toBe('ok');
    expect(result.objectUsed!.name).toBe('Subscription');
    expect(result.layout).toBe('list');
  });

  it('intent without object name falls through to intent-only path', async () => {
    const result = await handle({
      intent: 'dashboard with metrics and sidebar',
    });
    expect(result.status).toBe('ok');
    expect(result.layout).toBe('dashboard');
    expect(result.objectUsed).toBeUndefined();
  });
});

describe('design.compose — unknown object error with suggestion', () => {
  it('unknown object returns error with fuzzy suggestion', async () => {
    const result = await handle({
      intent: 'detail view',
      object: 'Subscripion',
      context: 'detail',
    });
    expect(result.status).toBe('error');
    expect(result.errors).toBeDefined();
    expect(result.errors!.some(e => e.code === 'OBJECT_LOAD_FAILED')).toBe(true);
    // Should suggest "Subscription" as closest match
    expect(result.errors![0].hint).toContain('Subscription');
    expect(result.errors![0].hint).toContain('Did you mean');
  });

  it('completely unknown name still returns error', async () => {
    const result = await handle({
      intent: 'detail view',
      object: 'Zzzzzzzzz',
      context: 'detail',
    });
    expect(result.status).toBe('error');
    expect(result.errors![0].code).toBe('OBJECT_LOAD_FAILED');
  });
});

describe('design.compose — backward compatibility (intent-only)', () => {
  it('intent-only path still works exactly as before', async () => {
    const result = await handle({ intent: 'dashboard with metrics and sidebar' });
    expect(result.status).toBe('ok');
    expect(result.layout).toBe('dashboard');
    expect(result.objectUsed).toBeUndefined();
  });

  it('form intent still works', async () => {
    const result = await handle({ intent: 'user registration form' });
    expect(result.status).toBe('ok');
    expect(result.layout).toBe('form');
  });

  it('all required output fields present on intent-only path', async () => {
    const result = await handle({ intent: 'simple dashboard' });
    expect(result.status).toBeDefined();
    expect(result.layout).toBeDefined();
    expect(result.schema).toBeDefined();
    expect(result.selections).toBeInstanceOf(Array);
    expect(result.warnings).toBeInstanceOf(Array);
    expect(result.schemaRef).toBeTruthy();
  });
});
