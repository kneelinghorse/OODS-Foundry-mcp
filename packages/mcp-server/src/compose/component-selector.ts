/**
 * Component selection engine.
 *
 * Given a slot intent description and the component catalog,
 * picks the best-fit component(s) using deterministic heuristic
 * scoring based on catalog metadata.
 *
 * Scoring signals (in priority order):
 *   1. Explicit intent mapping (known intent → component name)
 *   2. Tag keyword overlap
 *   3. Context match
 *   4. Region match
 *   5. Category match
 *   6. Trait coverage bonus
 */
import type { ComponentCatalogEntry } from '../tools/types.js';

/* ------------------------------------------------------------------ */
/*  Types                                                              */
/* ------------------------------------------------------------------ */

export interface SelectionCandidate {
  /** Component name from catalog. */
  name: string;
  /** Confidence score 0–1. */
  confidence: number;
  /** Human-readable reason for selection. */
  reason: string;
}

export interface SelectionResult {
  /** Ranked candidates, highest confidence first. */
  candidates: SelectionCandidate[];
  /** The intent that was matched. */
  intent: string;
  /** Warning if intent is unknown or no good matches found. */
  warning?: string;
}

/* ------------------------------------------------------------------ */
/*  Intent → signal mappings                                           */
/* ------------------------------------------------------------------ */

/**
 * Known intents map to preferred component names and metadata signals.
 * The selector uses these to boost exact matches.
 */
interface IntentSignals {
  /** Preferred component name(s), in priority order. */
  preferredComponents?: string[];
  /** Tags the intent expects to match. */
  tags?: string[];
  /** Contexts where this intent makes sense. */
  contexts?: string[];
  /** Regions where this intent fits. */
  regions?: string[];
  /** Categories this intent biases toward. */
  categories?: string[];
}

const INTENT_MAP: Record<string, IntentSignals> = {
  'action-button': {
    preferredComponents: ['Button'],
    tags: ['action', 'interactive'],
    regions: ['actions'],
    categories: ['primitive'],
  },
  'text-input': {
    preferredComponents: ['Input', 'TagInput'],
    tags: ['interactive', 'input'],
    contexts: ['form'],
    regions: ['forms', 'form'],
    categories: ['primitive', 'behavioral'],
  },
  'form-input': {
    preferredComponents: ['Input', 'Select', 'TagInput'],
    tags: ['interactive', 'input'],
    contexts: ['form'],
    regions: ['forms', 'form'],
  },
  'data-table': {
    preferredComponents: ['Table'],
    tags: ['data', 'tabular'],
    contexts: ['list', 'detail'],
    regions: ['main'],
  },
  'data-display': {
    preferredComponents: ['Card', 'Table', 'Stack'],
    tags: ['data', 'container', 'surface'],
    contexts: ['detail', 'list'],
    regions: ['main'],
  },
  'data-list': {
    preferredComponents: ['Stack', 'Table'],
    tags: ['data', 'container'],
    contexts: ['list'],
    regions: ['main', 'list'],
  },
  'metrics-display': {
    preferredComponents: ['Card', 'Badge', 'Text'],
    tags: ['container', 'surface', 'status'],
    contexts: ['card', 'detail'],
    regions: ['card', 'main'],
  },
  'status-indicator': {
    preferredComponents: ['StatusBadge', 'Badge', 'ColorizedBadge'],
    tags: ['status', 'indicator'],
    contexts: ['inline', 'detail', 'list'],
    regions: ['badges', 'inline'],
    categories: ['lifecycle', 'visual'],
  },
  'page-header': {
    preferredComponents: ['Text', 'DetailHeader'],
    tags: ['heading', 'title'],
    contexts: ['detail'],
    regions: ['main'],
  },
  'navigation-panel': {
    preferredComponents: ['Stack', 'Tabs'],
    tags: ['navigation', 'container'],
    contexts: ['detail', 'list'],
    regions: ['contextPanel', 'main'],
  },
  'filter-control': {
    preferredComponents: ['Select', 'Input'],
    tags: ['filter', 'interactive'],
    contexts: ['list', 'form'],
    regions: ['actions', 'forms'],
  },
  'pagination-control': {
    preferredComponents: ['Text', 'Button'],
    tags: ['navigation', 'pagination'],
    contexts: ['list'],
    regions: ['actions'],
  },
  'metadata-display': {
    preferredComponents: ['Stack', 'Text', 'Badge'],
    tags: ['metadata', 'summary'],
    contexts: ['detail'],
    regions: ['detail', 'contextPanel'],
  },
  'tab-panel': {
    preferredComponents: ['Tabs'],
    tags: ['navigation', 'container', 'tab'],
    contexts: ['detail'],
    regions: ['main'],
  },
};

/* ------------------------------------------------------------------ */
/*  Scoring weights                                                    */
/* ------------------------------------------------------------------ */

const WEIGHTS = {
  /** Exact preferred component match. */
  preferredComponent: 0.40,
  /** Tag keyword overlap (per matching tag). */
  tagMatch: 0.08,
  /** Context overlap (per matching context). */
  contextMatch: 0.10,
  /** Region overlap (per matching region). */
  regionMatch: 0.06,
  /** Category overlap (per matching category). */
  categoryMatch: 0.05,
  /** Trait count bonus (having traits = richer component). */
  traitBonus: 0.02,
  /** Keyword match in component name or displayName. */
  nameKeyword: 0.15,
} as const;

/** Maximum possible score (used for normalization). */
const MAX_RAW_SCORE = 1.0;

/* ------------------------------------------------------------------ */
/*  Scoring engine                                                     */
/* ------------------------------------------------------------------ */

function tokenizeIntent(intent: string): string[] {
  return intent
    .toLowerCase()
    .split(/[-_\s]+/)
    .filter(Boolean);
}

function intersectionCount(a: string[], b: string[]): number {
  const setB = new Set(b.map(s => s.toLowerCase()));
  return a.filter(item => setB.has(item.toLowerCase())).length;
}

function scoreComponent(
  component: ComponentCatalogEntry,
  intent: string,
  signals: IntentSignals | undefined,
  keywords: string[],
): { score: number; reasons: string[] } {
  let score = 0;
  const reasons: string[] = [];

  // 1. Preferred component match
  if (signals?.preferredComponents) {
    const rank = signals.preferredComponents.indexOf(component.name);
    if (rank !== -1) {
      // First preferred gets full weight, subsequent get diminishing scores
      const preferredScore = WEIGHTS.preferredComponent * (1 - rank * 0.15);
      score += Math.max(preferredScore, WEIGHTS.preferredComponent * 0.3);
      reasons.push(`preferred for "${intent}" (rank ${rank + 1})`);
    }
  }

  // 2. Tag keyword overlap
  if (signals?.tags) {
    const overlap = intersectionCount(signals.tags, component.tags);
    if (overlap > 0) {
      score += WEIGHTS.tagMatch * Math.min(overlap, 3);
      reasons.push(`${overlap} tag match(es)`);
    }
  }

  // Also match intent keywords against component tags
  const tagKeywordOverlap = intersectionCount(keywords, component.tags);
  if (tagKeywordOverlap > 0) {
    score += WEIGHTS.tagMatch * 0.5 * Math.min(tagKeywordOverlap, 2);
    reasons.push(`${tagKeywordOverlap} keyword→tag match(es)`);
  }

  // 3. Context match
  if (signals?.contexts) {
    const overlap = intersectionCount(signals.contexts, component.contexts);
    if (overlap > 0) {
      score += WEIGHTS.contextMatch * Math.min(overlap, 2);
      reasons.push(`${overlap} context match(es)`);
    }
  }

  // 4. Region match
  if (signals?.regions) {
    const overlap = intersectionCount(signals.regions, component.regions);
    if (overlap > 0) {
      score += WEIGHTS.regionMatch * Math.min(overlap, 2);
      reasons.push(`${overlap} region match(es)`);
    }
  }

  // 5. Category match
  if (signals?.categories) {
    const overlap = intersectionCount(signals.categories, component.categories);
    if (overlap > 0) {
      score += WEIGHTS.categoryMatch * Math.min(overlap, 2);
      reasons.push(`${overlap} category match(es)`);
    }
  }

  // 6. Trait bonus
  if (component.traits.length > 0) {
    score += WEIGHTS.traitBonus * Math.min(component.traits.length, 3);
    reasons.push(`${component.traits.length} trait(s)`);
  }

  // 7. Name keyword match
  const nameLower = component.name.toLowerCase();
  const displayLower = component.displayName.toLowerCase();
  for (const kw of keywords) {
    if (nameLower.includes(kw) || displayLower.includes(kw)) {
      score += WEIGHTS.nameKeyword;
      reasons.push(`name contains "${kw}"`);
      break; // Only count once
    }
  }

  return { score: Math.min(score, MAX_RAW_SCORE), reasons };
}

/* ------------------------------------------------------------------ */
/*  Public API                                                         */
/* ------------------------------------------------------------------ */

export interface SelectOptions {
  /** Max number of candidates to return (default: 5). */
  topN?: number;
  /** Minimum confidence threshold (default: 0.05). */
  minConfidence?: number;
}

/**
 * Select the best-fit component(s) for a given slot intent.
 *
 * @param intent - Typed intent string (e.g., "action-button", "data-table")
 * @param catalog - Array of ComponentCatalogEntry from the component catalog
 * @param options - Selection options
 * @returns Ranked list of candidates with confidence scores
 */
export function selectComponent(
  intent: string,
  catalog: ComponentCatalogEntry[],
  options: SelectOptions = {},
): SelectionResult {
  const { topN = 5, minConfidence = 0.05 } = options;

  if (!intent || !intent.trim()) {
    return {
      intent: '',
      candidates: [],
      warning: 'Empty intent provided; no components selected.',
    };
  }

  const normalizedIntent = intent.trim().toLowerCase();
  const keywords = tokenizeIntent(normalizedIntent);
  const signals = INTENT_MAP[normalizedIntent];

  const scored = catalog.map(component => {
    const { score, reasons } = scoreComponent(component, normalizedIntent, signals, keywords);
    return {
      name: component.name,
      confidence: score,
      reason: reasons.length > 0 ? reasons.join('; ') : 'no matching signals',
    };
  });

  // Sort by confidence descending, then alphabetically for ties
  scored.sort((a, b) => {
    if (b.confidence !== a.confidence) return b.confidence - a.confidence;
    return a.name.localeCompare(b.name);
  });

  const filtered = scored.filter(c => c.confidence >= minConfidence);
  const candidates = filtered.slice(0, topN);

  // Normalize confidence scores so the top candidate is 1.0 (if any)
  if (candidates.length > 0 && candidates[0].confidence > 0) {
    const topScore = candidates[0].confidence;
    for (const c of candidates) {
      c.confidence = Math.round((c.confidence / topScore) * 100) / 100;
    }
  }

  const result: SelectionResult = { intent: normalizedIntent, candidates };

  if (!signals) {
    result.warning = `Unknown intent "${normalizedIntent}"; results based on keyword matching only.`;
  }

  if (candidates.length === 0) {
    result.warning = `No components matched intent "${normalizedIntent}" above confidence threshold.`;
  }

  return result;
}

/**
 * Load the component catalog from the catalog.list tool handler.
 * Convenience wrapper that returns just the entries.
 */
export async function loadCatalog(): Promise<ComponentCatalogEntry[]> {
  const { handle } = await import('../tools/catalog.list.js');
  const result = await handle({});
  return result.components;
}
