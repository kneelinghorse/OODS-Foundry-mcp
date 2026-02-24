import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { withinAllowed } from '../lib/security.js';
import type {
  CatalogListInput,
  CatalogListOutput,
  ComponentCatalogEntry,
  ComponentCodeReference,
} from './types.js';

const __dirname = fileURLToPath(new URL('.', import.meta.url));
const REPO_ROOT = path.resolve(__dirname, '../../../../');
const ARTIFACT_DIR = path.join(REPO_ROOT, 'artifacts', 'structured-data');
const MANIFEST_PATH = path.join(ARTIFACT_DIR, 'manifest.json');
const CODE_CONNECT_PATH = path.join(ARTIFACT_DIR, 'code-connect.json');
const STORIES_DIR = path.join(REPO_ROOT, 'stories');

type ManifestArtifact = {
  name?: string;
  path?: string;
  file?: string;
  etag?: string;
  sizeBytes?: number;
};

type ManifestDoc = {
  generatedAt?: string;
  version?: string;
  artifacts?: ManifestArtifact[];
};

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

function readJson(filePath: string): Record<string, unknown> {
  return JSON.parse(fs.readFileSync(filePath, 'utf8'));
}

function sanitizeManifestFile(value: string): string {
  const trimmed = value.trim();
  if (!trimmed) {
    throw new Error('Manifest file entry is empty');
  }
  if (path.isAbsolute(trimmed) || trimmed.includes('..') || trimmed.includes('/') || trimmed.includes('\\')) {
    throw new Error(`Manifest file entry is not a safe filename: ${trimmed}`);
  }
  return trimmed;
}

function getLatestComponentsFile(): string {
  try {
    const manifest = readJson(MANIFEST_PATH) as ManifestDoc;
    const componentsArtifact = manifest.artifacts?.find((a) => a.name === 'components');

    if (!componentsArtifact?.file) {
      throw new Error('Components artifact not found in manifest');
    }

    const filename = sanitizeManifestFile(componentsArtifact.file);
    const fullPath = path.join(ARTIFACT_DIR, filename);
    if (!withinAllowed(ARTIFACT_DIR, fullPath)) {
      throw new Error(`Components artifact file resolves outside artifact dir: ${filename}`);
    }

    if (!fs.existsSync(fullPath)) {
      throw new Error(`Components artifact file not found: ${filename}`);
    }

    return fullPath;
  } catch (error) {
    throw new Error(`Failed to locate components file: ${(error as Error).message}`);
  }
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

function transformComponentsToCatalog(componentsData: ComponentsDataset): ComponentCatalogEntry[] {
  if (!componentsData.components) {
    return [];
  }

  return componentsData.components.map((component) => {
    const traits = component.traitUsages?.map((usage) => usage.trait) || [];
    const propSchema = extractPropSchema(component.traitUsages || []);
    const slots = extractSlotDefinitions(component.traitUsages || []);

    return {
      name: component.id,
      displayName: component.displayName,
      categories: component.categories || [],
      tags: component.tags || [],
      contexts: component.contexts || [],
      regions: component.regions || [],
      traits,
      propSchema,
      slots,
    };
  });
}

export async function handle(input: CatalogListInput): Promise<CatalogListOutput> {
  try {
    const componentsFilePath = getLatestComponentsFile();
    const componentsData = readJson(componentsFilePath) as ComponentsDataset;

    const catalog = transformComponentsToCatalog(componentsData);

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

    const storyIndex = getStoryIndex(catalog.map((c) => c.name));
    const codeConnectIndex = loadCodeConnectIndex();
    const enrichedCatalog = filteredCatalog.map((component) => {
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

    return {
      components: enrichedCatalog,
      totalCount: enrichedCatalog.length,
      generatedAt: componentsData.generatedAt || new Date().toISOString(),
      stats: {
        componentCount: componentsData.stats?.componentCount || catalog.length,
        traitCount: componentsData.stats?.traitCount || 0,
      },
    };
  } catch (error) {
    throw new Error(`Failed to list component catalog: ${(error as Error).message}`);
  }
}
