import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { ToolError } from '../errors/tool-error.js';
import type {
  CatalogListDetail,
  CatalogListInput,
  CatalogListOutput,
  ComponentCatalogEntry,
  ComponentCatalogSummary,
  ComponentCodeReference,
  ComponentStatus,
} from './types.js';
import { readComponentsDataset, resolveComponentCount } from './catalog.shared.js';
import { hasMappedRenderer } from '../render/component-map.js';
import { withinAllowed } from '../lib/security.js';

const __dirname = fileURLToPath(new URL('.', import.meta.url));
const REPO_ROOT = path.resolve(__dirname, '../../../../');
const ARTIFACT_DIR = path.join(REPO_ROOT, 'artifacts', 'structured-data');
const CODE_CONNECT_PATH = path.join(ARTIFACT_DIR, 'code-connect.json');
const STORIES_DIR = path.join(REPO_ROOT, 'stories');
const DEFAULT_PAGE_SIZE = 25;

type CodeConnectRef = {
  path?: string;
  snippet?: string;
  title?: string;
};

type CodeConnectDoc = {
  components?: Record<string, CodeConnectRef[]>;
  references?: Array<CodeConnectRef & { component?: string }>;
};

type TraitUsage = {
  trait: string;
  traitCategory?: string;
  context?: string;
  position?: string;
  priority?: number;
  props?: Record<string, unknown>;
  slots?: Record<string, { accept?: string[]; role?: string }>;
  source?: string;
};

type ComponentData = {
  id: string;
  displayName: string;
  categories?: string[];
  tags?: string[];
  contexts?: string[];
  regions?: string[];
  traitUsages?: TraitUsage[];
  sourceFiles?: string[];
};

type ComponentsDataset = {
  generatedAt?: string;
  stats?: {
    componentCount?: number;
    traitCount?: number;
    objectCount?: number;
    domainCount?: number;
    patternCount?: number;
  };
  components?: ComponentData[];
  traits?: unknown[];
  objects?: unknown[];
  domains?: unknown[];
  patterns?: unknown[];
  sampleQueries?: unknown[];
};

function normalizeTrait(value: string): string {
  return value.trim().toLowerCase();
}

function levenshtein(a: string, b: string): number {
  const aLen = a.length;
  const bLen = b.length;
  if (aLen === 0) return bLen;
  if (bLen === 0) return aLen;
  const prev = new Array<number>(bLen + 1);
  const curr = new Array<number>(bLen + 1);
  for (let j = 0; j <= bLen; j += 1) prev[j] = j;
  for (let i = 1; i <= aLen; i += 1) {
    curr[0] = i;
    const aChar = a[i - 1];
    for (let j = 1; j <= bLen; j += 1) {
      const cost = aChar === b[j - 1] ? 0 : 1;
      curr[j] = Math.min(
        prev[j] + 1,
        curr[j - 1] + 1,
        prev[j - 1] + cost
      );
    }
    for (let j = 0; j <= bLen; j += 1) prev[j] = curr[j];
  }
  return prev[bLen];
}

function suggestTraits(query: string, candidates: string[], limit = 5): string[] {
  const normalizedQuery = normalizeTrait(query);
  if (!normalizedQuery) return [];
  const unique = Array.from(new Set(candidates.filter((t) => typeof t === 'string' && t.trim().length > 0)));
  const scored = unique.map((trait) => {
    const normalized = normalizeTrait(trait);
    let score = 0;
    if (normalized === normalizedQuery) {
      score = 0;
    } else if (normalized.includes(normalizedQuery) || normalizedQuery.includes(normalized)) {
      score = 1;
    } else {
      score = 2 + levenshtein(normalizedQuery, normalized);
    }
    return { trait, normalized, score };
  });

  const threshold = Math.max(2, Math.ceil(normalizedQuery.length * 0.4));
  const filtered = scored.filter((entry) =>
    entry.score <= threshold || entry.normalized.includes(normalizedQuery)
  );

  return filtered
    .sort((a, b) => a.score - b.score || a.trait.localeCompare(b.trait))
    .slice(0, limit)
    .map((entry) => entry.trait);
}

type StoryIndex = Map<string, ComponentCodeReference[]>;

let storyIndexCache: { key: string; index: StoryIndex } | undefined;

function toPosixPath(filePath: string): string {
  return filePath.split(path.sep).join('/');
}

function escapeRegExp(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

function isIdentifierChar(value: string): boolean {
  return /[A-Za-z0-9_]/.test(value);
}

function findWordIndex(haystack: string, needle: string): number {
  let index = haystack.indexOf(needle);
  while (index !== -1) {
    const before = index > 0 ? haystack[index - 1] : '';
    const after = index + needle.length < haystack.length ? haystack[index + needle.length] : '';
    if (!isIdentifierChar(before) && !isIdentifierChar(after)) {
      return index;
    }
    index = haystack.indexOf(needle, index + needle.length);
  }
  return -1;
}

function listStoryFiles(storiesDir: string): string[] {
  if (!fs.existsSync(storiesDir)) {
    return [];
  }

  const files: string[] = [];
  const stack: string[] = [storiesDir];

  while (stack.length > 0) {
    const currentDir = stack.pop();
    if (!currentDir) continue;

    const entries = fs.readdirSync(currentDir, { withFileTypes: true });
    for (const entry of entries) {
      const fullPath = path.join(currentDir, entry.name);
      if (!withinAllowed(storiesDir, fullPath)) {
        continue;
      }

      if (entry.isDirectory()) {
        stack.push(fullPath);
        continue;
      }

      if (entry.isFile() && entry.name.endsWith('.stories.tsx')) {
        files.push(fullPath);
      }
    }
  }

  return files.sort();
}

function extractStoryTitle(source: string): string | undefined {
  const match = source.match(/\btitle:\s*['"]([^'"]+)['"]/);
  return match?.[1];
}

function extractViewExtensionsBlocks(source: string): string[] {
  const blocks: string[] = [];
  const re = /`(view_extensions:[\s\S]*?)`/g;
  for (const match of source.matchAll(re)) {
    if (typeof match[1] === 'string') {
      blocks.push(match[1]);
    }
  }
  return blocks;
}

function buildViewExtensionSnippets(yaml: string): Map<string, string> {
  const lines = yaml.split(/\r?\n/);
  const snippets = new Map<string, string>();

  let currentContextLine: string | undefined;

  for (let lineIndex = 0; lineIndex < lines.length; lineIndex += 1) {
    const line = lines[lineIndex];

    const contextMatch = line.match(/^\s{2}([A-Za-z0-9_]+):\s*$/);
    if (contextMatch) {
      currentContextLine = line;
      continue;
    }

    const componentMatch = line.match(/^\s*-\s*component:\s*([A-Za-z0-9_]+)\s*$/);
    if (!componentMatch) continue;

    const componentName = componentMatch[1];
    const componentIndent = line.match(/^(\s*)/)?.[1].length ?? 0;

    const blockLines: string[] = [];
    const header = lines.find((candidate) => candidate.trim() === 'view_extensions:') ?? 'view_extensions:';
    blockLines.push(header);
    if (currentContextLine) {
      blockLines.push(currentContextLine);
    }

    blockLines.push(line);

    for (let nextIndex = lineIndex + 1; nextIndex < lines.length; nextIndex += 1) {
      const nextLine = lines[nextIndex];
      if (!nextLine.trim()) break;

      const nextIndent = nextLine.match(/^(\s*)/)?.[1].length ?? 0;
      const trimmed = nextLine.trim();

      if (nextIndent <= componentIndent && trimmed.endsWith(':')) break;
      if (nextIndent <= componentIndent && trimmed.startsWith('-')) break;

      blockLines.push(nextLine);
    }

    const snippet = blockLines.join('\n').trim();
    if (snippet && !snippets.has(componentName)) {
      snippets.set(componentName, snippet);
    }
  }

  return snippets;
}

type ImportInfo =
  | { style: 'named'; module: string }
  | { style: 'default'; module: string }
  | { style: 'namespace'; module: string };

function parseNamedImportLocals(namedImports: string): string[] {
  return namedImports
    .split(',')
    .map((part) => part.trim())
    .filter(Boolean)
    .map((part) => {
      const cleaned = part.replace(/^type\s+/, '').trim();
      const [imported, local] = cleaned.split(/\s+as\s+/);
      return (local ?? imported).trim();
    })
    .filter(Boolean);
}

function findImportForIdentifier(source: string, identifier: string): ImportInfo | undefined {
  const namespaceRe = new RegExp(`\\bimport\\s+\\*\\s+as\\s+${escapeRegExp(identifier)}\\s+from\\s+['"]([^'"]+)['"]`);
  const namespaceMatch = source.match(namespaceRe);
  if (namespaceMatch?.[1]) {
    return { style: 'namespace', module: namespaceMatch[1] };
  }

  const mixedRe = /import\s+([A-Za-z0-9_$]+)\s*,\s*{\s*([\s\S]*?)\s*}\s*from\s*['"]([^'"]+)['"]\s*;?/g;
  for (const match of source.matchAll(mixedRe)) {
    const defaultLocal = match[1];
    const namedPart = match[2];
    const module = match[3];
    if (defaultLocal === identifier) {
      return { style: 'default', module };
    }
    if (parseNamedImportLocals(namedPart).includes(identifier)) {
      return { style: 'named', module };
    }
  }

  const defaultRe = new RegExp(`\\bimport\\s+${escapeRegExp(identifier)}\\s+from\\s+['"]([^'"]+)['"]`);
  const defaultMatch = source.match(defaultRe);
  if (defaultMatch?.[1]) {
    return { style: 'default', module: defaultMatch[1] };
  }

  const namedRe = /import\s*{\s*([\s\S]*?)\s*}\s*from\s*['"]([^'"]+)['"]\s*;?/g;
  for (const match of source.matchAll(namedRe)) {
    const namedPart = match[1];
    const module = match[2];
    if (parseNamedImportLocals(namedPart).includes(identifier)) {
      return { style: 'named', module };
    }
  }

  return undefined;
}

function buildReactUsageSnippet(source: string, identifier: string, importInfo: ImportInfo): string {
  const importLine =
    importInfo.style === 'named'
      ? `import { ${identifier} } from '${importInfo.module}';`
      : importInfo.style === 'default'
        ? `import ${identifier} from '${importInfo.module}';`
        : `import * as ${identifier} from '${importInfo.module}';`;

  const hasChildren = new RegExp(`<${escapeRegExp(identifier)}\\b[^>]*>`).test(source) && new RegExp(`</${escapeRegExp(identifier)}>`).test(source);
  const jsx = hasChildren ? `<${identifier}>...</${identifier}>` : `<${identifier} />`;

  return `${importLine}\n\nexport function Example() {\n  return ${jsx};\n}`;
}

function extractLineSnippet(source: string, needle: string): string {
  const lines = source.split(/\r?\n/);
  const matchIndex = lines.findIndex((line) => line.includes(needle));
  if (matchIndex === -1) {
    return needle;
  }

  const start = Math.max(0, matchIndex - 2);
  const end = Math.min(lines.length, matchIndex + 4);
  const snippet = lines.slice(start, end).join('\n').trim();

  const limit = 900;
  if (snippet.length <= limit) return snippet;
  return `${snippet.slice(0, limit)}\n…`;
}

function buildStoryIndex(componentNames: string[]): StoryIndex {
  const index: StoryIndex = new Map();
  const storyFiles = listStoryFiles(STORIES_DIR);

  for (const storyFile of storyFiles) {
    let source: string;
    try {
      source = fs.readFileSync(storyFile, 'utf8');
    } catch {
      continue;
    }

    const storyTitle = extractStoryTitle(source);

    const viewExtensionsSnippets = new Map<string, string>();
    for (const block of extractViewExtensionsBlocks(source)) {
      for (const [componentName, snippet] of buildViewExtensionSnippets(block).entries()) {
        if (!viewExtensionsSnippets.has(componentName)) {
          viewExtensionsSnippets.set(componentName, snippet);
        }
      }
    }

    for (const componentName of componentNames) {
      let snippet: string | undefined = viewExtensionsSnippets.get(componentName);

      if (!snippet) {
        const importInfo = findImportForIdentifier(source, componentName);
        if (importInfo) {
          snippet = buildReactUsageSnippet(source, componentName, importInfo);
        }
      }

      if (!snippet) {
        const wordIndex = findWordIndex(source, componentName);
        if (wordIndex === -1) continue;
        snippet = extractLineSnippet(source, componentName);
      }

      const relativePath = toPosixPath(path.relative(REPO_ROOT, storyFile));
      const ref: ComponentCodeReference = {
        kind: 'storybook',
        path: relativePath,
        snippet,
        ...(storyTitle ? { title: storyTitle } : {}),
      };

      const existing = index.get(componentName);
      if (existing) {
        existing.push(ref);
      } else {
        index.set(componentName, [ref]);
      }
    }
  }

  return index;
}

function getStoryIndex(componentNames: string[]): StoryIndex {
  const key = componentNames.slice().sort().join('|');
  if (storyIndexCache?.key === key) {
    return storyIndexCache.index;
  }
  const index = buildStoryIndex(componentNames);
  storyIndexCache = { key, index };
  return index;
}

function pickBestSnippet(codeReferences: ComponentCodeReference[]): string | undefined {
  const kindOrder: ComponentCodeReference['kind'][] = ['code-connect', 'storybook'];
  for (const kind of kindOrder) {
    const candidates = codeReferences.filter((ref) => ref.kind === kind);
    if (candidates.length === 0) continue;
    return candidates.find((ref) => ref.snippet.includes('import '))?.snippet ?? candidates[0]?.snippet;
  }

  return undefined;
}

function loadCodeConnectIndex(): StoryIndex {
  const index: StoryIndex = new Map();

  if (!fs.existsSync(CODE_CONNECT_PATH)) {
    return index;
  }

  let doc: CodeConnectDoc;
  try {
    doc = JSON.parse(fs.readFileSync(CODE_CONNECT_PATH, 'utf8')) as CodeConnectDoc;
  } catch {
    return index;
  }

  const add = (componentName: string, ref: CodeConnectRef) => {
    if (!ref.path || !ref.snippet) return;

    const entry: ComponentCodeReference = {
      kind: 'code-connect',
      path: ref.path,
      snippet: ref.snippet,
      ...(ref.title ? { title: ref.title } : {}),
    };

    const existing = index.get(componentName);
    if (existing) {
      existing.push(entry);
    } else {
      index.set(componentName, [entry]);
    }
  };

  if (doc.components && typeof doc.components === 'object') {
    for (const [componentName, refs] of Object.entries(doc.components)) {
      if (!Array.isArray(refs)) continue;
      refs.forEach((ref) => add(componentName, ref));
    }
  }

  if (Array.isArray(doc.references)) {
    doc.references.forEach((ref) => {
      if (!ref.component) return;
      add(ref.component, ref);
    });
  }

  return index;
}

function extractPropSchema(traitUsages: TraitUsage[]): Record<string, unknown> {
  const propSchema: Record<string, unknown> = {};

  for (const usage of traitUsages) {
    if (usage.props) {
      for (const [key, value] of Object.entries(usage.props)) {
        propSchema[key] = {
          type: typeof value,
          default: value,
          trait: usage.trait,
        };
      }
    }
  }

  return propSchema;
}

function extractSlotDefinitions(traitUsages: TraitUsage[]): Record<string, { accept?: string[]; role?: string }> {
  const slots: Record<string, { accept?: string[]; role?: string }> = {};

  for (const usage of traitUsages) {
    if (usage.slots) {
      for (const [slotName, slotDef] of Object.entries(usage.slots)) {
        slots[slotName] = {
          accept: slotDef.accept,
          role: slotDef.role,
        };
      }
    }
  }

  return slots;
}

function deriveComponentStatus(componentId: string): ComponentStatus {
  return hasMappedRenderer(componentId) ? 'stable' : 'planned';
}

function transformComponentsToSummary(componentsData: ComponentsDataset): ComponentCatalogSummary[] {
  if (!componentsData.components) {
    return [];
  }

  return componentsData.components.map((component) => ({
    name: component.id,
    displayName: component.displayName,
    categories: component.categories || [],
    tags: component.tags || [],
    contexts: component.contexts || [],
    regions: component.regions || [],
    traits: Array.from(
      new Set(component.traitUsages?.map((usage) => usage.trait) || []),
    ),
    status: deriveComponentStatus(component.id),
  }));
}

function enrichComponentsToDetail(
  components: ComponentCatalogSummary[],
  componentIndex: Map<string, ComponentData>,
): ComponentCatalogEntry[] {
  return components.map((component) => {
    const source = componentIndex.get(component.name);
    const traitUsages = source?.traitUsages || [];
    const propSchema = extractPropSchema(traitUsages);
    const slots = extractSlotDefinitions(traitUsages);

    return {
      ...component,
      propSchema,
      slots,
    };
  });
}

export async function handle(input: CatalogListInput): Promise<CatalogListOutput> {
  try {
    const componentsData = readComponentsDataset<ComponentsDataset>();
    const catalog = transformComponentsToSummary(componentsData);
    const componentIndex = new Map(
      (componentsData.components ?? []).map((component) => [component.id, component]),
    );

    // Apply filters if provided
    let filteredCatalog = catalog;

    if (input.category) {
      filteredCatalog = filteredCatalog.filter((c) => c.categories.includes(input.category!));
    }

    if (input.trait) {
      filteredCatalog = filteredCatalog.filter((c) => c.traits.includes(input.trait!));
    }

    if (input.context) {
      filteredCatalog = filteredCatalog.filter((c) => c.contexts.includes(input.context!));
    }

    if (input.status) {
      filteredCatalog = filteredCatalog.filter((c) => c.status === input.status);
    }

    // Stable sort: alphabetical by name
    filteredCatalog.sort((a, b) => a.name.localeCompare(b.name));

    let suggestions: CatalogListOutput['suggestions'] | undefined;
    if (input.trait && filteredCatalog.length === 0) {
      const allTraits = new Set<string>();
      for (const component of catalog) {
        for (const trait of component.traits) {
          allTraits.add(trait);
        }
      }
      const traitSuggestions = suggestTraits(input.trait, Array.from(allTraits));
      if (traitSuggestions.length > 0) {
        suggestions = { traits: traitSuggestions };
      }
    }

    const hasFilters = Boolean(input.category || input.trait || input.context || input.status);
    const detail: CatalogListDetail = input.detail ?? (hasFilters ? 'full' : 'summary');
    const paginationRequested = input.page !== undefined || input.pageSize !== undefined;
    const applyDefaultPagination = !input.detail && !hasFilters;
    const shouldPaginate = paginationRequested || applyDefaultPagination;

    const totalCount = filteredCatalog.length;
    const page = Math.max(1, input.page ?? 1);
    let pageSize: number;

    if (totalCount === 0) {
      pageSize = 0;
    } else if (shouldPaginate) {
      pageSize = Math.max(1, input.pageSize ?? DEFAULT_PAGE_SIZE);
    } else {
      pageSize = totalCount;
    }

    const offset = shouldPaginate ? (page - 1) * pageSize : 0;
    const pagedCatalog = shouldPaginate
      ? filteredCatalog.slice(offset, offset + pageSize)
      : filteredCatalog;

    let components: Array<ComponentCatalogSummary | ComponentCatalogEntry> = pagedCatalog;

    if (detail === 'full') {
      const detailed = enrichComponentsToDetail(pagedCatalog, componentIndex);
      const storyIndex = getStoryIndex(detailed.map((c) => c.name));
      const codeConnectIndex = loadCodeConnectIndex();

      components = detailed.map((component) => {
        const codeReferences = [
          ...(codeConnectIndex.get(component.name) ?? []),
          ...(storyIndex.get(component.name) ?? []),
        ];

        if (codeReferences.length === 0) {
          return component;
        }

        return {
          ...component,
          codeReferences,
          codeSnippet: pickBestSnippet(codeReferences),
        };
      });
    }

    const returnedCount = components.length;
    const hasMore = shouldPaginate ? offset + returnedCount < totalCount : false;

    const componentCount = resolveComponentCount(componentsData);
    const filteredCount = hasFilters ? totalCount : undefined;

    return {
      components,
      totalCount,
      returnedCount,
      page,
      pageSize,
      hasMore,
      detail,
      generatedAt: componentsData.generatedAt || new Date().toISOString(),
      stats: {
        componentCount,
        traitCount: componentsData.stats?.traitCount || 0,
        ...(filteredCount !== undefined ? { filteredCount } : {}),
      },
      ...(suggestions ? { suggestions } : {}),
    };
  } catch (error) {
    throw new ToolError('OODS-S005', `Failed to list component catalog: ${(error as Error).message}`);
  }
}
