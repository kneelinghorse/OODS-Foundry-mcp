/**
 * Dynamic slot expansion for object overflow (s73-m02).
 *
 * When an object has more fields than a template provides slots for,
 * this module expands the template by injecting additional slot elements.
 *
 * Expansion rules per layout:
 *   - detail: add extra tab slots (max 8 total)
 *   - dashboard: add metric card slots (max 12 total)
 *   - form: add field-group slots (max 10 total)
 *   - list: no expansion (columns are auto-managed)
 *
 * Caps prevent templates from becoming unwieldy.
 */

import type { UiElement } from '../schemas/generated.js';
import type { TemplateResult } from './templates/types.js';
import { uid, slotElement } from './templates/types.js';
import type { FieldDefinition } from '../objects/types.js';

/* ------------------------------------------------------------------ */
/*  Types                                                              */
/* ------------------------------------------------------------------ */

export interface ExpansionResult {
  /** The modified template with additional slots */
  template: TemplateResult;
  /** Number of slots added */
  slotsAdded: number;
  /** Whether expansion was performed */
  expanded: boolean;
  /** Reason for expansion or why it was skipped */
  reason: string;
  /** Field groups: maps slot name to assigned field names */
  fieldGroups?: Record<string, string[]>;
}

export interface ExpansionContext {
  /** Layout type */
  layout: 'detail' | 'dashboard' | 'form' | 'list';
  /** Object field schema */
  fields: Record<string, FieldDefinition>;
  /** Semantic types from object (maps field name to semantic type) */
  semanticTypes?: Record<string, string>;
}

/* ------------------------------------------------------------------ */
/*  Caps                                                               */
/* ------------------------------------------------------------------ */

const MAX_TABS = 8;
const MAX_METRIC_SLOTS = 12;
const MAX_FIELD_GROUPS = 10;

/** Fields per tab group in detail layout */
const FIELDS_PER_TAB = 4;
/** Threshold for KPI-type fields before dashboard expansion */
const KPI_THRESHOLD = 4;

/* ------------------------------------------------------------------ */
/*  KPI field detection                                                */
/* ------------------------------------------------------------------ */

const KPI_TYPES = new Set(['integer', 'number']);
const KPI_SEMANTIC_TYPES = new Set([
  'currency', 'percentage', 'rating', 'count', 'metric',
]);

function countKpiFields(
  fields: Record<string, FieldDefinition>,
  semanticTypes?: Record<string, string>,
): number {
  let count = 0;
  for (const [name, def] of Object.entries(fields)) {
    const semantic = semanticTypes?.[name];
    if (semantic && KPI_SEMANTIC_TYPES.has(semantic)) {
      count++;
    } else if (KPI_TYPES.has(def.type)) {
      count++;
    }
  }
  return count;
}

/* ------------------------------------------------------------------ */
/*  Field grouping                                                     */
/* ------------------------------------------------------------------ */

/** Semantic category buckets for field grouping. */
const SEMANTIC_CATEGORIES: Record<string, string> = {
  currency: 'pricing',
  percentage: 'metrics',
  rating: 'metrics',
  count: 'metrics',
  metric: 'metrics',
  status: 'status',
  identifier: 'identity',
  timestamp: 'temporal',
  color: 'visual',
  phone: 'contact',
  email: 'contact',
  role: 'choices',
};

const TYPE_CATEGORIES: Record<string, string> = {
  boolean: 'toggles',
  datetime: 'temporal',
  date: 'temporal',
  email: 'contact',
  url: 'links',
  array: 'collections',
};

function resolveSemanticCategory(semanticType?: string): string | undefined {
  if (!semanticType) return undefined;
  const lowerSemantic = semanticType.toLowerCase();

  for (const [token, category] of Object.entries(SEMANTIC_CATEGORIES)) {
    if (
      lowerSemantic === token
      || lowerSemantic.endsWith(`.${token}`)
      || lowerSemantic.includes(token)
    ) {
      return category;
    }
  }

  return undefined;
}

function isLongTextField(fieldName: string, fieldDef: FieldDefinition): boolean {
  if (fieldDef.type !== 'string') return false;

  const maxLength = typeof fieldDef.validation?.maxLength === 'number'
    ? fieldDef.validation.maxLength
    : undefined;
  const normalizedName = fieldName.replace(/[_-]+/g, ' ');
  const lowerText = `${normalizedName} ${fieldDef.description}`.toLowerCase();

  return Boolean(
    (maxLength && maxLength >= 120)
    || /\b(description|summary|notes?|message|comment|reason|details?|body|content|bio|explanation|free form)\b/.test(lowerText),
  );
}

/**
 * Group fields into semantic categories, then distribute across N slots.
 * Returns a map from slot name to field names.
 */
export function groupFieldsIntoSlots(
  fields: Record<string, FieldDefinition>,
  slotNames: string[],
  semanticTypes?: Record<string, string>,
): Record<string, string[]> {
  if (slotNames.length === 0) return {};

  // Categorize each field
  const categorized = new Map<string, string[]>();
  const uncategorized: string[] = [];

  for (const [fieldName, fieldDef] of Object.entries(fields)) {
    const semantic = semanticTypes?.[fieldName];
    const category = resolveSemanticCategory(semantic)
      ?? (fieldDef.validation?.enum && fieldDef.validation.enum.length > 0 ? 'choices' : undefined)
      ?? (isLongTextField(fieldName, fieldDef) ? 'narrative' : undefined)
      ?? TYPE_CATEGORIES[fieldDef.type]
      ?? undefined;

    if (category) {
      const list = categorized.get(category) ?? [];
      list.push(fieldName);
      categorized.set(category, list);
    } else {
      uncategorized.push(fieldName);
    }
  }

  // Distribute category groups round-robin into slots
  const result: Record<string, string[]> = {};
  for (const name of slotNames) {
    result[name] = [];
  }

  let slotIdx = 0;

  // First, assign each category group to a slot
  for (const [, fieldNames] of categorized) {
    const target = slotNames[slotIdx % slotNames.length];
    result[target].push(...fieldNames);
    slotIdx++;
  }

  // Then distribute uncategorized fields to fill remaining/sparse slots
  for (const fieldName of uncategorized) {
    // Find the slot with fewest fields
    let minSlot = slotNames[0];
    let minCount = result[minSlot].length;
    for (const name of slotNames) {
      if (result[name].length < minCount) {
        minSlot = name;
        minCount = result[name].length;
      }
    }
    result[minSlot].push(fieldName);
  }

  return result;
}

/* ------------------------------------------------------------------ */
/*  Expansion logic                                                    */
/* ------------------------------------------------------------------ */

function expandDetailTabs(
  template: TemplateResult,
  fieldCount: number,
  fields: Record<string, FieldDefinition>,
  semanticTypes?: Record<string, string>,
): ExpansionResult {
  const existingTabs = template.slots.filter(s => s.name.startsWith('tab-'));
  const existingTabCount = existingTabs.length;
  const neededTabs = Math.min(
    Math.ceil(fieldCount / FIELDS_PER_TAB),
    MAX_TABS,
  );

  if (neededTabs <= existingTabCount) {
    // Still compute field groups for existing tabs
    const allTabSlots = template.slots
      .filter(s => s.name.startsWith('tab-'))
      .map(s => s.name);
    const fieldGroups = groupFieldsIntoSlots(fields, allTabSlots, semanticTypes);

    return {
      template,
      slotsAdded: 0,
      expanded: false,
      reason: `${fieldCount} fields fit in ${existingTabCount} existing tabs`,
      fieldGroups,
    };
  }

  const toAdd = neededTabs - existingTabCount;
  const result = structuredClone(template);

  // Find the Tabs element in the schema tree
  const tabsEl = findElement(result.schema.screens, el => el.component === 'Tabs');

  for (let i = existingTabCount; i < neededTabs; i++) {
    const slotName = `tab-${i}`;
    const label = `Tab ${i + 1}`;

    result.slots.push({
      name: slotName,
      description: `Content for "${label}" tab (expanded)`,
      intent: 'data-display',
      required: false,
    });

    if (tabsEl) {
      const tabPanel: UiElement = {
        id: uid('detail-tab-panel'),
        component: 'Stack',
        layout: { type: 'stack', gapToken: 'cluster-default' },
        props: { label },
        children: [slotElement(slotName, 'data-display')],
      };
      tabsEl.children = tabsEl.children ?? [];
      tabsEl.children.push(tabPanel);
    }
  }

  // Compute field groups for all tabs (existing + expanded)
  const allTabSlots = result.slots
    .filter(s => s.name.startsWith('tab-'))
    .map(s => s.name);
  const fieldGroups = groupFieldsIntoSlots(fields, allTabSlots, semanticTypes);

  return {
    template: result,
    slotsAdded: toAdd,
    expanded: true,
    reason: `Expanded from ${existingTabCount} to ${neededTabs} tabs for ${fieldCount} fields`,
    fieldGroups,
  };
}

function expandDashboardMetrics(
  template: TemplateResult,
  kpiCount: number,
): ExpansionResult {
  // Dashboard has a single 'metrics' slot by default.
  // When kpiCount > KPI_THRESHOLD, add individual metric-N slots.
  if (kpiCount <= KPI_THRESHOLD) {
    return {
      template,
      slotsAdded: 0,
      expanded: false,
      reason: `${kpiCount} KPI fields fit within threshold (${KPI_THRESHOLD})`,
    };
  }

  const metricSlotCount = Math.min(kpiCount, MAX_METRIC_SLOTS);
  const result = structuredClone(template);

  // Find the Grid element (metrics container)
  const gridEl = findElement(result.schema.screens, el => el.component === 'Grid');

  for (let i = 0; i < metricSlotCount; i++) {
    const slotName = `metric-${i}`;

    result.slots.push({
      name: slotName,
      description: `Metric card ${i + 1} (expanded)`,
      intent: 'metrics-display',
      required: i < KPI_THRESHOLD,
    });

    if (gridEl) {
      gridEl.children = gridEl.children ?? [];
      gridEl.children.push(slotElement(slotName, 'metrics-display', 'Card'));
    }
  }

  // Update grid columns if needed
  if (gridEl?.props) {
    gridEl.props.columns = Math.min(metricSlotCount, 4);
  }

  return {
    template: result,
    slotsAdded: metricSlotCount,
    expanded: true,
    reason: `Added ${metricSlotCount} metric slots for ${kpiCount} KPI fields`,
  };
}

function expandFormFields(
  template: TemplateResult,
  fieldCount: number,
  fields: Record<string, FieldDefinition>,
  semanticTypes?: Record<string, string>,
): ExpansionResult {
  const existingFields = template.slots.filter(s => s.name.startsWith('field-'));
  const existingCount = existingFields.length;
  const neededGroups = Math.min(fieldCount, MAX_FIELD_GROUPS);

  if (neededGroups <= existingCount) {
    const allFieldSlots = template.slots
      .filter(s => s.name.startsWith('field-'))
      .map(s => s.name);

    return {
      template,
      slotsAdded: 0,
      expanded: false,
      reason: `${fieldCount} fields fit in ${existingCount} existing field groups`,
      fieldGroups: groupFieldsIntoSlots(fields, allFieldSlots, semanticTypes),
    };
  }

  const toAdd = neededGroups - existingCount;
  const result = structuredClone(template);

  // Find the form fields Stack (contains field-group children)
  const fieldsStack = findElement(result.schema.screens, el =>
    el.component === 'Stack' &&
    el.children?.some(c =>
      c.children?.some(gc => gc.meta?.intent?.startsWith('slot:field-')),
    ) === true,
  );

  for (let i = existingCount; i < neededGroups; i++) {
    const slotName = `field-${i}`;

    result.slots.push({
      name: slotName,
      description: `Form field group ${i + 1} (expanded)`,
      intent: 'form-input',
      required: false,
    });

    if (fieldsStack) {
      const fieldGroup: UiElement = {
        id: uid('form-field-group'),
        component: 'Stack',
        layout: { type: 'stack', gapToken: 'cluster-tight' },
        children: [slotElement(slotName, 'form-input')],
      };
      fieldsStack.children = fieldsStack.children ?? [];
      fieldsStack.children.push(fieldGroup);
    }
  }

  const allFieldSlots = result.slots
    .filter(s => s.name.startsWith('field-'))
    .map(s => s.name);

  return {
    template: result,
    slotsAdded: toAdd,
    expanded: true,
    reason: `Expanded from ${existingCount} to ${neededGroups} field groups for ${fieldCount} fields`,
    fieldGroups: groupFieldsIntoSlots(fields, allFieldSlots, semanticTypes),
  };
}

/* ------------------------------------------------------------------ */
/*  Public API                                                         */
/* ------------------------------------------------------------------ */

/**
 * Expand template slots when an object has more fields than the template
 * can accommodate. Returns the (potentially modified) template and metadata.
 */
export function expandSlots(
  template: TemplateResult,
  context: ExpansionContext,
): ExpansionResult {
  const fieldCount = Object.keys(context.fields).length;

  switch (context.layout) {
    case 'detail':
      return expandDetailTabs(template, fieldCount, context.fields, context.semanticTypes);

    case 'dashboard': {
      const kpiCount = countKpiFields(context.fields, context.semanticTypes);
      return expandDashboardMetrics(template, kpiCount);
    }

    case 'form':
      return expandFormFields(template, fieldCount, context.fields, context.semanticTypes);

    case 'list':
      return {
        template,
        slotsAdded: 0,
        expanded: false,
        reason: 'List layout manages columns automatically',
      };
  }
}

/* ------------------------------------------------------------------ */
/*  Helpers                                                            */
/* ------------------------------------------------------------------ */

function findElement(
  screens: UiElement[],
  predicate: (el: UiElement) => boolean,
): UiElement | undefined {
  for (const screen of screens) {
    const found = walkFind(screen, predicate);
    if (found) return found;
  }
  return undefined;
}

function walkFind(
  el: UiElement,
  predicate: (el: UiElement) => boolean,
): UiElement | undefined {
  if (predicate(el)) return el;
  if (el.children) {
    for (const child of el.children) {
      const found = walkFind(child, predicate);
      if (found) return found;
    }
  }
  return undefined;
}
