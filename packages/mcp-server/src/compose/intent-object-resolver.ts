/**
 * Intent + object hybrid resolver (s62-m06).
 *
 * Resolves the relationship between intent strings and object names:
 * - Auto-detects object names mentioned in intent strings
 * - Auto-detects context keywords (detail, list, form) from intent
 * - Generates synthetic intent when only object is provided
 * - Fuzzy-matches unknown object names to suggest closest match
 */

import { listObjects } from '../objects/object-loader.js';

/* ------------------------------------------------------------------ */
/*  Types                                                              */
/* ------------------------------------------------------------------ */

export interface ResolvedIntent {
  /** Final intent string (may be synthetic) */
  intent: string;
  /** Detected or provided object name */
  object?: string;
  /** Detected or provided context */
  context?: string;
  /** How the object was resolved */
  objectSource?: 'explicit' | 'auto-detected';
  /** How the context was resolved */
  contextSource?: 'explicit' | 'auto-detected';
  /** How the intent was resolved */
  intentSource?: 'explicit' | 'synthetic';
  /** Warnings from resolution */
  warnings: string[];
}

export interface FuzzyMatchResult {
  /** Best matching object name */
  match: string;
  /** Edit distance (lower = closer) */
  distance: number;
  /** Similarity score 0..1 */
  similarity: number;
}

/* ------------------------------------------------------------------ */
/*  Context detection                                                  */
/* ------------------------------------------------------------------ */

const CONTEXT_KEYWORDS: Record<string, string> = {
  detail: 'detail',
  details: 'detail',
  profile: 'detail',
  view: 'detail',
  show: 'detail',
  inspect: 'detail',
  list: 'list',
  table: 'list',
  browse: 'list',
  index: 'list',
  directory: 'list',
  catalog: 'list',
  form: 'form',
  edit: 'form',
  create: 'form',
  register: 'form',
  signup: 'form',
};

/**
 * Extract context from intent string.
 * Returns the first matching context keyword, or undefined.
 */
function detectContextFromIntent(intent: string): string | undefined {
  const lower = intent.toLowerCase();
  const words = lower.split(/\s+/);

  for (const word of words) {
    if (word in CONTEXT_KEYWORDS) {
      return CONTEXT_KEYWORDS[word];
    }
  }
  return undefined;
}

/* ------------------------------------------------------------------ */
/*  Object detection                                                   */
/* ------------------------------------------------------------------ */

/**
 * Detect an object name mentioned in the intent string.
 * Matches case-insensitively against all known object names.
 */
function detectObjectFromIntent(intent: string): string | undefined {
  const known = listObjects();
  const lower = intent.toLowerCase();

  // Try longest names first to avoid partial matches (e.g., "User" matching inside "UserProfile")
  const sorted = [...known].sort((a, b) => b.length - a.length);

  for (const name of sorted) {
    // Word-boundary match: the object name should appear as a standalone word
    const pattern = new RegExp(`\\b${escapeRegex(name)}\\b`, 'i');
    if (pattern.test(lower)) {
      return name;
    }
  }
  return undefined;
}

function escapeRegex(s: string): string {
  return s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

/* ------------------------------------------------------------------ */
/*  Fuzzy matching                                                     */
/* ------------------------------------------------------------------ */

/**
 * Levenshtein edit distance between two strings.
 */
function editDistance(a: string, b: string): number {
  const la = a.length;
  const lb = b.length;

  // Short-circuit
  if (la === 0) return lb;
  if (lb === 0) return la;

  const dp: number[][] = Array.from({ length: la + 1 }, () =>
    Array.from({ length: lb + 1 }, () => 0),
  );

  for (let i = 0; i <= la; i++) dp[i][0] = i;
  for (let j = 0; j <= lb; j++) dp[0][j] = j;

  for (let i = 1; i <= la; i++) {
    for (let j = 1; j <= lb; j++) {
      const cost = a[i - 1].toLowerCase() === b[j - 1].toLowerCase() ? 0 : 1;
      dp[i][j] = Math.min(
        dp[i - 1][j] + 1,      // deletion
        dp[i][j - 1] + 1,      // insertion
        dp[i - 1][j - 1] + cost, // substitution
      );
    }
  }

  return dp[la][lb];
}

/**
 * Find the closest matching object name for a given query.
 * Returns undefined if no objects are available.
 */
export function fuzzyMatchObject(query: string): FuzzyMatchResult | undefined {
  const known = listObjects();
  if (known.length === 0) return undefined;

  let bestMatch = known[0];
  let bestDistance = editDistance(query, bestMatch);

  for (let i = 1; i < known.length; i++) {
    const d = editDistance(query, known[i]);
    if (d < bestDistance) {
      bestDistance = d;
      bestMatch = known[i];
    }
  }

  const maxLen = Math.max(query.length, bestMatch.length);
  const similarity = maxLen === 0 ? 1 : 1 - bestDistance / maxLen;

  return { match: bestMatch, distance: bestDistance, similarity };
}

/* ------------------------------------------------------------------ */
/*  Main resolver                                                      */
/* ------------------------------------------------------------------ */

/**
 * Resolve intent, object, and context from potentially partial inputs.
 *
 * Modes:
 * 1. intent + object: intent drives layout detection, object drives components
 * 2. object only: synthetic intent generated as '{name} {context} view'
 * 3. intent only (with auto-detect): scans intent for known object names
 * 4. intent only (no match): passes through unchanged
 */
export function resolveIntentObject(
  intent: string | undefined,
  object: string | undefined,
  context: string | undefined,
): ResolvedIntent {
  const warnings: string[] = [];

  let resolvedObject = object;
  let resolvedContext = context;
  let resolvedIntent = intent?.trim() || '';
  let objectSource: ResolvedIntent['objectSource'];
  let contextSource: ResolvedIntent['contextSource'];
  let intentSource: ResolvedIntent['intentSource'] = 'explicit';

  // Auto-detect object from intent when no explicit object provided
  if (!resolvedObject && resolvedIntent) {
    const detected = detectObjectFromIntent(resolvedIntent);
    if (detected) {
      resolvedObject = detected;
      objectSource = 'auto-detected';
    }
  } else if (resolvedObject) {
    objectSource = 'explicit';
  }

  // Auto-detect context from intent when no explicit context provided
  if (!resolvedContext && resolvedIntent) {
    const detected = detectContextFromIntent(resolvedIntent);
    if (detected) {
      resolvedContext = detected;
      contextSource = 'auto-detected';
    }
  } else if (resolvedContext) {
    contextSource = 'explicit';
  }

  // Generate synthetic intent when object provided but no/empty intent
  if (resolvedObject && !resolvedIntent) {
    const ctx = resolvedContext ?? 'detail';
    resolvedIntent = `${resolvedObject} ${ctx} view`;
    intentSource = 'synthetic';
  }

  return {
    intent: resolvedIntent,
    object: resolvedObject,
    context: resolvedContext,
    objectSource,
    contextSource,
    intentSource,
    warnings,
  };
}
