/**
 * View extension collector (s62-m02).
 *
 * Given a ComposedObject and a target context, gathers all view_extensions
 * for that context and returns a SlotPlan[] sorted by priority desc, then
 * trait declaration order. Each entry includes the source trait name for
 * downstream attribution.
 */

import type { ComposedObject } from '../objects/trait-composer.js';
import type { ViewExtension } from '../objects/types.js';

/* ------------------------------------------------------------------ */
/*  Types                                                              */
/* ------------------------------------------------------------------ */

export interface SlotPlan {
  /** Component name from the view_extension */
  component: string;
  /** Trait that contributed this extension (e.g. "lifecycle/Stateful") */
  sourceTrait: string;
  /** Position hint: top, bottom, main, sidebar, before, after */
  position: string;
  /** Priority for ordering (higher = earlier). Defaults to 0. */
  priority: number;
  /** Trait-defined props including field mappings */
  props: Record<string, unknown>;
}

export interface CollectResult {
  /** Ordered slot plan entries for the target context */
  plan: SlotPlan[];
  /** Warning messages (e.g., empty context) */
  warnings: string[];
}

/* ------------------------------------------------------------------ */
/*  Collector                                                          */
/* ------------------------------------------------------------------ */

interface RankedEntry {
  plan: SlotPlan;
  traitOrder: number;
}

/**
 * Collect view_extensions for a specific context from a composed object.
 *
 * Iterates the resolved traits in declaration order, extracts view_extensions
 * for the target context, and returns a SlotPlan[] sorted by:
 *   1. Priority descending (higher priority first)
 *   2. Trait declaration order ascending (earlier trait first on tie)
 */
export function collectViewExtensions(
  composed: ComposedObject,
  context: string,
): CollectResult {
  const warnings: string[] = [];
  const ranked: RankedEntry[] = [];

  for (let traitOrder = 0; traitOrder < composed.traits.length; traitOrder++) {
    const resolved = composed.traits[traitOrder];
    const traitName = resolved.ref.name;
    const extensions: ViewExtension[] =
      resolved.definition.view_extensions?.[context] ?? [];

    for (const ext of extensions) {
      ranked.push({
        plan: {
          component: ext.component,
          sourceTrait: traitName,
          position: ext.position ?? 'main',
          priority: ext.priority ?? 0,
          props: ext.props ?? {},
        },
        traitOrder,
      });
    }
  }

  if (ranked.length === 0) {
    warnings.push(
      `No view_extensions found for context "${context}" in object "${composed.object.name}". ` +
        `Available contexts: ${Object.keys(composed.viewExtensions).join(', ') || 'none'}`,
    );
  }

  // Sort: priority desc, then trait declaration order asc
  ranked.sort((a, b) => {
    if (b.plan.priority !== a.plan.priority) {
      return b.plan.priority - a.plan.priority;
    }
    return a.traitOrder - b.traitOrder;
  });

  return {
    plan: ranked.map((r) => r.plan),
    warnings,
  };
}
