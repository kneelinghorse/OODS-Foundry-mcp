/**
 * Tab/section label generator (s62-m05).
 *
 * For object-aware composition, derives meaningful tab labels from trait
 * categories instead of generic "Tab 1", "Tab 2", "Tab 3". Groups
 * view_extensions by trait category and maps categories to human-readable
 * labels. User-provided tabLabels in preferences take precedence.
 */

import type { ComposedObject, ResolvedTrait } from '../objects/trait-composer.js';
import type { ViewExtension } from '../objects/types.js';

/* ------------------------------------------------------------------ */
/*  Category → label mapping                                           */
/* ------------------------------------------------------------------ */

const CATEGORY_LABELS: Record<string, string> = {
  lifecycle: 'Status & History',
  financial: 'Billing',
  content: 'Content',
  core: 'Overview',
  behavioral: 'Behavior',
  visual: 'Appearance',
  structural: 'Structure',
  viz: 'Visualization',
};

/**
 * Resolve a human-readable label for a trait category.
 * Falls back to Title Case of the category name.
 */
function categoryLabel(category: string): string {
  return CATEGORY_LABELS[category] ?? titleCase(category);
}

function titleCase(s: string): string {
  return s.charAt(0).toUpperCase() + s.slice(1);
}

/* ------------------------------------------------------------------ */
/*  Types                                                              */
/* ------------------------------------------------------------------ */

export interface LabelResult {
  /** Generated tab/section labels, one per trait category group */
  labels: string[];
  /** Number of view_extensions per label group */
  groupSizes: number[];
  /** Warnings (e.g., single category producing single tab) */
  warnings: string[];
}

/* ------------------------------------------------------------------ */
/*  Label generation                                                   */
/* ------------------------------------------------------------------ */

/**
 * Extract the trait category from a resolved trait.
 * Uses the trait definition's category field, falling back to
 * extracting the directory prefix from the trait ref name (e.g., "lifecycle/Stateful" → "lifecycle").
 */
function getTraitCategory(trait: ResolvedTrait): string {
  const definedCategory = trait.definition.trait.category;
  if (definedCategory) return definedCategory;

  // Fallback: extract from ref name if category-qualified
  const slash = trait.ref.name.indexOf('/');
  if (slash > 0) return trait.ref.name.slice(0, slash);

  return 'general';
}

/**
 * Generate tab/section labels from trait categories for a given context.
 *
 * Groups view_extensions by their source trait's category,
 * orders groups by total priority (highest first),
 * and maps each group to a human-readable label.
 *
 * @param composed - The composed object with resolved traits
 * @param context - View context (detail, list, form, etc.)
 * @param userLabels - Optional user-provided labels that override generated ones
 */
export function generateLabels(
  composed: ComposedObject,
  context: string,
  userLabels?: string[],
): LabelResult {
  const warnings: string[] = [];

  // Build category → extensions mapping with priority tracking
  const categoryGroups = new Map<string, { extensions: ViewExtension[]; totalPriority: number }>();

  for (const resolved of composed.traits) {
    const category = getTraitCategory(resolved);
    const extensions: ViewExtension[] = resolved.definition.view_extensions?.[context] ?? [];

    if (extensions.length === 0) continue;

    if (!categoryGroups.has(category)) {
      categoryGroups.set(category, { extensions: [], totalPriority: 0 });
    }

    const group = categoryGroups.get(category)!;
    for (const ext of extensions) {
      group.extensions.push(ext);
      group.totalPriority += ext.priority ?? 0;
    }
  }

  // No categories found
  if (categoryGroups.size === 0) {
    warnings.push(
      `No trait categories with view_extensions for context "${context}". ` +
        'Labels cannot be generated.',
    );
    return { labels: [], groupSizes: [], warnings };
  }

  // Sort groups by total priority descending
  const sortedGroups = Array.from(categoryGroups.entries()).sort(
    (a, b) => b[1].totalPriority - a[1].totalPriority,
  );

  // Generate labels
  const labels = sortedGroups.map(([category]) => categoryLabel(category));
  const groupSizes = sortedGroups.map(([, group]) => group.extensions.length);

  // Apply user overrides
  if (userLabels && userLabels.length > 0) {
    for (let i = 0; i < Math.min(userLabels.length, labels.length); i++) {
      labels[i] = userLabels[i];
    }
  }

  // Warn for single category
  if (labels.length === 1) {
    warnings.push(
      `Object "${composed.object.name}" has a single trait category group for context "${context}". ` +
        'Consider using a single-section layout instead of tabs.',
    );
  }

  return { labels, groupSizes, warnings };
}
