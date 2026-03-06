import { describe, expect, it } from 'vitest';
import { handle } from '../../src/tools/design.compose.js';
import type { UiElement, UiSchema } from '../../src/schemas/generated.js';

function collectNodes(schema: UiSchema, predicate: (node: UiElement) => boolean): UiElement[] {
  const matches: UiElement[] = [];

  const walk = (node: UiElement): void => {
    if (predicate(node)) {
      matches.push(node);
    }
    node.children?.forEach(walk);
  };

  schema.screens.forEach(walk);
  return matches;
}

describe('design.compose — form field differentiation', () => {
  it('differentiates mixed Subscription fields into specialized form controls', async () => {
    const result = await handle({
      object: 'Subscription',
      context: 'form',
      preferences: { fieldGroups: 5 },
    });

    expect(result.status).toBe('ok');
    expect(result.layout).toBe('form');

    const fieldSelections = result.selections.filter((selection) => selection.slotName.startsWith('field-'));
    const selectionByIntent = new Map(
      fieldSelections
        .filter((selection) => selection.selectedComponent)
        .map((selection) => [selection.intent, selection.selectedComponent]),
    );

    expect(selectionByIntent.get('email-input')).toBe('Input');
    expect(selectionByIntent.get('enum-input')).toBe('Select');
    expect(selectionByIntent.get('date-input')).toBe('DatePicker');
    expect(selectionByIntent.get('long-text-input')).toBe('Textarea');
    expect(['Toggle', 'Checkbox', 'Switch']).toContain(selectionByIntent.get('boolean-input'));

    const selectedComponents = fieldSelections
      .map((selection) => selection.selectedComponent)
      .filter((component): component is string => typeof component === 'string');
    expect(new Set(selectedComponents).size).toBeGreaterThanOrEqual(4);
  });

  it('wires the subscription email field to an email-typed Input node', async () => {
    const result = await handle({
      object: 'Subscription',
      context: 'form',
      preferences: { fieldGroups: 5 },
    });

    expect(result.status).toBe('ok');

    const emailInputs = collectNodes(
      result.schema,
      (node) => node.component === 'Input' && node.props?.field === 'customer_email',
    );

    expect(emailInputs.length).toBeGreaterThan(0);
    expect(emailInputs[0].props?.type).toBe('email');
  });
});
