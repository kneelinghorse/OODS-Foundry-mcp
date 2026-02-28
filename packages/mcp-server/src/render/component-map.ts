import type { UiElement } from '../schemas/generated.js';
import { escapeHtml } from './escape-html.js';

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
const FORM_LABEL_HTML_ATTRS = new Set(['for', 'title']);
const FORM_HTML_ATTRS = new Set(['action', 'method', 'autocomplete', 'novalidate', 'title']);
const FIELDSET_HTML_ATTRS = new Set(['title']);

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === 'object' && !Array.isArray(value);
}

function asString(value: unknown): string | undefined {
  return typeof value === 'string' && value.length > 0 ? value : undefined;
}

function asNumber(value: unknown): number | undefined {
  if (typeof value === 'number' && Number.isFinite(value)) return value;
  if (typeof value === 'string' && value.trim().length > 0) {
    const parsed = Number.parseInt(value, 10);
    if (Number.isFinite(parsed)) return parsed;
  }
  return undefined;
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

function firstString(props: Record<string, unknown>, keys: string[]): string | undefined {
  for (const key of keys) {
    const value = asString(props[key]);
    if (value) return value;
  }
  return undefined;
}

function firstSerialized(props: Record<string, unknown>, keys: string[]): string | undefined {
  for (const key of keys) {
    const value = props[key];
    if (value === undefined || value === null) continue;
    const asText = asString(value);
    if (asText) return asText;
    if (typeof value === 'number' || typeof value === 'boolean' || typeof value === 'bigint') {
      return String(value);
    }
  }
  return undefined;
}

function headingTag(level: unknown, fallback: number): string {
  const parsed = asNumber(level) ?? fallback;
  const bounded = Math.max(1, Math.min(6, parsed));
  return `h${bounded}`;
}

function truncateText(value: string, maxLength: unknown): string {
  const limit = asNumber(maxLength);
  if (!limit || limit <= 0 || value.length <= limit) return value;
  return `${value.slice(0, Math.max(0, limit - 1)).trimEnd()}...`;
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

function normalizeGridToken(token: string): string {
  return token.trim().replace(/[.\s_]+/g, '-');
}

function renderGrid(node: UiElement, childrenHtml = ''): string {
  const props = isRecord(node.props) ? node.props : {};
  const columns = asNumber(props.columns);
  const rows = asNumber(props.rows);
  const gap = asString(props.gap);
  const columnGap = asString(props.columnGap);
  const rowGap = asString(props.rowGap);

  const gridStyles: string[] = ['display:grid'];
  if (columns) {
    gridStyles.push(`grid-template-columns:repeat(${columns}, minmax(0, 1fr))`);
  }
  if (rows) {
    gridStyles.push(`grid-template-rows:repeat(${rows}, minmax(0, 1fr))`);
  }
  if (gap) {
    gridStyles.push(`gap:var(--ref-spacing-${normalizeGridToken(gap)})`);
  }
  if (columnGap) {
    gridStyles.push(`column-gap:var(--ref-spacing-${normalizeGridToken(columnGap)})`);
  }
  if (rowGap) {
    gridStyles.push(`row-gap:var(--ref-spacing-${normalizeGridToken(rowGap)})`);
  }

  // Merge with any existing style from layout/style token resolution
  const existingStyle = typeof props.style === 'string' && props.style.trim() ? props.style.trim().replace(/;+\s*$/, '') : '';
  const mergedStyle = existingStyle ? `${existingStyle};${gridStyles.join(';')}` : gridStyles.join(';');

  const attrs = buildAttributes(node, {
    allowedHtmlAttrs: GENERIC_HTML_ATTRS,
    consumedProps: new Set(['columns', 'rows', 'gap', 'columnGap', 'rowGap', 'style']),
    htmlOverrides: { style: mergedStyle },
    dataOverrides: { 'data-layout': 'grid' },
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

type BadgePrimitiveOptions = {
  defaultLabel: string;
  labelKeys?: string[];
  statusKeys?: string[];
  variantKeys?: string[];
  colorKeys?: string[];
  defaultVariant?: string;
};

function renderBadgePrimitive(node: UiElement, childrenHtml: string, options: BadgePrimitiveOptions): string {
  const props = isRecord(node.props) ? node.props : {};
  const labelKeys = options.labelKeys ?? ['label', 'text', 'value', 'title', 'name'];
  const statusKeys = options.statusKeys ?? ['status', 'state', 'value'];
  const variantKeys = options.variantKeys ?? ['variant', 'tone', 'intent'];
  const colorKeys = options.colorKeys ?? ['color', 'hue', 'swatch', 'resolution', 'palette'];

  const status = firstSerialized(props, statusKeys);
  const variant = firstSerialized(props, variantKeys) ?? options.defaultVariant;
  const color = firstSerialized(props, colorKeys);
  const label = firstSerialized(props, labelKeys) ?? node.meta?.label ?? options.defaultLabel;
  const dataOverrides: Record<string, unknown> = {};
  if (status) dataOverrides['data-badge-status'] = status;
  if (variant) dataOverrides['data-badge-variant'] = variant;
  if (color) dataOverrides['data-badge-color'] = color;

  const attrs = buildAttributes(node, {
    allowedHtmlAttrs: GENERIC_HTML_ATTRS,
    consumedProps: new Set([...labelKeys, ...statusKeys, ...variantKeys, ...colorKeys]),
    dataOverrides,
  });

  const content = hasChildrenHtml(childrenHtml) ? childrenHtml : escapeHtml(label);
  return `<span${attrs}>${content}</span>`;
}

function normalizeBadgeItems(value: unknown): string[] {
  if (!Array.isArray(value)) return [];
  const items: string[] = [];
  for (const entry of value) {
    if (entry === undefined || entry === null) continue;
    if (isRecord(entry)) {
      const text = firstSerialized(entry, ['label', 'name', 'role', 'value', 'id']);
      if (text) items.push(text);
      continue;
    }
    items.push(serializePropValue(entry));
  }
  return items.filter((item) => item.length > 0);
}

function renderStatusBadge(node: UiElement, childrenHtml = ''): string {
  return renderBadgePrimitive(node, childrenHtml, {
    defaultLabel: 'Status',
    labelKeys: ['label', 'text', 'status', 'state', 'value'],
    statusKeys: ['status', 'state', 'value'],
    defaultVariant: 'status',
  });
}

function renderCancellationBadge(node: UiElement, childrenHtml = ''): string {
  return renderBadgePrimitive(node, childrenHtml, {
    defaultLabel: 'Cancellation',
    labelKeys: ['label', 'text', 'status', 'state', 'cancelAtPeriodEnd', 'value'],
    statusKeys: ['status', 'state', 'cancelAtPeriodEnd', 'isCancelled', 'value'],
    defaultVariant: 'cancellation',
  });
}

function renderArchivePill(node: UiElement, childrenHtml = ''): string {
  return renderBadgePrimitive(node, childrenHtml, {
    defaultLabel: 'Archive',
    labelKeys: ['label', 'text', 'status', 'state', 'isArchived', 'value'],
    statusKeys: ['status', 'state', 'isArchived', 'value'],
    defaultVariant: 'archive',
  });
}

function renderColorizedBadge(node: UiElement, childrenHtml = ''): string {
  return renderBadgePrimitive(node, childrenHtml, {
    defaultLabel: 'Color',
    labelKeys: ['label', 'text', 'state', 'value'],
    statusKeys: ['status', 'state', 'value'],
    colorKeys: ['color', 'hue', 'swatch', 'state'],
    defaultVariant: 'colorized',
  });
}

function renderPreferenceSummaryBadge(node: UiElement, childrenHtml = ''): string {
  return renderBadgePrimitive(node, childrenHtml, {
    defaultLabel: 'Preferences',
    labelKeys: ['label', 'text', 'namespace', 'value'],
    statusKeys: ['status', 'state', 'version'],
    defaultVariant: 'preference',
  });
}

function renderClassificationBadge(node: UiElement, childrenHtml = ''): string {
  return renderBadgePrimitive(node, childrenHtml, {
    defaultLabel: 'Classification',
    labelKeys: ['label', 'text', 'category', 'value'],
    statusKeys: ['status', 'state', 'mode'],
    defaultVariant: 'classification',
  });
}

function renderOwnerBadge(node: UiElement, childrenHtml = ''): string {
  return renderBadgePrimitive(node, childrenHtml, {
    defaultLabel: 'Owner',
    labelKeys: ['label', 'text', 'owner', 'ownerType', 'value'],
    statusKeys: ['status', 'state'],
    defaultVariant: 'owner',
  });
}

function renderMessageStatusBadge(node: UiElement, childrenHtml = ''): string {
  return renderBadgePrimitive(node, childrenHtml, {
    defaultLabel: 'Message',
    labelKeys: ['label', 'text', 'status', 'delivery', 'value'],
    statusKeys: ['status', 'state', 'delivery', 'value'],
    defaultVariant: 'message',
  });
}

function renderGeoResolutionBadge(node: UiElement, childrenHtml = ''): string {
  return renderBadgePrimitive(node, childrenHtml, {
    defaultLabel: 'Geo',
    labelKeys: ['label', 'text', 'resolution', 'value'],
    statusKeys: ['status', 'state', 'resolution'],
    colorKeys: ['resolution', 'color', 'hue'],
    defaultVariant: 'geo',
  });
}

function renderAddressSummaryBadge(node: UiElement, childrenHtml = ''): string {
  return renderBadgePrimitive(node, childrenHtml, {
    defaultLabel: 'Address',
    labelKeys: ['label', 'text', 'role', 'value'],
    statusKeys: ['status', 'state', 'role'],
    defaultVariant: 'address',
  });
}

function renderPriceBadge(node: UiElement, childrenHtml = ''): string {
  const props = isRecord(node.props) ? node.props : {};
  const cents = asNumber(props.amountCents ?? props.unitAmountCents);
  const amount = asNumber(props.amount ?? props.unitAmount);
  const currency = firstSerialized(props, ['currency', 'currencyCode']);
  const normalizedAmount = cents !== undefined ? cents / 100 : amount;
  const derivedAmount = normalizedAmount !== undefined
    ? (Number.isInteger(normalizedAmount) ? String(normalizedAmount) : normalizedAmount.toFixed(2))
    : undefined;
  const derivedLabel = derivedAmount ? `${currency ? `${currency.toUpperCase()} ` : ''}${derivedAmount}` : 'Price';

  return renderBadgePrimitive(node, childrenHtml, {
    defaultLabel: derivedLabel,
    labelKeys: ['label', 'text', 'value'],
    statusKeys: ['status', 'state'],
    variantKeys: ['variant', 'tone', 'currency'],
    defaultVariant: 'price',
  });
}

function renderRoleBadgeList(node: UiElement, childrenHtml = ''): string {
  const props = isRecord(node.props) ? node.props : {};
  const roles = normalizeBadgeItems(props.roles ?? props.badges ?? props.roleLabels ?? props.value);
  const variant = firstSerialized(props, ['variant', 'tone']) ?? 'roles';
  const attrs = buildAttributes(node, {
    allowedHtmlAttrs: GENERIC_HTML_ATTRS,
    consumedProps: new Set(['roles', 'badges', 'roleLabels', 'value', 'variant', 'tone', 'label', 'text']),
    dataOverrides: { 'data-badge-variant': variant },
  });

  if (hasChildrenHtml(childrenHtml)) {
    return `<span${attrs}>${childrenHtml}</span>`;
  }

  const listHtml = roles
    .map((role) => `<span data-role-badge="true">${escapeHtml(role)}</span>`)
    .join('');
  const fallbackLabel = firstSerialized(props, ['label', 'text']) ?? node.meta?.label ?? 'Roles';
  const content = listHtml || escapeHtml(fallbackLabel);
  return `<span${attrs}>${content}</span>`;
}

function renderCardHeader(node: UiElement, childrenHtml = ''): string {
  const props = isRecord(node.props) ? node.props : {};
  const attrs = buildAttributes(node, {
    allowedHtmlAttrs: GENERIC_HTML_ATTRS,
    consumedProps: new Set(['title', 'label', 'text', 'supporting', 'supportingText', 'subtitle', 'description', 'level']),
  });
  if (hasChildrenHtml(childrenHtml)) {
    return `<header${attrs}>${childrenHtml}</header>`;
  }

  const title = firstString(props, ['title', 'label', 'text']) ?? node.meta?.label ?? 'Card';
  const supporting = firstString(props, ['supporting', 'supportingText', 'subtitle', 'description']);
  const titleTag = headingTag(props.level, 3);
  const supportingHtml = supporting ? `<span data-oods-supporting="true">${escapeHtml(supporting)}</span>` : '';
  return `<header${attrs}><${titleTag}>${escapeHtml(title)}</${titleTag}>${supportingHtml}</header>`;
}

function renderDetailHeader(node: UiElement, childrenHtml = ''): string {
  const props = isRecord(node.props) ? node.props : {};
  const attrs = buildAttributes(node, {
    allowedHtmlAttrs: GENERIC_HTML_ATTRS,
    consumedProps: new Set([
      'title',
      'label',
      'text',
      'subtitle',
      'sublabel',
      'description',
      'metadata',
      'meta',
      'level',
    ]),
  });
  if (hasChildrenHtml(childrenHtml)) {
    return `<header${attrs}>${childrenHtml}</header>`;
  }

  const title = firstString(props, ['title', 'label', 'text']) ?? node.meta?.label ?? 'Details';
  const subtitle = firstString(props, ['subtitle', 'sublabel', 'description']);
  const metadata = firstString(props, ['metadata', 'meta']);
  const titleTag = headingTag(props.level, 2);
  const subtitleHtml = subtitle ? `<span data-oods-subtitle="true">${escapeHtml(subtitle)}</span>` : '';
  const metadataHtml = metadata ? `<span data-oods-metadata="true">${escapeHtml(metadata)}</span>` : '';

  return `<header${attrs}><${titleTag}>${escapeHtml(title)}</${titleTag}>${subtitleHtml}${metadataHtml}</header>`;
}

function renderFormLabelGroup(node: UiElement, childrenHtml = ''): string {
  const props = isRecord(node.props) ? node.props : {};
  const htmlFor = asString(props.htmlFor) ?? asString(props.for) ?? asString(props.inputId);
  const attrs = buildAttributes(node, {
    allowedHtmlAttrs: FORM_LABEL_HTML_ATTRS,
    consumedProps: new Set(['label', 'text', 'title', 'placeholder', 'hint', 'description', 'htmlFor', 'inputId']),
    htmlOverrides: htmlFor ? { for: htmlFor } : undefined,
  });

  const label = firstString(props, ['label', 'text', 'title']) ?? node.meta?.label ?? 'Label';
  const hint = firstString(props, ['placeholder', 'hint', 'description']);
  const labelHtml = `<span data-oods-form-label="true">${escapeHtml(label)}</span>`;
  const hintHtml = hint ? `<span data-oods-form-hint="true">${escapeHtml(hint)}</span>` : '';
  const content = hasChildrenHtml(childrenHtml) ? `${labelHtml}${childrenHtml}${hintHtml}` : `${labelHtml}${hintHtml}`;
  return `<label${attrs}>${content}</label>`;
}

function renderInlineLabel(node: UiElement, childrenHtml = ''): string {
  const props = isRecord(node.props) ? node.props : {};
  const attrs = buildAttributes(node, {
    allowedHtmlAttrs: GENERIC_HTML_ATTRS,
    consumedProps: new Set(['label', 'text', 'value', 'maxLength']),
  });
  const label = firstString(props, ['label', 'text', 'value']) ?? node.meta?.label ?? '';
  const content = hasChildrenHtml(childrenHtml) ? childrenHtml : escapeHtml(truncateText(label, props.maxLength));
  return `<span${attrs}>${content}</span>`;
}

function renderLabelCell(node: UiElement, childrenHtml = ''): string {
  const props = isRecord(node.props) ? node.props : {};
  const attrs = buildAttributes(node, {
    allowedHtmlAttrs: GENERIC_HTML_ATTRS,
    consumedProps: new Set([
      'label',
      'text',
      'value',
      'description',
      'subtitle',
      'sublabel',
      'supporting',
      'truncate',
      'maxLength',
    ]),
  });
  if (hasChildrenHtml(childrenHtml)) {
    return `<span${attrs}>${childrenHtml}</span>`;
  }

  const rawLabel = firstString(props, ['label', 'text', 'value']) ?? node.meta?.label ?? '';
  const rawDescription = firstString(props, ['description', 'subtitle', 'sublabel', 'supporting']);
  const maxLength = Boolean(props.truncate) ? props.maxLength ?? 40 : props.maxLength;
  const label = truncateText(rawLabel, maxLength);
  const description = rawDescription ? truncateText(rawDescription, maxLength) : undefined;
  const descriptionHtml = description
    ? `<span data-oods-label-cell-description="true">${escapeHtml(description)}</span>`
    : '';
  return `<span${attrs}><span data-oods-label-cell-primary="true">${escapeHtml(label)}</span>${descriptionHtml}</span>`;
}

type PanelOptions = {
  defaultTitle: string;
  panelType: string;
  titleKeys?: string[];
  subtitleKeys?: string[];
};

function renderPanelSection(node: UiElement, childrenHtml: string, options: PanelOptions): string {
  const props = isRecord(node.props) ? node.props : {};
  const titleKeys = options.titleKeys ?? ['title', 'label', 'heading', 'name'];
  const subtitleKeys = options.subtitleKeys ?? ['subtitle', 'description', 'metadata'];
  const title = firstSerialized(props, titleKeys) ?? node.meta?.label ?? options.defaultTitle;
  const subtitle = firstSerialized(props, subtitleKeys);
  const fallbackBody = firstSerialized(props, ['summary', 'text', 'body', 'emptyMessage']);
  const attrs = buildAttributes(node, {
    allowedHtmlAttrs: GENERIC_HTML_ATTRS,
    consumedProps: new Set([...titleKeys, ...subtitleKeys, 'summary', 'text', 'body', 'emptyMessage']),
    dataOverrides: { 'data-panel-type': options.panelType },
  });

  const headerHtml = `<header data-panel-header="true"><h3>${escapeHtml(title)}</h3>${
    subtitle ? `<span data-panel-subtitle="true">${escapeHtml(subtitle)}</span>` : ''
  }</header>`;
  const contentHtml = hasChildrenHtml(childrenHtml)
    ? childrenHtml
    : fallbackBody
      ? `<span data-panel-summary="true">${escapeHtml(fallbackBody)}</span>`
      : '';
  return `<section${attrs}>${headerHtml}<div data-panel-content="true">${contentHtml}</div></section>`;
}

function renderAddressCollectionPanel(node: UiElement, childrenHtml = ''): string {
  return renderPanelSection(node, childrenHtml, {
    defaultTitle: 'Addresses',
    panelType: 'address',
  });
}

function renderClassificationPanel(node: UiElement, childrenHtml = ''): string {
  return renderPanelSection(node, childrenHtml, {
    defaultTitle: 'Classification',
    panelType: 'classification',
  });
}

function renderCommunicationDetailPanel(node: UiElement, childrenHtml = ''): string {
  return renderPanelSection(node, childrenHtml, {
    defaultTitle: 'Communication',
    panelType: 'communication',
  });
}

function renderMembershipPanel(node: UiElement, childrenHtml = ''): string {
  return renderPanelSection(node, childrenHtml, {
    defaultTitle: 'Membership',
    panelType: 'membership',
  });
}

function renderPreferencePanel(node: UiElement, childrenHtml = ''): string {
  return renderPanelSection(node, childrenHtml, {
    defaultTitle: 'Preferences',
    panelType: 'preference',
  });
}

type FormContainerOptions = {
  tag: 'form' | 'fieldset';
  defaultTitle: string;
  formType: string;
};

function renderInputControl(
  label: string,
  name: string,
  value?: string,
  options: { type?: string; placeholder?: string } = {}
): string {
  const type = options.type ?? 'text';
  const valueAttr = value !== undefined ? ` value="${escapeHtml(value)}"` : '';
  const placeholderAttr = options.placeholder ? ` placeholder="${escapeHtml(options.placeholder)}"` : '';
  return `<label data-form-control="input"><span>${escapeHtml(label)}</span><input type="${escapeHtml(type)}" name="${escapeHtml(
    name
  )}"${valueAttr}${placeholderAttr} /></label>`;
}

function renderTextareaControl(label: string, name: string, value?: string): string {
  return `<label data-form-control="textarea"><span>${escapeHtml(label)}</span><textarea name="${escapeHtml(name)}">${
    value ? escapeHtml(value) : ''
  }</textarea></label>`;
}

function renderSelectControl(label: string, name: string, optionsSource: unknown, selectedValue?: unknown): string {
  const options = normalizeSelectOptions(optionsSource, selectedValue);
  const optionsHtml =
    options.length > 0
      ? options
        .map((option) => `<option value="${escapeHtml(option.value)}"${option.selected ? ' selected' : ''}>${escapeHtml(option.label)}</option>`)
        .join('')
      : '<option value="">Select...</option>';
  return `<label data-form-control="select"><span>${escapeHtml(label)}</span><select name="${escapeHtml(name)}">${optionsHtml}</select></label>`;
}

function renderFormContainer(node: UiElement, childrenHtml: string, generatedBody: string, options: FormContainerOptions): string {
  const props = isRecord(node.props) ? node.props : {};
  const titleKeys = ['title', 'label', 'heading', 'name'];
  const subtitleKeys = ['description', 'subtitle', 'hint'];
  const title = firstSerialized(props, titleKeys) ?? node.meta?.label ?? options.defaultTitle;
  const subtitle = firstSerialized(props, subtitleKeys);
  const content = hasChildrenHtml(childrenHtml) ? childrenHtml : generatedBody;
  const attrs = buildAttributes(node, {
    allowedHtmlAttrs: options.tag === 'form' ? FORM_HTML_ATTRS : FIELDSET_HTML_ATTRS,
    consumedProps: new Set([...titleKeys, ...subtitleKeys]),
    dataOverrides: { 'data-form-type': options.formType },
  });
  const heading =
    options.tag === 'form'
      ? `<header data-form-header="true"><h3>${escapeHtml(title)}</h3>${subtitle ? `<span data-form-subtitle="true">${escapeHtml(subtitle)}</span>` : ''}</header>`
      : `<legend>${escapeHtml(title)}</legend>${subtitle ? `<span data-form-subtitle="true">${escapeHtml(subtitle)}</span>` : ''}`;
  return `<${options.tag}${attrs}>${heading}<div data-form-content="true">${content}</div></${options.tag}>`;
}

function renderAddressEditor(node: UiElement, childrenHtml = ''): string {
  const props = isRecord(node.props) ? node.props : {};
  const body = [
    renderInputControl('Street', 'street', firstSerialized(props, ['street', 'line1', 'addressLine1'])),
    renderInputControl('City', 'city', firstSerialized(props, ['city'])),
    renderInputControl('Region', 'region', firstSerialized(props, ['region', 'state'])),
    renderInputControl('Postal Code', 'postalCode', firstSerialized(props, ['postalCode', 'zip'])),
  ].join('');
  return renderFormContainer(node, childrenHtml, body, {
    tag: 'form',
    defaultTitle: 'Address Editor',
    formType: 'address-editor',
  });
}

function renderClassificationEditor(node: UiElement, childrenHtml = ''): string {
  const props = isRecord(node.props) ? node.props : {};
  const modeOptions = Array.isArray(props.modes) ? props.modes : ['strict', 'flexible'];
  const body = [
    renderInputControl('Category', 'category', firstSerialized(props, ['category', 'primaryCategory'])),
    renderInputControl('Tags', 'tags', firstSerialized(props, ['tags']), { placeholder: 'tag-1, tag-2' }),
    renderSelectControl('Mode', 'mode', modeOptions, props.mode ?? props.classificationMode),
  ].join('');
  return renderFormContainer(node, childrenHtml, body, {
    tag: 'form',
    defaultTitle: 'Classification Editor',
    formType: 'classification-editor',
  });
}

function renderPreferenceEditor(node: UiElement, childrenHtml = ''): string {
  const props = isRecord(node.props) ? node.props : {};
  const namespaceOptions = Array.isArray(props.namespaces) ? props.namespaces : ['default'];
  const body = [
    renderSelectControl('Namespace', 'namespace', namespaceOptions, props.namespace),
    renderTextareaControl('Preference Document', 'preferenceDocument', firstSerialized(props, ['document', 'json', 'value'])),
  ].join('');
  return renderFormContainer(node, childrenHtml, body, {
    tag: 'form',
    defaultTitle: 'Preference Editor',
    formType: 'preference-editor',
  });
}

function renderRoleAssignmentForm(node: UiElement, childrenHtml = ''): string {
  const props = isRecord(node.props) ? node.props : {};
  const roles = props.roles ?? props.availableRoles ?? [];
  const body = [
    renderSelectControl('Role', 'role', roles, props.role ?? props.defaultRoleId),
    renderInputControl('Assignee', 'assignee', firstSerialized(props, ['assignee', 'member'])),
  ].join('');
  return renderFormContainer(node, childrenHtml, body, {
    tag: 'form',
    defaultTitle: 'Role Assignment',
    formType: 'role-assignment',
  });
}

function renderCancellationForm(node: UiElement, childrenHtml = ''): string {
  const props = isRecord(node.props) ? node.props : {};
  const reasons = props.allowedReasons ?? ['no_longer_needed', 'budget', 'duplicate'];
  const body = [
    renderSelectControl('Reason Code', 'reasonCode', reasons, props.reasonCode),
    renderTextareaControl('Reason', 'reason', firstSerialized(props, ['reason', 'cancellationReason'])),
  ].join('');
  return renderFormContainer(node, childrenHtml, body, {
    tag: 'form',
    defaultTitle: 'Cancellation Form',
    formType: 'cancellation',
  });
}

function renderTagInput(node: UiElement, childrenHtml = ''): string {
  const props = isRecord(node.props) ? node.props : {};
  const tags = normalizeBadgeItems(props.tags ?? props.value);
  const tagsHtml = tags.length
    ? `<div data-tag-list="true">${tags.map((tag) => `<span data-tag-item="true">${escapeHtml(tag)}</span>`).join('')}</div>`
    : '';
  const body = `${renderInputControl('Tag', 'tag', undefined, { placeholder: firstSerialized(props, ['placeholder']) })}${tagsHtml}`;
  return renderFormContainer(node, childrenHtml, body, {
    tag: 'fieldset',
    defaultTitle: 'Tag Input',
    formType: 'tag-input',
  });
}

function renderTagManager(node: UiElement, childrenHtml = ''): string {
  const props = isRecord(node.props) ? node.props : {};
  const tags = normalizeBadgeItems(props.tags ?? props.value);
  const tagsHtml = tags.length
    ? `<div data-tag-list="true">${tags.map((tag) => `<span data-tag-item="true">${escapeHtml(tag)}</span>`).join('')}</div>`
    : '<div data-tag-list="true"></div>';
  const body = `${tagsHtml}${renderInputControl('Add Tag', 'newTag', undefined, { placeholder: 'Type a tag' })}`;
  return renderFormContainer(node, childrenHtml, body, {
    tag: 'form',
    defaultTitle: 'Tag Manager',
    formType: 'tag-manager',
  });
}

function renderGeoFieldMappingForm(node: UiElement, childrenHtml = ''): string {
  const props = isRecord(node.props) ? node.props : {};
  const autoDetect = firstSerialized(props, ['autoDetect', 'autoDetectField']) === 'true' ? ' checked' : '';
  const body = [
    renderInputControl('Latitude Field', 'latitudeField', firstSerialized(props, ['latitudeField'])),
    renderInputControl('Longitude Field', 'longitudeField', firstSerialized(props, ['longitudeField'])),
    renderInputControl('Identifier Field', 'identifierField', firstSerialized(props, ['identifierField'])),
    `<label data-form-control="checkbox"><input type="checkbox" name="autoDetect"${autoDetect} /><span>Auto detect fields</span></label>`,
  ].join('');
  return renderFormContainer(node, childrenHtml, body, {
    tag: 'form',
    defaultTitle: 'Geo Field Mapping',
    formType: 'geo-mapping',
  });
}

function renderColorStatePicker(node: UiElement, childrenHtml = ''): string {
  const props = isRecord(node.props) ? node.props : {};
  const colorStates = props.colorStates ?? props.options ?? ['default', 'success', 'warning', 'critical'];
  const body = renderSelectControl('Color State', 'colorState', colorStates, props.colorState ?? props.value);
  return renderFormContainer(node, childrenHtml, body, {
    tag: 'fieldset',
    defaultTitle: 'Color State Picker',
    formType: 'color-state-picker',
  });
}

function renderTemplatePicker(node: UiElement, childrenHtml = ''): string {
  const props = isRecord(node.props) ? node.props : {};
  const templates = props.templates ?? props.options ?? [];
  const channels = props.channels ?? ['email', 'sms', 'in_app'];
  const body = [
    renderSelectControl('Template', 'template', templates, props.templateId ?? props.value),
    renderSelectControl('Channel', 'channel', channels, props.channel),
  ].join('');
  return renderFormContainer(node, childrenHtml, body, {
    tag: 'fieldset',
    defaultTitle: 'Template Picker',
    formType: 'template-picker',
  });
}

type TimelineItem = {
  label: string;
  timestamp?: string;
  detail?: string;
};

type TimelineOptions = {
  defaultTitle: string;
  timelineType: string;
  eventKeys?: string[];
};

function normalizeTimelineItems(raw: unknown): TimelineItem[] {
  if (!Array.isArray(raw)) return [];
  const items: TimelineItem[] = [];
  for (const entry of raw) {
    if (entry === undefined || entry === null) continue;
    if (isRecord(entry)) {
      const label = firstSerialized(entry, ['label', 'title', 'event', 'status', 'state', 'text', 'name']) ?? 'Event';
      const timestamp = firstSerialized(entry, ['timestamp', 'datetime', 'time', 'at', 'createdAt', 'updatedAt']);
      const detail = firstSerialized(entry, ['detail', 'description', 'reason', 'message', 'from', 'to']);
      items.push({ label, timestamp, detail });
      continue;
    }
    items.push({ label: serializePropValue(entry) });
  }
  return items;
}

function renderTimelineContainer(node: UiElement, childrenHtml: string, options: TimelineOptions): string {
  const props = isRecord(node.props) ? node.props : {};
  const title = firstSerialized(props, ['title', 'label', 'heading', 'name']) ?? node.meta?.label ?? options.defaultTitle;
  const keys = options.eventKeys ?? ['events', 'history', 'entries', 'items'];
  const rawEvents = keys.map((key) => props[key]).find((value) => Array.isArray(value));
  const events = normalizeTimelineItems(rawEvents);
  const attrs = buildAttributes(node, {
    allowedHtmlAttrs: GENERIC_HTML_ATTRS,
    consumedProps: new Set(['title', 'label', 'heading', 'name', ...keys]),
    dataOverrides: { 'data-timeline-type': options.timelineType },
    htmlOverrides: { role: 'log' },
  });

  const eventHtml = hasChildrenHtml(childrenHtml)
    ? childrenHtml
    : events.length
      ? events
        .map((item) => {
          const timeHtml = item.timestamp
            ? `<time data-timeline-time="true" datetime="${escapeHtml(item.timestamp)}">${escapeHtml(item.timestamp)}</time>`
            : '';
          const detailHtml = item.detail ? `<p data-timeline-detail="true">${escapeHtml(item.detail)}</p>` : '';
          return `<li><article data-timeline-event="true"><p data-timeline-label="true">${escapeHtml(item.label)}</p>${timeHtml}${detailHtml}</article></li>`;
        })
        .join('')
      : '<li data-timeline-empty="true">No events</li>';

  return `<div${attrs}><h3 data-timeline-title="true">${escapeHtml(title)}</h3><ol data-timeline-events="true">${eventHtml}</ol></div>`;
}

type EventOptions = {
  defaultLabel: string;
  eventType: string;
};

function renderEventArticle(node: UiElement, childrenHtml: string, options: EventOptions): string {
  const props = isRecord(node.props) ? node.props : {};
  const label = firstSerialized(props, ['label', 'title', 'event', 'status', 'state', 'reason', 'text']) ?? node.meta?.label ?? options.defaultLabel;
  const timestamp = firstSerialized(props, ['timestamp', 'datetime', 'time', 'at', 'createdAt', 'updatedAt']);
  const detail = firstSerialized(props, ['detail', 'description', 'reason', 'message', 'from', 'to', 'code']);
  const attrs = buildAttributes(node, {
    allowedHtmlAttrs: GENERIC_HTML_ATTRS,
    consumedProps: new Set(['label', 'title', 'event', 'status', 'state', 'reason', 'text', 'timestamp', 'datetime', 'time', 'at', 'createdAt', 'updatedAt', 'detail', 'description', 'message', 'from', 'to', 'code']),
    dataOverrides: { 'data-event-type': options.eventType },
  });

  if (hasChildrenHtml(childrenHtml)) {
    return `<article${attrs}>${childrenHtml}</article>`;
  }

  const timeHtml = timestamp ? `<time data-event-time="true" datetime="${escapeHtml(timestamp)}">${escapeHtml(timestamp)}</time>` : '';
  const detailHtml = detail ? `<p data-event-detail="true">${escapeHtml(detail)}</p>` : '';
  return `<article${attrs}>${timeHtml}<p data-event-label="true">${escapeHtml(label)}</p>${detailHtml}</article>`;
}

function renderAuditTimeline(node: UiElement, childrenHtml = ''): string {
  return renderTimelineContainer(node, childrenHtml, {
    defaultTitle: 'Audit Timeline',
    timelineType: 'audit',
    eventKeys: ['events', 'history', 'entries'],
  });
}

function renderAddressValidationTimeline(node: UiElement, childrenHtml = ''): string {
  return renderTimelineContainer(node, childrenHtml, {
    defaultTitle: 'Address Validation Timeline',
    timelineType: 'address-validation',
    eventKeys: ['events', 'validations', 'history'],
  });
}

function renderMembershipAuditTimeline(node: UiElement, childrenHtml = ''): string {
  return renderTimelineContainer(node, childrenHtml, {
    defaultTitle: 'Membership Timeline',
    timelineType: 'membership',
    eventKeys: ['events', 'memberships', 'history'],
  });
}

function renderMessageEventTimeline(node: UiElement, childrenHtml = ''): string {
  return renderTimelineContainer(node, childrenHtml, {
    defaultTitle: 'Message Timeline',
    timelineType: 'message',
    eventKeys: ['events', 'messages', 'statuses'],
  });
}

function renderPreferenceTimeline(node: UiElement, childrenHtml = ''): string {
  return renderTimelineContainer(node, childrenHtml, {
    defaultTitle: 'Preference Timeline',
    timelineType: 'preference',
    eventKeys: ['events', 'changes', 'history'],
  });
}

function renderStatusTimeline(node: UiElement, childrenHtml = ''): string {
  return renderTimelineContainer(node, childrenHtml, {
    defaultTitle: 'Status Timeline',
    timelineType: 'status',
    eventKeys: ['events', 'history', 'stateHistory'],
  });
}

function renderAuditEvent(node: UiElement, childrenHtml = ''): string {
  return renderEventArticle(node, childrenHtml, {
    defaultLabel: 'Audit Event',
    eventType: 'audit',
  });
}

function renderArchiveEvent(node: UiElement, childrenHtml = ''): string {
  return renderEventArticle(node, childrenHtml, {
    defaultLabel: 'Archive Event',
    eventType: 'archive',
  });
}

function renderCancellationEvent(node: UiElement, childrenHtml = ''): string {
  return renderEventArticle(node, childrenHtml, {
    defaultLabel: 'Cancellation Event',
    eventType: 'cancellation',
  });
}

function renderStateTransitionEvent(node: UiElement, childrenHtml = ''): string {
  return renderEventArticle(node, childrenHtml, {
    defaultLabel: 'State Transition',
    eventType: 'state-transition',
  });
}

function renderRelativeTimestamp(node: UiElement): string {
  const props = isRecord(node.props) ? node.props : {};
  const datetime = firstSerialized(props, ['datetime', 'timestamp', 'value', 'updatedAt', 'createdAt']);
  const relative = firstSerialized(props, ['relative', 'label', 'text', 'value']) ?? datetime ?? '';
  const attrs = buildAttributes(node, {
    allowedHtmlAttrs: new Set(['datetime', 'title']),
    consumedProps: new Set(['datetime', 'timestamp', 'value', 'updatedAt', 'createdAt', 'relative', 'label', 'text']),
    htmlOverrides: datetime ? { datetime } : undefined,
  });
  return `<time${attrs}>${escapeHtml(relative)}</time>`;
}

type SummaryField = {
  term: string;
  keys: string[];
};

type SummaryOptions = {
  defaultTitle: string;
  summaryType: string;
  fields: SummaryField[];
};

function renderSummarySection(node: UiElement, childrenHtml: string, options: SummaryOptions): string {
  const props = isRecord(node.props) ? node.props : {};
  const title = firstSerialized(props, ['title', 'label', 'heading', 'name']) ?? node.meta?.label ?? options.defaultTitle;
  const attrs = buildAttributes(node, {
    allowedHtmlAttrs: GENERIC_HTML_ATTRS,
    consumedProps: new Set(['title', 'label', 'heading', 'name']),
    dataOverrides: { 'data-summary-type': options.summaryType },
  });

  if (hasChildrenHtml(childrenHtml)) {
    return `<section${attrs}><h3 data-summary-title="true">${escapeHtml(title)}</h3>${childrenHtml}</section>`;
  }

  const entries = options.fields
    .map((field) => {
      const value = firstSerialized(props, field.keys);
      if (!value) return '';
      return `<div data-summary-item="true"><dt>${escapeHtml(field.term)}</dt><dd>${escapeHtml(value)}</dd></div>`;
    })
    .filter((entry) => entry.length > 0)
    .join('');
  const fallback = firstSerialized(props, ['summary', 'text', 'description']);
  const body = entries ? `<dl>${entries}</dl>` : fallback ? `<p data-summary-fallback="true">${escapeHtml(fallback)}</p>` : '<dl></dl>';
  return `<section${attrs}><h3 data-summary-title="true">${escapeHtml(title)}</h3>${body}</section>`;
}

type MetaOptions = {
  defaultTitle: string;
  metaType: string;
  fields: SummaryField[];
};

function renderMetaInline(node: UiElement, childrenHtml: string, options: MetaOptions): string {
  const props = isRecord(node.props) ? node.props : {};
  const attrs = buildAttributes(node, {
    allowedHtmlAttrs: GENERIC_HTML_ATTRS,
    dataOverrides: { 'data-meta-type': options.metaType },
  });
  if (hasChildrenHtml(childrenHtml)) {
    return `<div${attrs}>${childrenHtml}</div>`;
  }

  const title = firstSerialized(props, ['title', 'label', 'heading', 'name']) ?? node.meta?.label ?? options.defaultTitle;
  const values = options.fields
    .map((field) => {
      const value = firstSerialized(props, field.keys);
      if (!value) return '';
      return `<span data-meta-item="true"><strong>${escapeHtml(field.term)}:</strong> ${escapeHtml(value)}</span>`;
    })
    .filter((entry) => entry.length > 0)
    .join('');
  return `<div${attrs}><span data-meta-title="true">${escapeHtml(title)}</span>${values}</div>`;
}

function renderArchiveSummary(node: UiElement, childrenHtml = ''): string {
  return renderSummarySection(node, childrenHtml, {
    defaultTitle: 'Archive Summary',
    summaryType: 'archive',
    fields: [
      { term: 'Archived', keys: ['isArchived', 'archived', 'status'] },
      { term: 'Archived At', keys: ['archivedAt', 'archivedAtField'] },
      { term: 'Reason', keys: ['reason', 'archiveReason', 'reasonField'] },
    ],
  });
}

function renderCancellationSummary(node: UiElement, childrenHtml = ''): string {
  return renderSummarySection(node, childrenHtml, {
    defaultTitle: 'Cancellation Summary',
    summaryType: 'cancellation',
    fields: [
      { term: 'Cancel at Period End', keys: ['cancelAtPeriodEnd', 'cancelAtPeriodEndField'] },
      { term: 'Requested At', keys: ['requestedAt', 'requestedAtField'] },
      { term: 'Reason', keys: ['reason', 'cancellationReason', 'reasonField'] },
    ],
  });
}

function renderOwnershipSummary(node: UiElement, childrenHtml = ''): string {
  return renderSummarySection(node, childrenHtml, {
    defaultTitle: 'Ownership Summary',
    summaryType: 'ownership',
    fields: [
      { term: 'Owner ID', keys: ['ownerId', 'owner_id', 'ownerIdField'] },
      { term: 'Owner Type', keys: ['ownerType', 'owner_type', 'ownerTypeField'] },
      { term: 'Role', keys: ['role', 'ownershipRole', 'roleField'] },
    ],
  });
}

function renderPriceSummary(node: UiElement, childrenHtml = ''): string {
  return renderSummarySection(node, childrenHtml, {
    defaultTitle: 'Price Summary',
    summaryType: 'price',
    fields: [
      { term: 'Amount', keys: ['amount', 'amountCents', 'unitAmountCents', 'amountField'] },
      { term: 'Currency', keys: ['currency', 'currencyCode', 'currencyField'] },
      { term: 'Model', keys: ['model', 'pricingModel', 'modelField'] },
      { term: 'Interval', keys: ['interval', 'billingInterval', 'intervalField'] },
    ],
  });
}

function renderTagSummary(node: UiElement, childrenHtml = ''): string {
  return renderSummarySection(node, childrenHtml, {
    defaultTitle: 'Tag Summary',
    summaryType: 'tags',
    fields: [
      { term: 'Tag Count', keys: ['tagCount', 'count', 'countField'] },
      { term: 'Tags', keys: ['tags', 'field'] },
    ],
  });
}

function renderGeocodablePreview(node: UiElement, childrenHtml = ''): string {
  return renderSummarySection(node, childrenHtml, {
    defaultTitle: 'Geocodable Preview',
    summaryType: 'geocodable',
    fields: [
      { term: 'Resolution', keys: ['resolution', 'geoResolution', 'resolutionField'] },
      { term: 'Requires Lookup', keys: ['requiresLookup', 'requiresLookupField'] },
      { term: 'Detected Fields', keys: ['detectedFields', 'detectedFieldsField'] },
    ],
  });
}

function renderOwnershipMeta(node: UiElement, childrenHtml = ''): string {
  return renderMetaInline(node, childrenHtml, {
    defaultTitle: 'Ownership',
    metaType: 'ownership',
    fields: [
      { term: 'Owner Type', keys: ['ownerType', 'owner_type', 'ownerTypeField'] },
      { term: 'Role', keys: ['role', 'ownershipRole', 'roleField'] },
    ],
  });
}

function renderPriceCardMeta(node: UiElement, childrenHtml = ''): string {
  return renderMetaInline(node, childrenHtml, {
    defaultTitle: 'Price',
    metaType: 'price',
    fields: [
      { term: 'Model', keys: ['model', 'pricingModel', 'modelField'] },
      { term: 'Interval', keys: ['interval', 'billingInterval', 'intervalField'] },
    ],
  });
}

function renderTagPills(node: UiElement, childrenHtml = ''): string {
  const props = isRecord(node.props) ? node.props : {};
  const attrs = buildAttributes(node, {
    allowedHtmlAttrs: GENERIC_HTML_ATTRS,
    consumedProps: new Set(['tags', 'value', 'maxVisible', 'overflowLabel']),
    dataOverrides: { 'data-summary-type': 'tag-pills' },
  });
  if (hasChildrenHtml(childrenHtml)) {
    return `<div${attrs}>${childrenHtml}</div>`;
  }

  const tags = normalizeBadgeItems(props.tags ?? props.value);
  const maxVisible = asNumber(props.maxVisible) ?? tags.length;
  const visible = tags.slice(0, Math.max(0, maxVisible));
  const overflow = tags.length - visible.length;
  const overflowTemplate = firstSerialized(props, ['overflowLabel']);
  const overflowLabel = overflow > 0
    ? overflowTemplate
      ? overflowTemplate.replace('{{ tag_count }}', String(tags.length))
      : `+${overflow}`
    : '';
  const pillHtml = visible.map((tag) => `<span data-tag-pill="true">${escapeHtml(tag)}</span>`).join('');
  const overflowHtml = overflowLabel ? `<span data-tag-overflow="true">${escapeHtml(overflowLabel)}</span>` : '';
  return `<div${attrs}>${pillHtml}${overflowHtml}</div>`;
}

function renderStatusSelector(node: UiElement, childrenHtml = ''): string {
  const props = isRecord(node.props) ? node.props : {};
  const attrs = buildAttributes(node, {
    allowedHtmlAttrs: GENERIC_HTML_ATTRS,
    consumedProps: new Set(['label', 'title', 'options', 'states', 'value', 'status']),
    dataOverrides: { 'data-summary-type': 'status-selector' },
  });
  const label = firstSerialized(props, ['label', 'title']) ?? node.meta?.label ?? 'Status';
  const options = props.options ?? props.states ?? ['draft', 'active', 'inactive'];
  const selected = props.value ?? props.status;
  const control = renderSelectControl(label, 'status', options, selected);
  const content = hasChildrenHtml(childrenHtml) ? childrenHtml : control;
  return `<div${attrs}>${content}</div>`;
}

function renderColorSwatch(node: UiElement, childrenHtml = ''): string {
  const props = isRecord(node.props) ? node.props : {};
  const color = firstSerialized(props, ['color', 'value', 'state']) ?? 'default';
  const attrs = buildAttributes(node, {
    allowedHtmlAttrs: GENERIC_HTML_ATTRS,
    consumedProps: new Set(['color', 'value', 'state', 'label']),
    dataOverrides: { 'data-summary-type': 'color-swatch', 'data-swatch-color': color },
  });
  const label = firstSerialized(props, ['label']) ?? color;
  const content = hasChildrenHtml(childrenHtml) ? childrenHtml : escapeHtml(label);
  return `<span${attrs}>${content}</span>`;
}

function renderStatusColorLegend(node: UiElement, childrenHtml = ''): string {
  const props = isRecord(node.props) ? node.props : {};
  const attrs = buildAttributes(node, {
    allowedHtmlAttrs: GENERIC_HTML_ATTRS,
    consumedProps: new Set(['entries', 'legend', 'colorStates']),
    dataOverrides: { 'data-summary-type': 'status-color-legend' },
  });
  if (hasChildrenHtml(childrenHtml)) {
    return `<section${attrs}>${childrenHtml}</section>`;
  }

  const rawEntries = props.entries ?? props.legend ?? props.colorStates;
  const entries = Array.isArray(rawEntries) ? rawEntries : [];
  const legendItems = entries
    .map((entry) => {
      if (!isRecord(entry)) return '';
      const label = firstSerialized(entry, ['label', 'state', 'name']) ?? 'State';
      const color = firstSerialized(entry, ['color', 'value']) ?? '';
      return `<div data-legend-item="true"><dt>${escapeHtml(label)}</dt><dd>${escapeHtml(color)}</dd></div>`;
    })
    .filter((entry) => entry.length > 0)
    .join('');
  return `<section${attrs}><h3 data-summary-title="true">${escapeHtml(node.meta?.label ?? 'Status Color Legend')}</h3><dl>${legendItems}</dl></section>`;
}

function renderVizPreview(node: UiElement, childrenHtml: string, previewType: string, defaultLabel: string): string {
  const props = isRecord(node.props) ? node.props : {};
  const width = firstSerialized(props, ['width']) ?? '640';
  const height = firstSerialized(props, ['height']) ?? '360';
  const attrs = buildAttributes(node, {
    allowedHtmlAttrs: GENERIC_HTML_ATTRS,
    consumedProps: new Set(['width', 'height']),
    dataOverrides: {
      'data-viz-preview-type': previewType,
      'data-viz-width': width,
      'data-viz-height': height,
    },
  });
  const content = hasChildrenHtml(childrenHtml)
    ? childrenHtml
    : `<div data-viz-preview-placeholder="true">${escapeHtml(defaultLabel)} preview (${escapeHtml(width)} x ${escapeHtml(height)})</div>`;
  return `<div${attrs}>${content}</div>`;
}

function renderVizAreaControls(node: UiElement, childrenHtml = ''): string {
  const props = isRecord(node.props) ? node.props : {};
  const body = [
    renderSelectControl('Curve', 'curve', props.curves ?? ['linear', 'monotone', 'step'], props.curve),
    renderInputControl('Opacity', 'opacity', firstSerialized(props, ['opacity']), { type: 'number' }),
    renderInputControl('Baseline', 'baseline', firstSerialized(props, ['baseline'])),
    renderInputControl('Tension', 'tension', firstSerialized(props, ['tension']), { type: 'number' }),
  ].join('');
  return renderFormContainer(node, childrenHtml, body, {
    tag: 'fieldset',
    defaultTitle: 'Viz Area Controls',
    formType: 'viz-area-controls',
  });
}

function renderVizAreaPreview(node: UiElement, childrenHtml = ''): string {
  return renderVizPreview(node, childrenHtml, 'area', 'Area');
}

function renderVizMarkControls(node: UiElement, childrenHtml = ''): string {
  const props = isRecord(node.props) ? node.props : {};
  const body = [
    renderSelectControl('Orientation', 'orientation', props.orientations ?? ['vertical', 'horizontal'], props.orientation),
    renderInputControl('Band Padding', 'bandPadding', firstSerialized(props, ['padding']), { type: 'number' }),
    renderSelectControl('Stacking', 'stacking', props.stackModes ?? ['none', 'stack'], props.stacking),
    renderInputControl('Corner Radius', 'cornerRadius', firstSerialized(props, ['cornerRadius']), { type: 'number' }),
  ].join('');
  return renderFormContainer(node, childrenHtml, body, {
    tag: 'fieldset',
    defaultTitle: 'Viz Mark Controls',
    formType: 'viz-mark-controls',
  });
}

function renderVizMarkPreview(node: UiElement, childrenHtml = ''): string {
  return renderVizPreview(node, childrenHtml, 'mark', 'Mark');
}

function renderVizLineControls(node: UiElement, childrenHtml = ''): string {
  const props = isRecord(node.props) ? node.props : {};
  const body = [
    renderSelectControl('Curve', 'curve', props.curves ?? ['linear', 'monotone'], props.curve),
    renderInputControl('Stroke Width', 'strokeWidth', firstSerialized(props, ['strokeWidth']), { type: 'number' }),
    renderSelectControl('Line Join', 'lineJoin', props.joins ?? ['round', 'bevel', 'miter'], props.lineJoin),
    renderSelectControl('Markers', 'markers', props.markerModes ?? ['none', 'auto', 'all'], props.markers),
  ].join('');
  return renderFormContainer(node, childrenHtml, body, {
    tag: 'fieldset',
    defaultTitle: 'Viz Line Controls',
    formType: 'viz-line-controls',
  });
}

function renderVizLinePreview(node: UiElement, childrenHtml = ''): string {
  return renderVizPreview(node, childrenHtml, 'line', 'Line');
}

function renderVizPointControls(node: UiElement, childrenHtml = ''): string {
  const props = isRecord(node.props) ? node.props : {};
  const body = [
    renderSelectControl('Shape', 'shape', props.shapes ?? ['circle', 'square', 'diamond'], props.shape),
    renderInputControl('Size', 'size', firstSerialized(props, ['size']), { type: 'number' }),
    renderInputControl('Opacity', 'opacity', firstSerialized(props, ['opacity']), { type: 'number' }),
    renderInputControl('Stroke Width', 'strokeWidth', firstSerialized(props, ['strokeWidth']), { type: 'number' }),
  ].join('');
  return renderFormContainer(node, childrenHtml, body, {
    tag: 'fieldset',
    defaultTitle: 'Viz Point Controls',
    formType: 'viz-point-controls',
  });
}

function renderVizPointPreview(node: UiElement, childrenHtml = ''): string {
  return renderVizPreview(node, childrenHtml, 'point', 'Point');
}

function renderVizColorControls(node: UiElement, childrenHtml = ''): string {
  const props = isRecord(node.props) ? node.props : {};
  const body = [
    renderSelectControl('Scheme', 'scheme', props.schemes ?? ['blues', 'greens', 'viridis'], props.scheme),
    renderSelectControl('Channel', 'channel', props.channels ?? ['fill', 'stroke'], props.channel),
    renderSelectControl('Redundancy', 'redundancy', props.redundancyModes ?? ['none', 'shape', 'label'], props.redundancy),
    renderInputControl('Min Contrast', 'minContrast', firstSerialized(props, ['minContrast']), { type: 'number' }),
  ].join('');
  return renderFormContainer(node, childrenHtml, body, {
    tag: 'fieldset',
    defaultTitle: 'Viz Color Controls',
    formType: 'viz-color-controls',
  });
}

function renderVizColorLegendConfig(node: UiElement, childrenHtml = ''): string {
  return renderSummarySection(node, childrenHtml, {
    defaultTitle: 'Viz Color Legend',
    summaryType: 'viz-color-legend',
    fields: [
      { term: 'Field', keys: ['field', 'colorField'] },
      { term: 'Scheme', keys: ['scheme', 'colorScheme'] },
      { term: 'Redundancy', keys: ['redundancy', 'redundancyMode'] },
    ],
  });
}

function renderVizEncodingBadge(node: UiElement, childrenHtml = ''): string {
  return renderBadgePrimitive(node, childrenHtml, {
    defaultLabel: 'Encoding',
    labelKeys: ['label', 'axis', 'field', 'text', 'value'],
    statusKeys: ['axis', 'field', 'status'],
    defaultVariant: 'viz-encoding',
  });
}

function renderVizAxisControls(node: UiElement, childrenHtml = ''): string {
  const props = isRecord(node.props) ? node.props : {};
  const body = [
    renderInputControl('X Field', 'xField', firstSerialized(props, ['xField'])),
    renderInputControl('Y Field', 'yField', firstSerialized(props, ['yField'])),
    renderSelectControl('Scale', 'scale', props.scales ?? ['linear', 'band', 'temporal'], props.scale),
    renderInputControl('Axis Title', 'axisTitle', firstSerialized(props, ['axisTitle'])),
  ].join('');
  return renderFormContainer(node, childrenHtml, body, {
    tag: 'fieldset',
    defaultTitle: 'Viz Axis Controls',
    formType: 'viz-axis-controls',
  });
}

function renderVizAxisSummary(node: UiElement, childrenHtml = ''): string {
  return renderSummarySection(node, childrenHtml, {
    defaultTitle: 'Viz Axis Summary',
    summaryType: 'viz-axis-summary',
    fields: [
      { term: 'Axis', keys: ['axis'] },
      { term: 'Title', keys: ['axisTitle', 'title'] },
      { term: 'Scale', keys: ['scale'] },
      { term: 'Zero', keys: ['zero', 'includeZero'] },
    ],
  });
}

function renderVizSizeControls(node: UiElement, childrenHtml = ''): string {
  const props = isRecord(node.props) ? node.props : {};
  const body = [
    renderSelectControl('Strategy', 'strategy', props.strategies ?? ['range', 'area'], props.strategy),
    renderInputControl('Min Size', 'minSize', firstSerialized(props, ['min']), { type: 'number' }),
    renderInputControl('Max Size', 'maxSize', firstSerialized(props, ['max']), { type: 'number' }),
    renderInputControl('Max Area', 'maxArea', firstSerialized(props, ['maxArea']), { type: 'number' }),
  ].join('');
  return renderFormContainer(node, childrenHtml, body, {
    tag: 'fieldset',
    defaultTitle: 'Viz Size Controls',
    formType: 'viz-size-controls',
  });
}

function renderVizSizeSummary(node: UiElement, childrenHtml = ''): string {
  return renderSummarySection(node, childrenHtml, {
    defaultTitle: 'Viz Size Summary',
    summaryType: 'viz-size-summary',
    fields: [
      { term: 'Field', keys: ['field'] },
      { term: 'Strategy', keys: ['strategy'] },
      { term: 'Min', keys: ['min'] },
      { term: 'Max', keys: ['max'] },
    ],
  });
}

function renderVizScaleControls(node: UiElement, childrenHtml = ''): string {
  const props = isRecord(node.props) ? node.props : {};
  const body = [
    renderSelectControl('Scale Type', 'scaleType', props.types ?? ['linear', 'temporal'], props.type),
    renderInputControl('Domain Min', 'domainMin', firstSerialized(props, ['domainMin']), { type: 'number' }),
    renderInputControl('Domain Max', 'domainMax', firstSerialized(props, ['domainMax']), { type: 'number' }),
    renderInputControl('Range Min', 'rangeMin', firstSerialized(props, ['rangeMin']), { type: 'number' }),
    renderInputControl('Range Max', 'rangeMax', firstSerialized(props, ['rangeMax']), { type: 'number' }),
  ].join('');
  return renderFormContainer(node, childrenHtml, body, {
    tag: 'fieldset',
    defaultTitle: 'Viz Scale Controls',
    formType: 'viz-scale-controls',
  });
}

function renderVizScaleSummary(node: UiElement, childrenHtml = ''): string {
  return renderSummarySection(node, childrenHtml, {
    defaultTitle: 'Viz Scale Summary',
    summaryType: 'viz-scale-summary',
    fields: [
      { term: 'Type', keys: ['type'] },
      { term: 'Domain Min', keys: ['domainMin'] },
      { term: 'Domain Max', keys: ['domainMax'] },
      { term: 'Mode', keys: ['mode'] },
      { term: 'Timezone', keys: ['timezone'] },
    ],
  });
}

function renderVizRoleBadge(node: UiElement, childrenHtml = ''): string {
  return renderBadgePrimitive(node, childrenHtml, {
    defaultLabel: 'Viz Role',
    labelKeys: ['label', 'role', 'markRole', 'text', 'value'],
    statusKeys: ['role', 'status'],
    defaultVariant: 'viz-role',
  });
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
  CardHeader: renderCardHeader,
  AddressCollectionPanel: renderAddressCollectionPanel,
  ClassificationPanel: renderClassificationPanel,
  CommunicationDetailPanel: renderCommunicationDetailPanel,
  MembershipPanel: renderMembershipPanel,
  PreferencePanel: renderPreferencePanel,
  AddressEditor: renderAddressEditor,
  ClassificationEditor: renderClassificationEditor,
  PreferenceEditor: renderPreferenceEditor,
  RoleAssignmentForm: renderRoleAssignmentForm,
  CancellationForm: renderCancellationForm,
  TagInput: renderTagInput,
  TagManager: renderTagManager,
  GeoFieldMappingForm: renderGeoFieldMappingForm,
  ColorStatePicker: renderColorStatePicker,
  TemplatePicker: renderTemplatePicker,
  AuditTimeline: renderAuditTimeline,
  AddressValidationTimeline: renderAddressValidationTimeline,
  MembershipAuditTimeline: renderMembershipAuditTimeline,
  MessageEventTimeline: renderMessageEventTimeline,
  PreferenceTimeline: renderPreferenceTimeline,
  StatusTimeline: renderStatusTimeline,
  AuditEvent: renderAuditEvent,
  ArchiveEvent: renderArchiveEvent,
  CancellationEvent: renderCancellationEvent,
  StateTransitionEvent: renderStateTransitionEvent,
  RelativeTimestamp: renderRelativeTimestamp,
  ArchiveSummary: renderArchiveSummary,
  CancellationSummary: renderCancellationSummary,
  OwnershipMeta: renderOwnershipMeta,
  OwnershipSummary: renderOwnershipSummary,
  PriceCardMeta: renderPriceCardMeta,
  PriceSummary: renderPriceSummary,
  TagPills: renderTagPills,
  TagSummary: renderTagSummary,
  StatusSelector: renderStatusSelector,
  ColorSwatch: renderColorSwatch,
  StatusColorLegend: renderStatusColorLegend,
  GeocodablePreview: renderGeocodablePreview,
  VizAreaControls: renderVizAreaControls,
  VizAreaPreview: renderVizAreaPreview,
  VizMarkControls: renderVizMarkControls,
  VizMarkPreview: renderVizMarkPreview,
  VizLineControls: renderVizLineControls,
  VizLinePreview: renderVizLinePreview,
  VizPointControls: renderVizPointControls,
  VizPointPreview: renderVizPointPreview,
  VizColorControls: renderVizColorControls,
  VizColorLegendConfig: renderVizColorLegendConfig,
  VizEncodingBadge: renderVizEncodingBadge,
  VizAxisControls: renderVizAxisControls,
  VizAxisSummary: renderVizAxisSummary,
  VizSizeControls: renderVizSizeControls,
  VizSizeSummary: renderVizSizeSummary,
  VizScaleControls: renderVizScaleControls,
  VizScaleSummary: renderVizScaleSummary,
  VizRoleBadge: renderVizRoleBadge,
  DetailHeader: renderDetailHeader,
  FormLabelGroup: renderFormLabelGroup,
  InlineLabel: renderInlineLabel,
  LabelCell: renderLabelCell,
  Stack: renderStack,
  Grid: renderGrid,
  Text: renderText,
  Input: renderInput,
  Select: renderSelect,
  Badge: renderBadge,
  StatusBadge: renderStatusBadge,
  CancellationBadge: renderCancellationBadge,
  ArchivePill: renderArchivePill,
  ColorizedBadge: renderColorizedBadge,
  PreferenceSummaryBadge: renderPreferenceSummaryBadge,
  ClassificationBadge: renderClassificationBadge,
  OwnerBadge: renderOwnerBadge,
  MessageStatusBadge: renderMessageStatusBadge,
  GeoResolutionBadge: renderGeoResolutionBadge,
  AddressSummaryBadge: renderAddressSummaryBadge,
  PriceBadge: renderPriceBadge,
  RoleBadgeList: renderRoleBadgeList,
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
