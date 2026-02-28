import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import type { UiSchema } from '../schemas/generated.js';
import { escapeHtml } from './escape-html.js';

export type RenderDocumentInput = {
  screenHtml: string;
  schema?: Pick<UiSchema, 'theme'>;
  brand?: string;
  theme?: string;
  title?: string;
  componentCss?: string;
  lang?: string;
};

const RENDER_DIR = fileURLToPath(new URL('.', import.meta.url));
const REPO_ROOT = path.resolve(RENDER_DIR, '../../../../');
const TOKENS_CSS_PATH = path.join(REPO_ROOT, 'packages', 'tokens', 'dist', 'css', 'tokens.css');

const DEFAULT_COMPONENT_CSS = `
#oods-preview-root {
  margin: 0;
  padding: var(--ref-space-inset-default, 24px);
  min-height: 100dvh;
  box-sizing: border-box;
  background: var(--ref-color-neutral-50, #f8fafc);
  color: var(--ref-color-neutral-900, #0f172a);
  font-family: var(--ref-typography-families-sans, Inter, "Helvetica Neue", Arial, sans-serif);
}
[data-oods-component] {
  box-sizing: border-box;
}
[data-oods-component="Button"] {
  border: var(--ref-border-width-hairline, 1px) solid var(--ref-color-primary-500, #4f46e5);
  border-radius: var(--ref-border-radius-md, 12px);
  background: var(--ref-color-primary-500, #4f46e5);
  color: var(--ref-color-neutral-0, #ffffff);
  padding: 0.5rem 0.875rem;
}
[data-oods-component="Card"] {
  border: var(--ref-border-width-hairline, 1px) solid var(--ref-color-neutral-200, #e2e8f0);
  border-radius: var(--ref-border-radius-md, 12px);
  background: var(--ref-color-neutral-0, #ffffff);
  padding: var(--ref-space-inset-compact, 8px);
}
[data-oods-component="Badge"] {
  display: inline-flex;
  border-radius: var(--ref-border-radius-pill, 999px);
  padding: 0.125rem 0.5rem;
  background: var(--ref-color-info-100, #eef2ff);
}
[data-oods-component="Banner"] {
  border-radius: var(--ref-border-radius-md, 12px);
  border-left: 4px solid var(--ref-color-info-700, #2563eb);
  padding: var(--ref-space-inset-compact, 8px);
  background: var(--ref-color-info-100, #eff6ff);
}
[data-oods-component="Table"] {
  width: 100%;
  border-collapse: collapse;
}
[data-oods-component="Table"] th,
[data-oods-component="Table"] td {
  border-bottom: var(--ref-border-width-hairline, 1px) solid var(--ref-color-neutral-200, #e2e8f0);
  text-align: left;
  padding: 0.5rem;
}
[data-oods-component="Tabs"] [role="tablist"] {
  display: flex;
  gap: 0.5rem;
  margin-bottom: 0.5rem;
}
[data-sidebar-aside="true"] {
  border-left: var(--ref-border-width-hairline, 1px) solid var(--ref-color-neutral-200, #e2e8f0);
  padding-left: var(--ref-space-inset-compact, 8px);
}
`.trim();

let cachedTokensCss: string | null = null;

function loadTokensCss(): string {
  if (cachedTokensCss !== null) return cachedTokensCss;
  try {
    cachedTokensCss = fs.readFileSync(TOKENS_CSS_PATH, 'utf8');
  } catch {
    cachedTokensCss = '';
  }
  return cachedTokensCss;
}

function normalizeTheme(input: RenderDocumentInput): string {
  return input.theme ?? input.schema?.theme ?? 'light';
}

function normalizeBrand(input: RenderDocumentInput): string {
  return input.brand ?? 'default';
}

function normalizeTitle(input: RenderDocumentInput): string {
  const raw = input.title?.trim();
  return raw && raw.length > 0 ? raw : 'OODS Preview';
}

export function renderDocument(input: RenderDocumentInput): string {
  const theme = normalizeTheme(input);
  const brand = normalizeBrand(input);
  const title = normalizeTitle(input);
  const lang = input.lang?.trim() || 'en';

  const tokensCss = loadTokensCss();
  const componentCss = [DEFAULT_COMPONENT_CSS, input.componentCss ?? ''].filter((entry) => entry.trim().length > 0).join('\n');

  return [
    '<!DOCTYPE html>',
    `<html lang="${escapeHtml(lang)}" data-theme="${escapeHtml(theme)}" data-brand="${escapeHtml(brand)}">`,
    '<head>',
    '  <meta charset="utf-8" />',
    '  <meta name="viewport" content="width=device-width, initial-scale=1" />',
    `  <title>${escapeHtml(title)}</title>`,
    '  <style data-source="tokens">',
    tokensCss,
    '  </style>',
    '  <style data-source="components">',
    componentCss,
    '  </style>',
    '</head>',
    `<body data-theme="${escapeHtml(theme)}" data-brand="${escapeHtml(brand)}">`,
    `  <main id="oods-preview-root">${input.screenHtml}</main>`,
    '</body>',
    '</html>',
  ].join('\n');
}

export function readTokensCssForDocument(): string {
  return loadTokensCss();
}

export function readDefaultComponentCssForDocument(): string {
  return DEFAULT_COMPONENT_CSS;
}
