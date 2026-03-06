import { describe, expect, it } from 'vitest';
import type { UiElement, UiSchema } from '../../src/schemas/generated.js';
import { handle } from '../../src/tools/design.compose.js';

function collectComponents(schema: UiSchema): string[] {
  const names = new Set<string>();

  function walk(node: UiElement): void {
    names.add(node.component);
    node.children?.forEach(walk);
  }

  schema.screens.forEach(walk);
  return Array.from(names);
}

describe('slot vocabulary unification', () => {
  it('maps User list before/after extensions into concrete slots without placement warnings', async () => {
    const result = await handle({
      object: 'User',
      context: 'list',
      layout: 'list',
      options: { validate: false },
    });

    expect(result.status).toBe('ok');
    expect(result.warnings.filter((warning) => warning.code === 'OODS-V120')).toHaveLength(0);
    expect(result.selections.find((selection) => selection.slotName === 'search')?.selectedComponent).toBe('SearchInput');
    expect(result.selections.find((selection) => selection.slotName === 'toolbar-actions')?.selectedComponent).toBe('Button');

    const components = collectComponents(result.schema);
    expect(components).toContain('MessageStatusBadge');
    expect(components).toContain('AddressSummaryBadge');
    expect(components).toContain('PreferenceSummaryBadge');
    expect(components).toContain('RoleBadgeList');
    expect(components).toContain('SearchInput');
    expect(components).toContain('Button');
  });

  it('maps Subscription list secondary billing placement without OODS-V120 warnings', async () => {
    const result = await handle({
      object: 'Subscription',
      context: 'list',
      layout: 'list',
      options: { validate: false },
    });

    expect(result.status).toBe('ok');
    expect(result.warnings.filter((warning) => warning.code === 'OODS-V120')).toHaveLength(0);
    const toolbarSelection = result.selections.find(
      (selection) => selection.slotName === 'toolbar-actions',
    );

    expect(toolbarSelection?.selectedComponent).toBe('Button');
    expect(toolbarSelection?.candidates.map((candidate) => candidate.name)).toContain('PriceBadge');

    const components = collectComponents(result.schema);
    expect(components).toContain('Button');
    expect(components).toContain('PriceBadge');
    expect(components).toContain('StatusBadge');
    expect(components).toContain('RelativeTimestamp');
  });
});
