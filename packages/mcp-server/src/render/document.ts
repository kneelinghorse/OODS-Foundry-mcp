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
  compact?: boolean;
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
  background: var(--sys-surface-canvas, var(--ref-color-neutral-50, #f8fafc));
  color: var(--sys-text-primary, var(--ref-color-neutral-900, #0f172a));
  font-family: var(--ref-typography-families-sans, Inter, "Helvetica Neue", Arial, sans-serif);
}
[data-oods-component] {
  box-sizing: border-box;
}
[data-oods-component="Button"] {
  border: var(--ref-border-width-hairline, 1px) solid var(--sys-surface-interactive-primary-default, var(--ref-color-primary-500, #4f46e5));
  border-radius: var(--ref-border-radius-md, 12px);
  background: var(--sys-surface-interactive-primary-default, var(--ref-color-primary-500, #4f46e5));
  color: var(--sys-text-on-interactive, var(--ref-color-neutral-0, #ffffff));
  padding: 0.5rem 0.875rem;
}
[data-oods-component="Card"] {
  border: var(--ref-border-width-hairline, 1px) solid var(--sys-border-subtle, var(--ref-color-neutral-200, #e2e8f0));
  border-radius: var(--ref-border-radius-md, 12px);
  background: var(--sys-surface-raised, var(--ref-color-neutral-0, #ffffff));
  padding: var(--ref-space-inset-compact, 8px);
}
[data-oods-component="Badge"] {
  display: inline-flex;
  border-radius: var(--ref-border-radius-pill, 999px);
  padding: 0.125rem 0.5rem;
  background: var(--sys-status-info-surface, var(--ref-color-info-100, #eef2ff));
}
[data-oods-component="Banner"] {
  border-radius: var(--ref-border-radius-md, 12px);
  border-left: 4px solid var(--sys-status-info-border, var(--ref-color-info-700, #2563eb));
  padding: var(--ref-space-inset-compact, 8px);
  background: var(--sys-status-info-surface, var(--ref-color-info-100, #eff6ff));
}
[data-oods-component="Table"] {
  width: 100%;
  border-collapse: collapse;
}
[data-oods-component="Table"] th,
[data-oods-component="Table"] td {
  border-bottom: var(--ref-border-width-hairline, 1px) solid var(--sys-border-subtle, var(--ref-color-neutral-200, #e2e8f0));
  text-align: left;
  padding: 0.5rem;
}
[data-oods-component="Tabs"] [role="tablist"] {
  display: flex;
  gap: 0.5rem;
  margin-bottom: 0.5rem;
}
[data-sidebar-aside="true"] {
  border-left: var(--ref-border-width-hairline, 1px) solid var(--sys-border-subtle, var(--ref-color-neutral-200, #e2e8f0));
  padding-left: var(--ref-space-inset-compact, 8px);
}
`.trim();

/**
 * CSS block that remaps --theme-* variables to --theme-dark-* under [data-theme="dark"].
 * This activates the dark semantic layer so --sys-* tokens resolve to dark values.
 */
const DARK_THEME_OVERRIDES = `
[data-theme="dark"] {
  --theme-surface-canvas: var(--theme-dark-surface-canvas);
  --theme-surface-raised: var(--theme-dark-surface-raised);
  --theme-surface-subtle: var(--theme-dark-surface-subtle);
  --theme-surface-disabled: var(--theme-dark-surface-disabled);
  --theme-surface-backdrop: var(--theme-dark-surface-backdrop);
  --theme-surface-inverse: var(--theme-dark-surface-inverse);
  --theme-surface-interactive-primary-default: var(--theme-dark-surface-interactive-primary-default);
  --theme-surface-interactive-primary-hover: var(--theme-dark-surface-interactive-primary-hover);
  --theme-surface-interactive-primary-pressed: var(--theme-dark-surface-interactive-primary-pressed);
  --theme-border-subtle: var(--theme-dark-border-subtle);
  --theme-border-strong: var(--theme-dark-border-strong);
  --theme-text-primary: var(--theme-dark-text-primary);
  --theme-text-secondary: var(--theme-dark-text-secondary);
  --theme-text-muted: var(--theme-dark-text-muted);
  --theme-text-inverse: var(--theme-dark-text-inverse);
  --theme-text-accent: var(--theme-dark-text-accent);
  --theme-text-on-interactive: var(--theme-dark-text-on-interactive);
  --theme-text-disabled: var(--theme-dark-text-disabled);
  --theme-icon-primary: var(--theme-dark-icon-primary);
  --theme-icon-muted: var(--theme-dark-icon-muted);
  --theme-icon-on-interactive: var(--theme-dark-icon-on-interactive);
  --theme-focus-ring-outer: var(--theme-dark-focus-ring-outer);
  --theme-focus-ring-inner: var(--theme-dark-focus-ring-inner);
  --theme-focus-text: var(--theme-dark-focus-text);
  --theme-status-info-surface: var(--theme-dark-status-info-surface);
  --theme-status-info-border: var(--theme-dark-status-info-border);
  --theme-status-info-text: var(--theme-dark-status-info-text);
  --theme-status-info-icon: var(--theme-dark-status-info-icon);
  --theme-status-success-surface: var(--theme-dark-status-success-surface);
  --theme-status-success-border: var(--theme-dark-status-success-border);
  --theme-status-success-text: var(--theme-dark-status-success-text);
  --theme-status-success-icon: var(--theme-dark-status-success-icon);
  --theme-status-warning-surface: var(--theme-dark-status-warning-surface);
  --theme-status-warning-border: var(--theme-dark-status-warning-border);
  --theme-status-warning-text: var(--theme-dark-status-warning-text);
  --theme-status-warning-icon: var(--theme-dark-status-warning-icon);
  --theme-status-critical-surface: var(--theme-dark-status-critical-surface);
  --theme-status-critical-border: var(--theme-dark-status-critical-border);
  --theme-status-critical-text: var(--theme-dark-status-critical-text);
  --theme-status-critical-icon: var(--theme-dark-status-critical-icon);
  --theme-status-neutral-surface: var(--theme-dark-status-neutral-surface);
  --theme-status-neutral-border: var(--theme-dark-status-neutral-border);
  --theme-status-neutral-text: var(--theme-dark-status-neutral-text);
  --theme-status-neutral-icon: var(--theme-dark-status-neutral-icon);
  --theme-status-accent-surface: var(--theme-dark-status-accent-surface);
  --theme-status-accent-border: var(--theme-dark-status-accent-border);
  --theme-status-accent-text: var(--theme-dark-status-accent-text);
  --theme-status-accent-icon: var(--theme-dark-status-accent-icon);
  --theme-status-archive-surface: var(--theme-dark-status-archive-surface);
  --theme-status-archive-border: var(--theme-dark-status-archive-border);
  --theme-status-archive-text: var(--theme-dark-status-archive-text);
  --theme-status-archive-icon: var(--theme-dark-status-archive-icon);
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

  const compact = input.compact ?? false;
  const tokensCss = compact ? '' : loadTokensCss();
  const componentCss = [DEFAULT_COMPONENT_CSS, input.componentCss ?? ''].filter((entry) => entry.trim().length > 0).join('\n');

  const headParts = [
    '  <meta charset="utf-8" />',
    '  <meta name="viewport" content="width=device-width, initial-scale=1" />',
    `  <title>${escapeHtml(title)}</title>`,
  ];

  if (!compact) {
    headParts.push(
      '  <style data-source="tokens">',
      tokensCss,
      '  </style>',
    );
  } else {
    headParts.push('  <!-- tokens.css omitted (compact mode) — use tokens.build to obtain -->');
  }

  if (theme === 'dark') {
    headParts.push(
      '  <style data-source="theme-overrides">',
      DARK_THEME_OVERRIDES,
      '  </style>',
    );
  }

  headParts.push(
    '  <style data-source="components">',
    componentCss,
    '  </style>',
  );

  return [
    '<!DOCTYPE html>',
    `<html lang="${escapeHtml(lang)}" data-theme="${escapeHtml(theme)}" data-brand="${escapeHtml(brand)}">`,
    '<head>',
    ...headParts,
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
