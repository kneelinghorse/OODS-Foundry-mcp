import { describe, it, expect, beforeAll, afterAll, beforeEach } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { getAjv } from '../../src/lib/ajv.js';
import inputSchema from '../../src/schemas/map.apply.input.json' assert { type: 'json' };
import outputSchema from '../../src/schemas/map.apply.output.json' assert { type: 'json' };
import type { MapApplyInput, MapApplyOutput, Stage1ReconciliationReport } from '../../src/tools/types.js';
import { computeMappingsEtag, type ComponentMapping } from '../../src/tools/map.shared.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = path.resolve(__dirname, '../../../../');
const MAPPINGS_PATH = path.join(REPO_ROOT, 'artifacts', 'structured-data', 'component-mappings.json');
const FIXTURE_PATH = path.join(REPO_ROOT, 'packages', 'mcp-server', 'test', 'fixtures', 'reconciliation-report-v1.1.0.json');

const ajv = getAjv();
const validateInput = ajv.compile(inputSchema);
const validateOutput = ajv.compile(outputSchema);

function loadFixture(): Stage1ReconciliationReport {
  return JSON.parse(fs.readFileSync(FIXTURE_PATH, 'utf8')) as Stage1ReconciliationReport;
}

function writeMappings(mappings: ComponentMapping[]): void {
  const doc = {
    $schema: '../../packages/mcp-server/src/schemas/component-mapping.schema.json',
    generatedAt: '2026-04-16T00:00:00.000Z',
    version: '2026-04-16',
    stats: {
      mappingCount: mappings.length,
      systemCount: new Set(mappings.map((mapping) => mapping.externalSystem)).size,
    },
    mappings,
  };
  fs.writeFileSync(MAPPINGS_PATH, JSON.stringify(doc, null, 2) + '\n');
}

async function loadHandle(): Promise<(input: MapApplyInput) => Promise<MapApplyOutput>> {
  const mod = await import('../../src/tools/map.apply.js');
  return mod.handle as (input: MapApplyInput) => Promise<MapApplyOutput>;
}

let originalMappings: string | null = null;

beforeAll(() => {
  originalMappings = fs.existsSync(MAPPINGS_PATH) ? fs.readFileSync(MAPPINGS_PATH, 'utf8') : null;
});

afterAll(() => {
  if (originalMappings === null) {
    fs.rmSync(MAPPINGS_PATH, { force: true });
    return;
  }
  fs.writeFileSync(MAPPINGS_PATH, originalMappings);
});

beforeEach(() => {
  writeMappings([
    {
      id: 'linear-issue-row',
      externalSystem: 'linear',
      externalComponent: 'Issue Row',
      oodsTraits: ['Listable'],
      confidence: 'manual',
      metadata: {
        createdAt: '2026-03-01T00:00:00.000Z',
        notes: 'Imported from sprint-52 fixture',
      },
    },
    {
      id: 'linear-billing-plan-card',
      externalSystem: 'linear',
      externalComponent: 'Billing Plan Card',
      oodsTraits: ['Priceable', 'Stateful'],
      confidence: 'manual',
      metadata: {
        createdAt: '2026-03-01T00:00:00.000Z',
      },
    },
    {
      id: 'linear-workspace-switcher',
      externalSystem: 'linear',
      externalComponent: 'Workspace Switcher',
      oodsTraits: ['Stateful'],
      confidence: 'manual',
      metadata: {
        createdAt: '2026-03-01T00:00:00.000Z',
      },
    },
  ]);
});

describe('map.apply schema validation', () => {
  it('accepts inline reconciliation reports with v1.1.0 fields', () => {
    expect(validateInput({ report: loadFixture() })).toBe(true);
  });

  it('accepts reportPath input for filesystem-driven runs', () => {
    expect(validateInput({ reportPath: FIXTURE_PATH })).toBe(true);
  });

  it('rejects both report and reportPath together', () => {
    expect(
      validateInput({
        report: loadFixture(),
        reportPath: FIXTURE_PATH,
      }),
    ).toBe(false);
  });

  it('rejects inputs that provide neither report nor reportPath', () => {
    expect(validateInput({ minConfidence: 0.9 })).toBe(false);
  });

  it('accepts legacy string alternates alongside typed v1.1.0 payloads', () => {
    const report = loadFixture();
    report.candidate_objects[1].alternate_interpretations = ['table-row', 'data-display'];
    report.candidate_actions![0].alternate_verbs = ['save', 'publish'];
    expect(validateInput({ report })).toBe(true);
  });
});

describe('map.apply output schema validation', () => {
  it('accepts the planned routing surface for dry-run/apply reports', () => {
    const sample: MapApplyOutput = {
      applied: [
        {
          objectId: 'obj-command-menu',
          name: 'Command Menu Trigger',
          action: 'create',
          confidence: 0.94,
          recommendedOodsTraits: ['Stateful', 'Labelled'],
          mappingId: 'linear-command-menu-trigger',
          reason: 'No matching external component in the OODS registry snapshot.',
          persisted: false,
        },
        {
          objectId: 'obj-issue-row',
          name: 'Issue Row',
          action: 'patch',
          confidence: 0.88,
          recommendedOodsTraits: ['Listable', 'Sortable'],
          existingMapId: 'linear-issue-row',
          mappingId: 'linear-issue-row',
          reason: 'Existing map lacks Sortable and needs notes updated for the current evidence set.',
          persisted: false,
          diff: {
            added_traits: ['Sortable'],
            removed_traits: [],
            changed_fields: [
              {
                field: 'oodsTraits',
                from: ['Listable'],
                to: ['Listable', 'Sortable'],
              },
            ],
          },
        },
      ],
      skipped: [
        {
          objectId: 'obj-billing-plan-card',
          name: 'Billing Plan Card',
          action: 'skip',
          confidence: 0.97,
          recommendedOodsTraits: ['Priceable', 'Stateful'],
          existingMapId: 'linear-billing-plan-card',
          mappingId: 'linear-billing-plan-card',
          reason: 'Existing mapping already matches name, system, and trait set.',
          persisted: false,
        },
      ],
      queued: [
        {
          objectId: 'obj-experimental-badge',
          name: 'Experimental Badge',
          action: 'create',
          confidence: 0.61,
          threshold: 0.75,
          queueReason: 'below_confidence',
          recommendedOodsTraits: ['Labelled', 'Stateful'],
          reason: 'Candidate remains actionable but should queue for review at the default minConfidence.',
        },
      ],
      conflicted: [
        {
          objectId: 'obj-workspace-switcher',
          name: 'Workspace Switcher',
          action: 'conflict',
          confidence: 0.82,
          existingMapId: 'linear-workspace-switcher',
          reason: 'Existing mapping classifies this control as Stateful rather than Navigable, and the trait sets are incompatible without review.',
        },
      ],
      errors: [],
      diff: {
        create: 1,
        patch: 1,
        skip: 1,
        conflict: 1,
        queued: 1,
        changedFields: ['oodsTraits', 'metadata.notes'],
        addedTraits: ['Sortable'],
        removedTraits: [],
      },
      conflictArtifactPath: '.oods/conflicts/2026-04-16T15-06-35.268Z-stage1-linear-smoke.json',
      etag: '6d6224a2293e24fcefff2060dc60d8b3cf516af14f8d8f7344e3d5d726b7d0d6',
    };

    expect(validateOutput(sample)).toBe(true);
  });
});

describe('map.apply contract (pending implementation)', () => {
  it('routes create, patch, skip, queued, and conflict buckets from an inline report', async () => {
    const handle = await loadHandle();
    const result = await handle({
      report: loadFixture(),
      minConfidence: 0.75,
    });

    expect(validateOutput(result)).toBe(true);
    expect(result.applied).toHaveLength(2);
    expect(result.applied.map((entry) => entry.action)).toEqual(['create', 'patch']);
    expect(result.applied.every((entry) => entry.persisted === false)).toBe(true);
    expect(result.skipped).toHaveLength(1);
    expect(result.queued).toHaveLength(1);
    expect(result.queued[0].queueReason).toBe('below_confidence');
    expect(result.conflicted).toHaveLength(1);
    expect(result.errors).toEqual([]);
    expect(result.diff).toMatchObject({
      create: 1,
      patch: 1,
      skip: 1,
      conflict: 1,
      queued: 1,
      addedTraits: ['Sortable'],
      changedFields: ['oodsTraits', 'metadata.notes'],
    });
    expect(result.etag).toBe(
      computeMappingsEtag(JSON.parse(fs.readFileSync(MAPPINGS_PATH, 'utf8')) as Parameters<typeof computeMappingsEtag>[0]),
    );
  });

  it('supports reportPath + apply=true while preserving the same output contract', async () => {
    const handle = await loadHandle();
    const result = await handle({
      reportPath: FIXTURE_PATH,
      apply: true,
      minConfidence: 0.75,
    });

    expect(validateOutput(result)).toBe(true);
    expect(result.applied.map((entry) => entry.action)).toEqual(['create', 'patch']);
    expect(result.applied.every((entry) => entry.persisted === true)).toBe(true);
    expect(result.skipped).toHaveLength(1);
    expect(result.queued).toHaveLength(1);
    expect(result.conflicted).toHaveLength(1);
    expect(result.conflictArtifactPath).toMatch(/\.oods\/conflicts\/.+\.json$/);
  });
});
