import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import type { CatalogListInput, CatalogListOutput, ComponentCatalogEntry } from './types.js';

const __dirname = fileURLToPath(new URL('.', import.meta.url));
const REPO_ROOT = path.resolve(__dirname, '../../../../');
const ARTIFACT_DIR = path.join(REPO_ROOT, 'artifacts', 'structured-data');
const MANIFEST_PATH = path.join(ARTIFACT_DIR, 'manifest.json');

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

function getLatestComponentsFile(): string {
  try {
    const manifest = readJson(MANIFEST_PATH) as ManifestDoc;
    const componentsArtifact = manifest.artifacts?.find((a) => a.name === 'components');

    if (!componentsArtifact?.file) {
      throw new Error('Components artifact not found in manifest');
    }

    const fullPath = path.join(ARTIFACT_DIR, componentsArtifact.file);

    if (!fs.existsSync(fullPath)) {
      throw new Error(`Components file not found: ${fullPath}`);
    }

    return fullPath;
  } catch (error) {
    throw new Error(`Failed to locate components file: ${(error as Error).message}`);
  }
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

    return {
      components: filteredCatalog,
      totalCount: filteredCatalog.length,
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
