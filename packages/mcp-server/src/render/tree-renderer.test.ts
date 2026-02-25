import { describe, expect, it } from 'vitest';
import type { UiSchema } from '../schemas/generated.js';
import { renderTree, resolveStyleTokensToCssVars } from './tree-renderer.js';

const schemaFixture: UiSchema = {
  version: '2026.02',
  screens: [
    {
      id: 'screen-home',
      component: 'Stack',
      layout: { type: 'stack', gapToken: 'inset-default' },
      style: { spacingToken: 'inset-default' },
      children: [
        {
          id: 'panel-grid',
          component: 'Card',
          layout: { type: 'grid', gapToken: 'cluster-tight' },
          style: { radiusToken: 'md' },
          children: [
            {
              id: 'inline-group',
              component: 'Stack',
              layout: { type: 'inline', align: 'center' },
              style: { colorToken: 'text-primary' },
              children: [
                { id: 'deep-text', component: 'Text', props: { text: 'Deep node' } },
                { id: 'deep-unknown', component: 'NotMappedComponent', props: { priority: 'high' } },
              ],
            },
          ],
        },
        {
          id: 'panel-sidebar',
          component: 'Card',
          layout: { type: 'sidebar', gapToken: 'cluster-default' },
          style: { shadowToken: 'lg' },
          children: [
            { id: 'sidebar-main', component: 'Text', props: { text: 'Main content' } },
            { id: 'sidebar-help', component: 'Badge', props: { label: 'Help' } },
          ],
        },
      ],
    },
    {
      id: 'screen-settings',
      component: 'Card',
      layout: { type: 'section' },
      style: { typographyToken: 'body-default' },
      children: [{ id: 'settings-copy', component: 'Text', props: { text: 'Settings section' } }],
    },
  ],
};

describe('tree-renderer', () => {
  it('recursively renders nested UiSchema trees', () => {
    const html = renderTree(schemaFixture);

    expect(html).toContain('data-oods-node-id="screen-home"');
    expect(html).toContain('data-oods-node-id="panel-grid"');
    expect(html).toContain('data-oods-node-id="inline-group"');
    expect(html).toContain('data-oods-node-id="deep-text"');

    const rootIndex = html.indexOf('screen-home');
    const middleIndex = html.indexOf('panel-grid');
    const deepIndex = html.indexOf('deep-text');
    expect(rootIndex).toBeGreaterThan(-1);
    expect(middleIndex).toBeGreaterThan(rootIndex);
    expect(deepIndex).toBeGreaterThan(middleIndex);
  });

  it('maps layouts to expected CSS behaviors', () => {
    const html = renderTree(schemaFixture);

    expect(html).toContain('display:flex;flex-direction:column');
    expect(html).toContain('display:grid;grid-template-columns:repeat(auto-fit, minmax(0, 1fr))');
    expect(html).toContain('display:flex;flex-direction:row');
    expect(html).toContain('<section data-layout="section" data-layout-node-id="screen-settings"');
    expect(html).toContain('display:grid;grid-template-columns:minmax(0, 1fr) minmax(16rem, 24rem)');
    expect(html).toContain('<aside data-sidebar-aside="true">');
  });

  it('resolves style tokens to CSS variable references', () => {
    const html = renderTree(schemaFixture);

    expect(html).toContain('gap:var(--ref-spacing-inset-default)');
    expect(html).toContain('padding:var(--ref-spacing-inset-default)');
    expect(html).toContain('border-radius:var(--ref-radius-md)');
    expect(html).toContain('box-shadow:var(--ref-shadow-lg)');
    expect(html).toContain('color:var(--ref-color-text-primary)');
    expect(html).toContain('font:var(--ref-typography-body-default)');
  });

  it('uses fallback renderer for unmapped components', () => {
    const html = renderTree(schemaFixture);

    expect(html).toContain('Unknown component: NotMappedComponent');
    expect(html).toContain('data-oods-fallback="true"');
  });

  it('exports token resolver helper for downstream renderer stages', () => {
    const resolved = resolveStyleTokensToCssVars({
      spacingToken: 'inset-default',
      radiusToken: 'sm',
      shadowToken: 'md',
      colorToken: 'text-primary',
      typographyToken: 'body-default',
    });

    expect(resolved.padding).toBe('var(--ref-spacing-inset-default)');
    expect(resolved['border-radius']).toBe('var(--ref-radius-sm)');
    expect(resolved['box-shadow']).toBe('var(--ref-shadow-md)');
    expect(resolved.color).toBe('var(--ref-color-text-primary)');
    expect(resolved.font).toBe('var(--ref-typography-body-default)');
  });
});
