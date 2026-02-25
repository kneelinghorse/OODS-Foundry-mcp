import type { UiElement } from '../schemas/generated.js';

export type ComponentRenderer = (node: UiElement, childrenHtml?: string) => string;

type TableColumn = { key: string; label: string };
type TabItem = { id: string; label: string; panel: string; active: boolean };

const BOOLEAN_ATTRIBUTES = new Set([
  'autofocus',
  'checked',
  'disabled',
  'hidden',
  'multiple',
  'readonly',
  'required',
  'selected',
]);

const TEXT_TAGS = new Set(['p', 'span', 'small', 'strong', 'em', 'label', 'h1', 'h2', 'h3', 'h4', 'h5', 'h6']);

const BUTTON_HTML_ATTRS = new Set(['type', 'name', 'value', 'title', 'disabled', 'autofocus']);
const TEXT_HTML_ATTRS = new Set(['title']);
const INPUT_HTML_ATTRS = new Set([
  'type',
  'name',
  'value',
  'placeholder',
  'disabled',
  'required',
  'readonly',
  'min',
  'max',
  'step',
  'autocomplete',
  'title',
]);
const SELECT_HTML_ATTRS = new Set(['name', 'multiple', 'disabled', 'required', 'size', 'title']);
const GENERIC_HTML_ATTRS = new Set(['title']);
const TABLE_HTML_ATTRS = new Set(['title', 'summary']);

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === 'object' && !Array.isArray(value);
}

function asString(value: unknown): string | undefined {
  return typeof value === 'string' && value.length > 0 ? value : undefined;
}

function escapeHtml(value: string): string {
  return value
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#39;');
}

function kebabCase(value: string): string {
  return value
    .replace(/([a-z0-9])([A-Z])/g, '$1-$2')
    .replace(/[\s_]+/g, '-')
    .toLowerCase();
}

function serializePropValue(value: unknown): string {
  if (typeof value === 'string') return value;
  if (typeof value === 'number' || typeof value === 'boolean' || typeof value === 'bigint') return String(value);
  if (value == null) return '';
  try {
    return JSON.stringify(value);
  } catch {
    return String(value);
  }
}

function isHtmlAttribute(name: string, allowlist: Set<string>): boolean {
  return name === 'role' || name === 'class' || name === 'style' || name.startsWith('aria-') || name.startsWith('data-') || allowlist.has(name);
}

function renderAttribute(name: string, value: unknown): string {
  if (typeof value === 'boolean' && BOOLEAN_ATTRIBUTES.has(name)) {
    return value ? ` ${name}` : '';
  }
  return ` ${name}="${escapeHtml(serializePropValue(value))}"`;
}

type BuildAttrOptions = {
  allowedHtmlAttrs: Set<string>;
  consumedProps?: Set<string>;
  htmlOverrides?: Record<string, unknown>;
  dataOverrides?: Record<string, unknown>;
};

function buildAttributes(node: UiElement, options: BuildAttrOptions): string {
  const htmlAttrs = new Map<string, unknown>();
  const dataAttrs = new Map<string, unknown>();
  const consumedProps = options.consumedProps ?? new Set<string>();
  const props = isRecord(node.props) ? node.props : {};

  htmlAttrs.set('id', asString(props.id) ?? node.id);
  dataAttrs.set('data-oods-component', node.component);
  dataAttrs.set('data-oods-node-id', node.id);
  if (node.layout?.type) dataAttrs.set('data-layout', node.layout.type);
  if (node.meta?.label) dataAttrs.set('data-oods-label', node.meta.label);

  for (const [key, value] of Object.entries(options.htmlOverrides ?? {})) {
    htmlAttrs.set(key, value);
  }
  for (const [key, value] of Object.entries(options.dataOverrides ?? {})) {
    dataAttrs.set(key, value);
  }

  for (const [rawKey, rawValue] of Object.entries(props)) {
    if (rawValue === undefined || rawValue === null) continue;
    const normalizedKey = rawKey === 'className' ? 'class' : rawKey;
    if (consumedProps.has(rawKey) || consumedProps.has(normalizedKey)) continue;

    if (isHtmlAttribute(normalizedKey, options.allowedHtmlAttrs)) {
      htmlAttrs.set(normalizedKey, rawValue);
      continue;
    }

    dataAttrs.set(`data-prop-${kebabCase(normalizedKey)}`, serializePropValue(rawValue));
  }

  let output = '';
  for (const [name, value] of htmlAttrs) {
    output += renderAttribute(name, value);
  }
  for (const [name, value] of dataAttrs) {
    output += renderAttribute(name, value);
  }
  return output;
}

function hasChildrenHtml(childrenHtml?: string): boolean {
  return Boolean(childrenHtml && childrenHtml.trim().length > 0);
}

function renderButton(node: UiElement, childrenHtml = ''): string {
  const props = isRecord(node.props) ? node.props : {};
  const attrs = buildAttributes(node, {
    allowedHtmlAttrs: BUTTON_HTML_ATTRS,
    consumedProps: new Set(['label', 'text']),
    htmlOverrides: { type: asString(props.type) ?? 'button' },
  });
  const label = asString(props.label) ?? asString(props.text) ?? node.meta?.label ?? 'Button';
  const content = hasChildrenHtml(childrenHtml) ? childrenHtml : escapeHtml(label);
  return `<button${attrs}>${content}</button>`;
}

function renderCard(node: UiElement, childrenHtml = ''): string {
  const props = isRecord(node.props) ? node.props : {};
  const attrs = buildAttributes(node, {
    allowedHtmlAttrs: GENERIC_HTML_ATTRS,
    consumedProps: new Set(['body']),
  });
  const body = asString(props.body) ?? '';
  const content = hasChildrenHtml(childrenHtml) ? childrenHtml : escapeHtml(body);
  return `<article${attrs}>${content}</article>`;
}

function renderStack(node: UiElement, childrenHtml = ''): string {
  const attrs = buildAttributes(node, {
    allowedHtmlAttrs: GENERIC_HTML_ATTRS,
    dataOverrides: { 'data-layout': node.layout?.type ?? 'stack' },
  });
  return `<div${attrs}>${childrenHtml}</div>`;
}

function renderText(node: UiElement, childrenHtml = ''): string {
  const props = isRecord(node.props) ? node.props : {};
  const tagCandidate = asString(props.as)?.toLowerCase();
  const tag = tagCandidate && TEXT_TAGS.has(tagCandidate) ? tagCandidate : 'p';
  const attrs = buildAttributes(node, {
    allowedHtmlAttrs: TEXT_HTML_ATTRS,
    consumedProps: new Set(['as', 'text', 'value']),
  });
  const text = asString(props.text) ?? asString(props.value) ?? node.meta?.label ?? '';
  const content = hasChildrenHtml(childrenHtml) ? childrenHtml : escapeHtml(text);
  return `<${tag}${attrs}>${content}</${tag}>`;
}

function renderInput(node: UiElement): string {
  const props = isRecord(node.props) ? node.props : {};
  const attrs = buildAttributes(node, {
    allowedHtmlAttrs: INPUT_HTML_ATTRS,
    htmlOverrides: { type: asString(props.type) ?? 'text' },
  });
  return `<input${attrs} />`;
}

function normalizeSelectOptions(rawOptions: unknown, selectedValue: unknown): Array<{ value: string; label: string; selected: boolean }> {
  if (!Array.isArray(rawOptions)) return [];
  const selectedValues = new Set<string>();
  if (Array.isArray(selectedValue)) {
    for (const value of selectedValue) {
      selectedValues.add(serializePropValue(value));
    }
  } else if (selectedValue !== undefined && selectedValue !== null) {
    selectedValues.add(serializePropValue(selectedValue));
  }

  const options: Array<{ value: string; label: string; selected: boolean }> = [];
  for (const entry of rawOptions) {
    if (isRecord(entry)) {
      const value = asString(entry.value) ?? asString(entry.id) ?? asString(entry.label) ?? '';
      const label = asString(entry.label) ?? value;
      if (!value && !label) continue;
      options.push({ value, label, selected: selectedValues.has(value) });
      continue;
    }
    const value = serializePropValue(entry);
    if (!value) continue;
    options.push({ value, label: value, selected: selectedValues.has(value) });
  }
  return options;
}

function renderSelect(node: UiElement, childrenHtml = ''): string {
  const props = isRecord(node.props) ? node.props : {};
  const attrs = buildAttributes(node, {
    allowedHtmlAttrs: SELECT_HTML_ATTRS,
    consumedProps: new Set(['options']),
  });

  const options = normalizeSelectOptions(props.options, props.value);
  if (options.length === 0) {
    return `<select${attrs}>${childrenHtml}</select>`;
  }
  const optionsHtml = options
    .map((option) => `<option value="${escapeHtml(option.value)}"${option.selected ? ' selected' : ''}>${escapeHtml(option.label)}</option>`)
    .join('');
  return `<select${attrs}>${optionsHtml}</select>`;
}

function renderBadge(node: UiElement, childrenHtml = ''): string {
  const props = isRecord(node.props) ? node.props : {};
  const attrs = buildAttributes(node, {
    allowedHtmlAttrs: GENERIC_HTML_ATTRS,
    consumedProps: new Set(['label', 'text']),
  });
  const label = asString(props.label) ?? asString(props.text) ?? node.meta?.label ?? 'Badge';
  const content = hasChildrenHtml(childrenHtml) ? childrenHtml : escapeHtml(label);
  return `<span${attrs}>${content}</span>`;
}

function renderBanner(node: UiElement, childrenHtml = ''): string {
  const props = isRecord(node.props) ? node.props : {};
  const attrs = buildAttributes(node, {
    allowedHtmlAttrs: new Set(['role', 'title']),
    consumedProps: new Set(['message', 'text']),
    htmlOverrides: props.role ? undefined : { role: 'status' },
  });
  const text = asString(props.message) ?? asString(props.text) ?? node.meta?.label ?? '';
  const content = hasChildrenHtml(childrenHtml) ? childrenHtml : escapeHtml(text);
  return `<section${attrs}>${content}</section>`;
}

function normalizeColumns(rawColumns: unknown, rows: unknown[]): TableColumn[] {
  if (Array.isArray(rawColumns) && rawColumns.length > 0) {
    return rawColumns
      .map((entry, index) => {
        if (isRecord(entry)) {
          const key = asString(entry.key) ?? asString(entry.id) ?? `col-${index + 1}`;
          const label = asString(entry.label) ?? key;
          return { key, label };
        }
        const text = serializePropValue(entry);
        return { key: text || `col-${index + 1}`, label: text || `Column ${index + 1}` };
      })
      .filter((entry) => entry.key.length > 0);
  }

  const firstRow = rows.find((row) => isRecord(row) || Array.isArray(row));
  if (isRecord(firstRow)) {
    return Object.keys(firstRow).map((key) => ({ key, label: key }));
  }
  if (Array.isArray(firstRow)) {
    return firstRow.map((_, index) => ({ key: `col-${index + 1}`, label: `Column ${index + 1}` }));
  }
  return [];
}

function normalizeRows(rawRows: unknown): unknown[] {
  return Array.isArray(rawRows) ? rawRows : [];
}

function renderTable(node: UiElement, childrenHtml = ''): string {
  const props = isRecord(node.props) ? node.props : {};
  const rows = normalizeRows(props.rows);
  const columns = normalizeColumns(props.columns, rows);
  const attrs = buildAttributes(node, {
    allowedHtmlAttrs: TABLE_HTML_ATTRS,
    consumedProps: new Set(['columns', 'rows']),
  });

  if (columns.length === 0 || rows.length === 0) {
    return `<table${attrs}>${childrenHtml}</table>`;
  }

  const thead = `<thead><tr>${columns.map((column) => `<th scope="col">${escapeHtml(column.label)}</th>`).join('')}</tr></thead>`;
  const tbodyRows = rows
    .map((row) => {
      if (isRecord(row)) {
        const cells = columns.map((column) => `<td>${escapeHtml(serializePropValue(row[column.key]))}</td>`).join('');
        return `<tr>${cells}</tr>`;
      }
      if (Array.isArray(row)) {
        const cells = columns
          .map((_, index) => `<td>${escapeHtml(serializePropValue(row[index]))}</td>`)
          .join('');
        return `<tr>${cells}</tr>`;
      }
      return `<tr><td colspan="${columns.length}">${escapeHtml(serializePropValue(row))}</td></tr>`;
    })
    .join('');

  return `<table${attrs}>${thead}<tbody>${tbodyRows}</tbody></table>`;
}

function normalizeTabs(rawTabs: unknown, activeTab: unknown, nodeId: string): TabItem[] {
  if (!Array.isArray(rawTabs)) return [];
  const activeId = asString(activeTab);
  const tabs: TabItem[] = [];
  for (let index = 0; index < rawTabs.length; index += 1) {
    const entry = rawTabs[index];
    if (isRecord(entry)) {
      const id = asString(entry.id) ?? `${nodeId}-tab-${index + 1}`;
      const label = asString(entry.label) ?? asString(entry.title) ?? `Tab ${index + 1}`;
      const panel = asString(entry.panel) ?? asString(entry.content) ?? '';
      const active = Boolean(entry.active) || (activeId ? activeId === id : index === 0);
      tabs.push({ id, label, panel, active });
      continue;
    }
    const label = serializePropValue(entry) || `Tab ${index + 1}`;
    const id = `${nodeId}-tab-${index + 1}`;
    tabs.push({ id, label, panel: '', active: activeId ? activeId === id : index === 0 });
  }
  if (!tabs.some((tab) => tab.active) && tabs[0]) {
    tabs[0].active = true;
  }
  return tabs;
}

function renderTabs(node: UiElement, childrenHtml = ''): string {
  const props = isRecord(node.props) ? node.props : {};
  const attrs = buildAttributes(node, {
    allowedHtmlAttrs: GENERIC_HTML_ATTRS,
    consumedProps: new Set(['tabs', 'activeTab']),
  });

  const tabs = normalizeTabs(props.tabs, props.activeTab, node.id);
  if (tabs.length === 0) {
    return `<section${attrs}>${childrenHtml}</section>`;
  }

  const tabButtons = tabs
    .map((tab, index) => {
      const buttonId = `${node.id}-tab-button-${index + 1}`;
      const panelId = `${node.id}-tab-panel-${index + 1}`;
      return `<button role="tab" id="${escapeHtml(buttonId)}" aria-controls="${escapeHtml(panelId)}" aria-selected="${tab.active ? 'true' : 'false'}" tabindex="${tab.active ? '0' : '-1'}">${escapeHtml(tab.label)}</button>`;
    })
    .join('');

  const tabPanels = tabs
    .map((tab, index) => {
      const buttonId = `${node.id}-tab-button-${index + 1}`;
      const panelId = `${node.id}-tab-panel-${index + 1}`;
      return `<div role="tabpanel" id="${escapeHtml(panelId)}" aria-labelledby="${escapeHtml(buttonId)}"${tab.active ? '' : ' hidden'}>${escapeHtml(tab.panel)}</div>`;
    })
    .join('');

  return `<section${attrs}><div role="tablist">${tabButtons}</div>${tabPanels}</section>`;
}

function renderFallback(node: UiElement, childrenHtml = ''): string {
  const attrs = buildAttributes(node, {
    allowedHtmlAttrs: GENERIC_HTML_ATTRS,
    dataOverrides: { 'data-oods-fallback': 'true' },
  });
  const label = escapeHtml(`Unknown component: ${node.component}`);
  return `<div${attrs}><span data-oods-fallback-label="true">${label}</span>${childrenHtml}</div>`;
}

export const componentRenderers: Record<string, ComponentRenderer> = {
  Button: renderButton,
  Card: renderCard,
  Stack: renderStack,
  Text: renderText,
  Input: renderInput,
  Select: renderSelect,
  Badge: renderBadge,
  Banner: renderBanner,
  Table: renderTable,
  Tabs: renderTabs,
};

export function renderMappedComponent(node: UiElement, childrenHtml = ''): string {
  const renderer = componentRenderers[node.component] ?? renderFallback;
  return renderer(node, childrenHtml);
}

export function hasMappedRenderer(componentName: string): boolean {
  return Object.prototype.hasOwnProperty.call(componentRenderers, componentName);
}
