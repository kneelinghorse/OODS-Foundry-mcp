import { describe, expect, it } from 'vitest';
import type { UiElement } from '../schemas/generated.js';
import { hasMappedRenderer, renderMappedComponent } from './component-map.js';

function makeNode(component: string, props: Record<string, unknown> = {}, extras: Partial<UiElement> = {}): UiElement {
  return {
    id: extras.id ?? `${component.toLowerCase()}-node`,
    component,
    props,
    children: extras.children,
    layout: extras.layout,
    meta: extras.meta,
    route: extras.route,
    style: extras.style,
    bindings: extras.bindings,
  };
}

describe('component map coverage', () => {
  it('covers required components', () => {
    for (const component of ['Button', 'Card', 'Stack', 'Text', 'Input', 'Select', 'Badge', 'Banner', 'Table', 'Tabs']) {
      expect(hasMappedRenderer(component)).toBe(true);
    }
  });

  it('renders Button with semantic HTML and prop serialization', () => {
    const html = renderMappedComponent(
      makeNode('Button', { type: 'submit', disabled: true, label: 'Save', variant: 'primary', count: 2 })
    );

    expect(html.startsWith('<button')).toBe(true);
    expect(html).toContain('type="submit"');
    expect(html).toContain(' disabled');
    expect(html).toContain('data-oods-component="Button"');
    expect(html).toContain('data-prop-variant="primary"');
    expect(html).toContain('data-prop-count="2"');
    expect(html).toContain('>Save</button>');
  });

  it('renders Card as article', () => {
    const html = renderMappedComponent(makeNode('Card', { elevation: 'md' }), '<p>Content</p>');

    expect(html.startsWith('<article')).toBe(true);
    expect(html).toContain('data-oods-component="Card"');
    expect(html).toContain('data-prop-elevation="md"');
    expect(html).toContain('<p>Content</p>');
  });

  it('renders Stack as div and preserves child HTML', () => {
    const html = renderMappedComponent(makeNode('Stack', { gapToken: 'spacing.md' }), '<span>Row</span>');

    expect(html.startsWith('<div')).toBe(true);
    expect(html).toContain('data-layout="stack"');
    expect(html).toContain('data-prop-gap-token="spacing.md"');
    expect(html).toContain('<span>Row</span>');
  });

  it('renders Text with tag override', () => {
    const html = renderMappedComponent(makeNode('Text', { as: 'h3', text: 'Heading', tone: 'positive' }));

    expect(html.startsWith('<h3')).toBe(true);
    expect(html).toContain('data-oods-component="Text"');
    expect(html).toContain('data-prop-tone="positive"');
    expect(html).toContain('>Heading</h3>');
  });

  it('renders Input as semantic input element', () => {
    const html = renderMappedComponent(
      makeNode('Input', { type: 'email', placeholder: 'name@site.tld', required: true, mask: 'email' })
    );

    expect(html.startsWith('<input')).toBe(true);
    expect(html).toContain('type="email"');
    expect(html).toContain('placeholder="name@site.tld"');
    expect(html).toContain(' required');
    expect(html).toContain('data-prop-mask="email"');
  });

  it('renders Select with option list and selected value', () => {
    const html = renderMappedComponent(
      makeNode('Select', {
        name: 'status',
        value: 'active',
        options: [
          { value: 'draft', label: 'Draft' },
          { value: 'active', label: 'Active' },
        ],
      })
    );

    expect(html.startsWith('<select')).toBe(true);
    expect(html).toContain('name="status"');
    expect(html).toContain('<option value="draft">Draft</option>');
    expect(html).toContain('<option value="active" selected>Active</option>');
  });

  it('renders Badge as span', () => {
    const html = renderMappedComponent(makeNode('Badge', { label: 'New', tone: 'info' }));

    expect(html.startsWith('<span')).toBe(true);
    expect(html).toContain('data-oods-component="Badge"');
    expect(html).toContain('data-prop-tone="info"');
    expect(html).toContain('>New</span>');
  });

  it('renders Banner as section with default status role', () => {
    const html = renderMappedComponent(makeNode('Banner', { message: 'Sync complete', intent: 'success' }));

    expect(html.startsWith('<section')).toBe(true);
    expect(html).toContain('role="status"');
    expect(html).toContain('data-prop-intent="success"');
    expect(html).toContain('>Sync complete</section>');
  });

  it('renders Table with semantic header/body sections', () => {
    const html = renderMappedComponent(
      makeNode('Table', {
        columns: [{ key: 'name', label: 'Name' }, { key: 'value', label: 'Value' }],
        rows: [{ name: 'Latency', value: '120ms' }],
      })
    );

    expect(html.startsWith('<table')).toBe(true);
    expect(html).toContain('<thead>');
    expect(html).toContain('<th scope="col">Name</th>');
    expect(html).toContain('<tbody>');
    expect(html).toContain('<td>Latency</td>');
    expect(html).toContain('<td>120ms</td>');
  });

  it('renders Tabs with tablist and tabpanels', () => {
    const html = renderMappedComponent(
      makeNode('Tabs', {
        tabs: [
          { id: 'overview', label: 'Overview', content: 'Overview panel', active: true },
          { id: 'details', label: 'Details', content: 'Details panel', active: false },
        ],
      })
    );

    expect(html.startsWith('<section')).toBe(true);
    expect(html).toContain('role="tablist"');
    expect(html).toContain('aria-selected="true"');
    expect(html).toContain('aria-selected="false"');
    expect(html).toContain('role="tabpanel"');
    expect(html).toContain('Overview panel');
    expect(html).toContain('Details panel');
  });

  it('renders fallback div for unknown components with component label', () => {
    const html = renderMappedComponent(makeNode('NotInRegistry', { danger: 'yes' }), '<em>Fallback child</em>');

    expect(html.startsWith('<div')).toBe(true);
    expect(html).toContain('data-oods-fallback="true"');
    expect(html).toContain('Unknown component: NotInRegistry');
    expect(html).toContain('<em>Fallback child</em>');
  });
});
