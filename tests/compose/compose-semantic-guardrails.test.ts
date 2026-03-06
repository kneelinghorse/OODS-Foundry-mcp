import { describe, expect, it } from 'vitest';
import type { UiElement, UiSchema } from '../../packages/mcp-server/src/schemas/generated.js';
import { handle as composeHandle } from '../../packages/mcp-server/src/tools/design.compose.js';

function collectComponents(schema: UiSchema, component: string): UiElement[] {
  const matches: UiElement[] = [];

  const walk = (node: UiElement): void => {
    if (node.component === component) {
      matches.push(node);
    }
    node.children?.forEach(walk);
  };

  schema.screens.forEach(walk);
  return matches;
}

describe('design.compose semantic guardrails', () => {
  it('differentiates generic settings-form fields from intent cues', async () => {
    const result = await composeHandle({
      intent: 'A settings page with a form for notification preferences: email toggle, SMS toggle, frequency dropdown',
      options: { validate: false },
    });

    expect(result.status).toBe('ok');
    expect(result.layout).toBe('form');

    const fieldSelections = result.selections
      .filter((selection) => selection.slotName.startsWith('field-'))
      .map((selection) => selection.selectedComponent);

    expect(new Set(fieldSelections).size).toBeGreaterThan(1);
    expect(fieldSelections.some((name) => ['PreferenceEditor', 'Toggle', 'Checkbox', 'Switch'].includes(name ?? ''))).toBe(true);
    expect(fieldSelections).toContain('Select');
  });

  it('preserves explicit Product list bindings instead of rebinding to weaker fields', async () => {
    const result = await composeHandle({
      object: 'Product',
      context: 'list',
      options: { validate: false },
    });

    expect(result.status).toBe('ok');

    const searchInput = collectComponents(result.schema, 'SearchInput')[0];
    const labelCell = collectComponents(result.schema, 'LabelCell')[0];
    const timestamp = collectComponents(result.schema, 'RelativeTimestamp')[0];
    const toolbarButton = collectComponents(result.schema, 'Button')[0];

    expect(searchInput?.props?.field).toBe('searchQuery');
    expect(labelCell?.props?.field).toBe('label');
    expect(timestamp?.props?.field).toBe('updated_at');
    expect(toolbarButton?.props?.field).toBeUndefined();
  });

  it('blocks non-status fallback bindings in expanded User detail tabs', async () => {
    const result = await composeHandle({
      object: 'User',
      context: 'detail',
      options: { validate: false },
    });

    expect(result.status).toBe('ok');

    const badStatusBinding = collectComponents(result.schema, 'StatusBadge')
      .some((node) => node.props?.field === 'role');

    expect(badStatusBinding).toBe(false);
  });

  it('prefers SearchInput for searchable lists and keeps results slots non-search', async () => {
    const result = await composeHandle({
      intent: 'A paginated list of Users showing name, email, and role with search and filtering',
      options: { validate: false },
    });

    expect(result.status).toBe('ok');
    expect(result.layout).toBe('list');

    const searchSelection = result.selections.find((selection) => selection.slotName === 'search');
    const itemsSelection = result.selections.find((selection) => selection.slotName === 'items');
    const filtersSelection = result.selections.find((selection) => selection.slotName === 'filters');

    expect(searchSelection?.selectedComponent).toBe('SearchInput');
    expect(itemsSelection?.selectedComponent).not.toBe('SearchInput');
    expect(filtersSelection?.selectedComponent).not.toBe('SearchInput');
  });

  it('keeps non-search text form fields on Input when search semantics are absent', async () => {
    const result = await composeHandle({
      intent: 'A contact form with email input, name input',
      options: { validate: false },
    });

    expect(result.status).toBe('ok');
    expect(result.layout).toBe('form');

    const fieldSelections = result.selections
      .filter((selection) => selection.slotName.startsWith('field-'))
      .map((selection) => selection.selectedComponent);

    expect(fieldSelections.every((name) => name === 'Input')).toBe(true);
  });
});
