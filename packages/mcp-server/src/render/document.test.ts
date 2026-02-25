import { describe, expect, it } from 'vitest';
import { readTokensCssForDocument, renderDocument } from './document.js';

describe('renderDocument', () => {
  it('produces a valid standalone HTML5 document with defaults', () => {
    const html = renderDocument({
      screenHtml: '<section data-oods-component="Card">Hello</section>',
    });

    expect(html.startsWith('<!DOCTYPE html>')).toBe(true);
    expect(html).toContain('<html lang="en" data-theme="light" data-brand="default">');
    expect(html).toContain('<head>');
    expect(html).toContain('<body data-theme="light" data-brand="default">');
    expect(html).toContain('<main id="oods-preview-root"><section data-oods-component="Card">Hello</section></main>');
    expect(html).toContain('</body>');
    expect(html).toContain('</html>');
  });

  it('uses provided schema theme and explicit brand/title overrides', () => {
    const html = renderDocument({
      screenHtml: '<div>Preview</div>',
      schema: { theme: 'dark' },
      brand: 'A',
      title: 'Workbench Preview',
    });

    expect(html).toContain('<html lang="en" data-theme="dark" data-brand="A">');
    expect(html).toContain('<body data-theme="dark" data-brand="A">');
    expect(html).toContain('<title>Workbench Preview</title>');
  });

  it('inlines tokens CSS and component CSS blocks', () => {
    const html = renderDocument({
      screenHtml: '<div>Tokens</div>',
      componentCss: '.custom-preview { outline: 1px solid red; }',
    });
    const tokensCss = readTokensCssForDocument();

    expect(tokensCss.length).toBeGreaterThan(0);
    expect(html).toContain('<style data-source="tokens">');
    expect(html).toContain('<style data-source="components">');
    expect(html).toContain('--ref-border-radius-md');
    expect(html).toContain('[data-oods-component="Button"]');
    expect(html).toContain('.custom-preview { outline: 1px solid red; }');
  });

  it('escapes title/attributes and returns well-formed closing tags', () => {
    const html = renderDocument({
      screenHtml: '<div>Escaped</div>',
      title: '<unsafe>',
      theme: 'light"quoted',
      brand: "default'brand",
    });

    expect(html).toContain('<title>&lt;unsafe&gt;</title>');
    expect(html).toContain('data-theme="light&quot;quoted"');
    expect(html).toContain('data-brand="default&#39;brand"');
    expect(html.endsWith('</html>')).toBe(true);
  });
});
