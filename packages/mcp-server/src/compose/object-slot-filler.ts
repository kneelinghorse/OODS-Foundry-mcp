/**
 * Object slot filler (s62-m03).
 *
 * Maps SlotPlan entries from view_extensions into UiSchema template slots.
 * Position heuristics match plan entries to template slots:
 *   top → header, main → main-content/tab-N, bottom → footer/actions,
 *   sidebar → metadata/sidebar.
 * Multiple entries targeting the same slot are stacked as children by priority.
 * Unfilled required slots fall back to selectComponent() text-based selection.
 * componentOverrides from preferences take precedence over view_extension placement.
 */

import type { UiElement, UiSchema, FieldSchemaEntry } from '../schemas/generated.js';
import type { FieldDefinition, SemanticMapping } from '../objects/types.js';
import type { TemplateResult } from './templates/types.js';
import { isSlotElement, uid } from './templates/types.js';
import type { SlotPlan } from './view-extension-collector.js';
import {
  selectComponent,
  type SelectionResult,
} from './component-selector.js';
import type { ComponentCatalogSummary } from '../tools/types.js';
import { getContentStrategy, type ContentStrategy } from '../codegen/content-strategy.js';
import { inferSlotPosition } from './position-affinity.js';
import type { FieldHint } from './field-affinity.js';

/* ------------------------------------------------------------------ */
/*  Types                                                              */
/* ------------------------------------------------------------------ */

export interface FillResult {
  /** The modified UiSchema with slots filled */
  schema: UiSchema;
  /** Slot filling decisions for each slot */
  placements: SlotPlacement[];
  /** Warning messages */
  warnings: string[];
}

export interface SlotPlacement {
  slotName: string;
  /** How it was filled: 'view_extension', 'override', 'fallback' */
  source: 'view_extension' | 'override' | 'fallback';
  components: string[];
}

/* ------------------------------------------------------------------ */
/*  Position → slot mapping                                            */
/* ------------------------------------------------------------------ */

/**
 * Position-to-slot heuristic mapping per template layout.
 * Each position can match multiple slot names; first match wins.
 */
const POSITION_TO_SLOTS: Record<string, string[]> = {
  top: ['header', 'title', 'banner'],
  header: ['search', 'header', 'title', 'banner'],
  main: ['main-content', 'tab-0', 'items'],
  bottom: ['footer', 'actions', 'pagination'],
  footer: ['pagination', 'footer', 'actions'],
  sidebar: ['metadata', 'sidebar', 'filters'],
  before: ['header', 'banner', 'title'],
  after: ['footer', 'actions'],
};

/**
 * Find the best matching slot for a position hint.
 * Returns the first slot name from the heuristic that exists in the template.
 */
function matchPositionToSlot(
  position: string,
  availableSlots: Set<string>,
): string | undefined {
  const candidates = POSITION_TO_SLOTS[position];
  if (!candidates) return undefined;
  return candidates.find((s) => availableSlots.has(s));
}

/* ------------------------------------------------------------------ */
/*  Tab distribution                                                   */
/* ------------------------------------------------------------------ */

/**
 * For detail layouts, distribute 'main' entries across tab-N slots
 * round-robin style when there are multiple tab slots available.
 */
function distributeToTabs(
  mainEntries: SlotPlan[],
  tabSlots: string[],
): Map<string, SlotPlan[]> {
  const distribution = new Map<string, SlotPlan[]>();
  for (const tab of tabSlots) {
    distribution.set(tab, []);
  }

  for (let i = 0; i < mainEntries.length; i++) {
    const targetTab = tabSlots[i % tabSlots.length];
    distribution.get(targetTab)!.push(mainEntries[i]);
  }

  return distribution;
}

/* ------------------------------------------------------------------ */
/*  Slot filler                                                        */
/* ------------------------------------------------------------------ */

export function fillSlotsWithObject(
  template: TemplateResult,
  slotPlan: SlotPlan[],
  catalog: ComponentCatalogSummary[],
  overrides?: Record<string, string>,
  intentContext?: string,
  fieldHints?: Map<string, FieldHint>,
): FillResult {
  const warnings: string[] = [];
  const placements: SlotPlacement[] = [];
  const knownComponents = new Set(catalog.map((c) => c.name));

  // Track which slots exist, which are filled, and which are locked by overrides
  const slotSet = new Set(template.slots.map((s) => s.name));
  const filledSlots = new Set<string>();
  const overriddenSlots = new Set<string>();
  const slotChildren = new Map<string, UiElement[]>();

  // Detect tab slots for distribution
  const tabSlots = template.slots
    .filter((s) => s.name.startsWith('tab-'))
    .map((s) => s.name)
    .sort();

  // ---- Phase 1: Apply componentOverrides first ----
  if (overrides) {
    for (const [slotName, componentName] of Object.entries(overrides)) {
      if (!slotSet.has(slotName)) continue;
      filledSlots.add(slotName);
      overriddenSlots.add(slotName);
      slotChildren.set(slotName, [
        buildElement(componentName, {}, `override-${slotName}`),
      ]);
      placements.push({
        slotName,
        source: 'override',
        components: [componentName],
      });
    }
  }

  // ---- Phase 2: Place view_extension entries by position ----

  // Separate 'main' entries for tab distribution
  const mainEntries: SlotPlan[] = [];
  const otherEntries: SlotPlan[] = [];

  for (const entry of slotPlan) {
    if (entry.position === 'main' && tabSlots.length > 0) {
      mainEntries.push(entry);
    } else {
      otherEntries.push(entry);
    }
  }

  // Distribute main entries across tabs
  if (mainEntries.length > 0 && tabSlots.length > 0) {
    const tabDistribution = distributeToTabs(mainEntries, tabSlots);
    for (const [tabSlot, entries] of tabDistribution) {
      if (overriddenSlots.has(tabSlot) || entries.length === 0) continue;
      filledSlots.add(tabSlot);

      const children: UiElement[] = [];
      const components: string[] = [];
      for (const entry of entries) {
        if (!knownComponents.has(entry.component)) {
          warnings.push(
            `Component "${entry.component}" from trait "${entry.sourceTrait}" not found in catalog.`,
          );
        }
        children.push(buildElement(entry.component, entry.props, `ve-${tabSlot}`));
        components.push(entry.component);
      }

      slotChildren.set(tabSlot, children);
      placements.push({
        slotName: tabSlot,
        source: 'view_extension',
        components,
      });
    }
  }

  // Place other (non-main) entries by position heuristic
  for (const entry of otherEntries) {
    const targetSlot = matchPositionToSlot(entry.position, slotSet);
    if (!targetSlot) {
      warnings.push(
        `No matching slot for position "${entry.position}" from ${entry.sourceTrait}/${entry.component}.`,
      );
      continue;
    }

    if (overriddenSlots.has(targetSlot)) {
      // Slot locked by override — skip view_extension
      continue;
    } else if (filledSlots.has(targetSlot)) {
      // Stack into existing slot (another view_extension already placed)
      const existing = slotChildren.get(targetSlot) ?? [];
      existing.push(buildElement(entry.component, entry.props, `ve-${targetSlot}`));
      slotChildren.set(targetSlot, existing);

      const placement = placements.find((p) => p.slotName === targetSlot);
      if (placement) {
        placement.components.push(entry.component);
      }
    } else {
      filledSlots.add(targetSlot);

      if (!knownComponents.has(entry.component)) {
        warnings.push(
          `Component "${entry.component}" from trait "${entry.sourceTrait}" not found in catalog.`,
        );
      }

      slotChildren.set(targetSlot, [
        buildElement(entry.component, entry.props, `ve-${targetSlot}`),
      ]);
      placements.push({
        slotName: targetSlot,
        source: 'view_extension',
        components: [entry.component],
      });
    }
  }

  // ---- Phase 3: Fallback for unfilled required slots ----
  for (const slot of template.slots) {
    if (filledSlots.has(slot.name)) continue;
    if (!slot.required) continue;

    const slotPosition = inferSlotPosition(slot.name);
    const result: SelectionResult = selectComponent(slot.intent, catalog, {
      topN: 1,
      intentContext: intentContext ? [intentContext, slot.description] : [slot.description],
      ...(fieldHints?.has(slot.name) ? { fieldHint: fieldHints.get(slot.name) } : {}),
      ...(slotPosition ? { slotPosition } : {}),
    });

    const selected = result.candidates[0]?.name;
    if (selected) {
      filledSlots.add(slot.name);
      slotChildren.set(slot.name, [
        buildElement(selected, {}, `fb-${slot.name}`),
      ]);
      placements.push({
        slotName: slot.name,
        source: 'fallback',
        components: [selected],
      });
    }
  }

  // ---- Phase 4: Apply to UiSchema ----
  const schema = structuredClone(template.schema);
  applyToSchema(schema, slotChildren);

  return { schema, placements, warnings };
}

/* ------------------------------------------------------------------ */
/*  Token injection                                                    */
/* ------------------------------------------------------------------ */

/**
 * Inject ComposedObject.tokens into the UiSchema as tokenOverrides.
 * Only string values are included (non-string values are skipped with a warning).
 */
export function injectTokenOverrides(
  schema: UiSchema,
  tokens: Record<string, unknown>,
): string[] {
  const warnings: string[] = [];
  const overrides: Record<string, string> = {};

  for (const [key, value] of Object.entries(tokens)) {
    if (typeof value === 'string') {
      overrides[key] = value;
    } else {
      warnings.push(
        `Token "${key}" has non-string value (${typeof value}), skipped.`,
      );
    }
  }

  if (Object.keys(overrides).length > 0) {
    schema.tokenOverrides = overrides;
  }

  return warnings;
}

/* ------------------------------------------------------------------ */
/*  Object schema bridge                                               */
/* ------------------------------------------------------------------ */

/**
 * Convert ComposedObject.schema (FieldDefinition map) into a codegen-friendly
 * objectSchema on the UiSchema root. Each FieldSchemaEntry carries type, required,
 * optional enum, description, and semanticType for downstream typed prop generation.
 */
export function populateObjectSchema(
  schema: UiSchema,
  fieldSchema: Record<string, FieldDefinition>,
  semantics?: Record<string, SemanticMapping>,
): void {
  const objectSchema: Record<string, FieldSchemaEntry> = {};

  for (const [fieldName, fieldDef] of Object.entries(fieldSchema)) {
    const entry: FieldSchemaEntry = {
      type: fieldDef.type,
      required: fieldDef.required,
    };

    if (fieldDef.description) {
      entry.description = fieldDef.description;
    }

    if (fieldDef.validation?.enum && fieldDef.validation.enum.length > 0) {
      entry.enum = fieldDef.validation.enum;
    }

    if (semantics?.[fieldName]?.semantic_type) {
      entry.semanticType = semantics[fieldName].semantic_type;
    }

    objectSchema[fieldName] = entry;
  }

  if (Object.keys(objectSchema).length > 0) {
    schema.objectSchema = objectSchema;
  }
}

/* ------------------------------------------------------------------ */
/*  Context-aware bindings                                             */
/* ------------------------------------------------------------------ */

/**
 * Context → default event binding map.
 * Each context defines which event bindings should appear on relevant elements.
 */
const CONTEXT_BINDINGS: Record<string, Record<string, string>> = {
  form: {
    onSubmit: 'handleSubmit',
    onChange: 'handleChange',
  },
  list: {
    onRowClick: 'handleRowClick',
    onSort: 'handleSort',
    onFilter: 'handleFilter',
  },
  detail: {
    onEdit: 'handleEdit',
    onDelete: 'handleDelete',
  },
};

/**
 * Populate UiElement.bindings with context-appropriate event mappings.
 * Form context adds onChange per field-bound component and onSubmit on the root form.
 * List/detail contexts add action bindings on the root screen element.
 * Only applies when a context is known; no-op otherwise (backward compatible).
 */
export function populateBindings(
  schema: UiSchema,
  context: string,
  fieldNames?: string[],
): void {
  const contextBindings = CONTEXT_BINDINGS[context];
  if (!contextBindings) return;

  for (const screen of schema.screens) {
    // Add context-level bindings to the root screen element
    screen.bindings = { ...screen.bindings, ...contextBindings };

    // For form context, walk the tree and add per-field onChange bindings
    if (context === 'form' && fieldNames && fieldNames.length > 0) {
      populateFormFieldBindings(screen, fieldNames);
    }
  }
}

/**
 * Walk the element tree and add per-field onChange bindings to elements
 * whose props reference a known field name (via `field` prop).
 */
function populateFormFieldBindings(el: UiElement, fieldNames: string[]): void {
  const fieldSet = new Set(fieldNames);

  const walk = (node: UiElement): void => {
    // If this element has a `field` prop matching a known field, add onChange binding
    const fieldProp = node.props?.field;
    if (typeof fieldProp === 'string' && fieldSet.has(fieldProp)) {
      node.bindings = {
        ...node.bindings,
        onChange: `handleChange_${fieldProp}`,
      };
    }
    node.children?.forEach(walk);
  };

  walk(el);
}

/* ------------------------------------------------------------------ */
/*  Field → component prop wiring                                      */
/* ------------------------------------------------------------------ */

/**
 * Field type to preferred component content strategy mapping.
 * Used to rank how well a field type matches a component's strategy.
 */
const FIELD_TYPE_PREFERRED_STRATEGY: Record<string, ContentStrategy[]> = {
  string:   ['children', 'label-prop', 'value-prop'],
  integer:  ['children', 'value-prop'],
  number:   ['children', 'value-prop'],
  boolean:  ['value-prop'],
  datetime: ['children'],
  date:     ['children'],
  email:    ['children', 'value-prop'],
  url:      ['children'],
  uuid:     ['children'],
};

/**
 * Enum fields prefer status/label display over plain text.
 */
const ENUM_PREFERRED_STRATEGY: ContentStrategy[] = ['status-prop', 'label-prop', 'children'];

/**
 * Walk the UiSchema tree and set `props.field` on leaf components that
 * match objectSchema fields. Uses field type, component content strategy,
 * and field name heuristics for intelligent matching.
 *
 * Each field is assigned to at most one component. Each leaf component
 * gets at most one field. Fields are matched in priority order:
 * required fields first, then by name match quality.
 */
export function wireFieldProps(
  schema: UiSchema,
): number {
  const objectSchema = schema.objectSchema;
  if (!objectSchema || Object.keys(objectSchema).length === 0) return 0;

  // Collect leaf components that accept field content
  const leafNodes: UiElement[] = [];
  const walkCollect = (el: UiElement): void => {
    const hasChildren = Array.isArray(el.children) && el.children.length > 0;
    if (!hasChildren && getContentStrategy(el.component) !== 'none') {
      leafNodes.push(el);
    }
    el.children?.forEach(walkCollect);
  };
  schema.screens.forEach(walkCollect);

  if (leafNodes.length === 0) return 0;

  // Sort fields: required first, then alphabetical
  const fields = Object.entries(objectSchema).sort(([aName, aEntry], [bName, bEntry]) => {
    if (aEntry.required !== bEntry.required) return aEntry.required ? -1 : 1;
    return aName.localeCompare(bName);
  });

  const assignedNodes = new Set<UiElement>();
  const assignedFields = new Set<string>();
  let boundCount = 0;

  // Pass 1: Try to match fields to components with strategy+type affinity
  for (const [fieldName, fieldEntry] of fields) {
    if (assignedFields.has(fieldName)) continue;

    const preferredStrategies = fieldEntry.enum && fieldEntry.enum.length > 0
      ? ENUM_PREFERRED_STRATEGY
      : FIELD_TYPE_PREFERRED_STRATEGY[fieldEntry.type] ?? ['children'];

    let bestNode: UiElement | undefined;
    let bestScore = -1;

    for (const node of leafNodes) {
      if (assignedNodes.has(node)) continue;

      const strategy = getContentStrategy(node.component);
      const strategyIdx = preferredStrategies.indexOf(strategy);
      if (strategyIdx < 0) continue;

      // Score: higher is better. Strategy match priority (inverted index) + name affinity bonus
      let score = (preferredStrategies.length - strategyIdx) * 10;

      // Bonus if the component name hints at the field
      const componentLower = node.component.toLowerCase();
      const fieldLower = fieldName.toLowerCase();
      if (componentLower.includes(fieldLower) || fieldLower.includes(componentLower)) {
        score += 5;
      }

      // Bonus if the node already has a props.field matching or similar
      if (node.props?.field === fieldName) {
        score += 20;
      }

      if (score > bestScore) {
        bestScore = score;
        bestNode = node;
      }
    }

    if (bestNode) {
      bestNode.props = { ...bestNode.props, field: fieldName };
      assignedNodes.add(bestNode);
      assignedFields.add(fieldName);
      boundCount++;
    }
  }

  return boundCount;
}

/* ------------------------------------------------------------------ */
/*  Selection → tree application                                       */
/* ------------------------------------------------------------------ */

/**
 * Selection entry from fillSlots() in design.compose.ts.
 * Mirrors SlotSelectionEntry but only needs slotName + selectedComponent.
 */
export interface SelectionEntry {
  slotName: string;
  selectedComponent?: string;
}

/**
 * Apply computed selection results to the UiSchema tree.
 *
 * Walks the tree looking for slot placeholder elements (identified by
 * meta.intent = "slot:<name>") and replaces their `component` with
 * the top-ranked selected component from the selection engine.
 *
 * This bridges the gap where fillSlots() generates intelligence-aware
 * rankings (field affinity, position affinity) but doesn't modify the tree.
 */
export function applySelectionsToSchema(
  schema: UiSchema,
  selections: SelectionEntry[],
): number {
  const selectionMap = new Map<string, string>();
  for (const sel of selections) {
    if (sel.selectedComponent) {
      selectionMap.set(sel.slotName, sel.selectedComponent);
    }
  }

  if (selectionMap.size === 0) return 0;

  let applied = 0;

  const walk = (el: UiElement): void => {
    if (isSlotElement(el)) {
      const slotName = resolveSlotName(el);
      if (slotName && selectionMap.has(slotName)) {
        el.component = selectionMap.get(slotName)!;
        applied++;
      }
    }
    el.children?.forEach(walk);
  };

  schema.screens.forEach(walk);
  return applied;
}

/* ------------------------------------------------------------------ */
/*  Helpers                                                            */
/* ------------------------------------------------------------------ */

function buildElement(
  component: string,
  props: Record<string, unknown>,
  prefix: string,
): UiElement {
  const el: UiElement = {
    id: uid(prefix),
    component,
  };
  if (Object.keys(props).length > 0) {
    el.props = props;
  }
  return el;
}

function resolveSlotName(el: UiElement): string | undefined {
  if (el.meta?.label) return el.meta.label;
  if (el.meta?.intent?.startsWith('slot:')) {
    return el.meta.intent.slice('slot:'.length);
  }
  return undefined;
}

function applyToSchema(
  schema: UiSchema,
  slotChildren: Map<string, UiElement[]>,
): void {
  const walk = (el: UiElement): void => {
    if (isSlotElement(el)) {
      const slotName = resolveSlotName(el);
      if (slotName && slotChildren.has(slotName)) {
        const children = slotChildren.get(slotName)!;
        if (children.length === 1) {
          // Single component: replace the slot element directly
          el.component = children[0].component;
          el.props = children[0].props;
          // Keep meta for traceability
        } else if (children.length > 1) {
          // Multiple components: wrap in a Stack
          el.component = 'Stack';
          el.children = children;
          el.layout = { type: 'stack', gapToken: 'cluster-default' };
        }
      }
    }
    el.children?.forEach(walk);
  };

  schema.screens.forEach(walk);
}
