import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { handle as applyHandle } from '../../src/tools/map.apply.js';
import { handle as snapshotHandle } from '../../src/tools/registry.snapshot.js';
import { loadMappings, slugify, type MappingsDoc } from '../../src/tools/map.shared.js';
import type { Stage1ReconciliationReport } from '../../src/tools/types.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = path.resolve(__dirname, '../../../../');
const MAPPINGS_PATH = path.join(REPO_ROOT, 'artifacts', 'structured-data', 'component-mappings.json');
const STAGE1_REAL_REPORT_PATH = path.resolve(
  __dirname,
  '../../../../../Stage1/out/stage1/linear-app/6d75dde3-4313-46fa-b25c-e53c13229a08/artifacts/reconciliation_report.json',
);
const MIN_CONFIDENCE = 0.75;

let originalMappings: string | null = null;
let originalArtifact: string | null = null;

function seedEmptyMappings(): void {
  const doc: MappingsDoc = {
    $schema: '../../packages/mcp-server/src/schemas/component-mapping.schema.json',
    generatedAt: '2026-04-16T00:00:00.000Z',
    version: '2026-04-16',
    stats: {
      mappingCount: 0,
      systemCount: 0,
    },
    mappings: [],
  };
  fs.writeFileSync(MAPPINGS_PATH, JSON.stringify(doc, null, 2) + '\n');
}

function loadReport(): Stage1ReconciliationReport | null {
  if (!fs.existsSync(STAGE1_REAL_REPORT_PATH)) return null;
  return JSON.parse(fs.readFileSync(STAGE1_REAL_REPORT_PATH, 'utf8')) as Stage1ReconciliationReport;
}

function expectedArtifactRelativePath(report: Stage1ReconciliationReport): string {
  return path.join(
    '.oods',
    'conflicts',
    `${report.generated_at.replace(/:/g, '-')}-${slugify(report.target.id)}.json`,
  );
}

function countAboveThreshold(report: Stage1ReconciliationReport): number {
  return report.candidate_objects.filter((candidate) => candidate.confidence >= MIN_CONFIDENCE).length;
}

function countBelowThreshold(report: Stage1ReconciliationReport): number {
  return report.candidate_objects.filter((candidate) => candidate.confidence < MIN_CONFIDENCE).length;
}

const realReport = loadReport();
const artifactRelativePath = realReport ? expectedArtifactRelativePath(realReport) : null;
const artifactAbsolutePath = artifactRelativePath ? path.join(REPO_ROOT, artifactRelativePath) : null;

beforeAll(() => {
  originalMappings = fs.existsSync(MAPPINGS_PATH) ? fs.readFileSync(MAPPINGS_PATH, 'utf8') : null;
  originalArtifact =
    artifactAbsolutePath && fs.existsSync(artifactAbsolutePath)
      ? fs.readFileSync(artifactAbsolutePath, 'utf8')
      : null;
});

afterAll(() => {
  if (originalMappings === null) {
    fs.rmSync(MAPPINGS_PATH, { force: true });
  } else {
    fs.writeFileSync(MAPPINGS_PATH, originalMappings);
  }

  if (!artifactAbsolutePath) return;
  if (originalArtifact === null) {
    fs.rmSync(artifactAbsolutePath, { force: true });
  } else {
    fs.mkdirSync(path.dirname(artifactAbsolutePath), { recursive: true });
    fs.writeFileSync(artifactAbsolutePath, originalArtifact);
  }
});

beforeEach(() => {
  seedEmptyMappings();
  if (artifactAbsolutePath) {
    fs.rmSync(artifactAbsolutePath, { force: true });
  }
});

describe('real emitted Stage1 reconciliation report → map.apply → registry.snapshot', () => {
  it.runIf(realReport !== null)('ingests a real emitted report from disk and preserves backward compatibility with schema v1.0.0', async () => {
    const report = realReport!;
    const appliedCount = countAboveThreshold(report);
    const queuedCount = countBelowThreshold(report);
    const expectedArtifactPath = expectedArtifactRelativePath(report);
    const expectedExternalSystem = 'linear';

    expect(report.kind).toBe('reconciliation_report');
    expect(report.schema_version).toBe('1.0.0');
    expect(report.candidate_objects).toHaveLength(124);
    expect(appliedCount).toBe(72);
    expect(queuedCount).toBe(52);

    const dryRun = await applyHandle({
      reportPath: STAGE1_REAL_REPORT_PATH,
      minConfidence: MIN_CONFIDENCE,
    });

    expect(dryRun.errors).toEqual([]);
    expect(dryRun.applied).toHaveLength(appliedCount);
    expect(dryRun.applied.every((entry) => entry.action === 'create' && entry.persisted === false)).toBe(true);
    expect(dryRun.skipped).toHaveLength(0);
    expect(dryRun.conflicted).toHaveLength(0);
    expect(dryRun.queued).toHaveLength(queuedCount);
    expect(dryRun.queued.every((entry) => entry.queueReason === 'below_confidence')).toBe(true);
    expect(dryRun.diff).toMatchObject({
      create: appliedCount,
      patch: 0,
      skip: 0,
      conflict: 0,
      queued: queuedCount,
      changedFields: [],
      addedTraits: [],
      removedTraits: [],
    });
    expect(dryRun.conflictArtifactPath).toBe(expectedArtifactPath);
    expect(loadMappings().mappings).toHaveLength(0);
    expect(artifactAbsolutePath ? fs.existsSync(artifactAbsolutePath) : false).toBe(false);

    const applied = await applyHandle({
      reportPath: STAGE1_REAL_REPORT_PATH,
      apply: true,
      minConfidence: MIN_CONFIDENCE,
    });

    expect(applied.errors).toEqual([]);
    expect(applied.applied).toHaveLength(appliedCount);
    expect(applied.applied.every((entry) => entry.action === 'create' && entry.persisted === true)).toBe(true);
    expect(applied.skipped).toHaveLength(0);
    expect(applied.conflicted).toHaveLength(0);
    expect(applied.queued).toHaveLength(queuedCount);
    expect(applied.diff).toMatchObject({
      create: appliedCount,
      patch: 0,
      skip: 0,
      conflict: 0,
      queued: queuedCount,
    });
    expect(applied.conflictArtifactPath).toBe(expectedArtifactPath);
    expect(artifactAbsolutePath ? fs.existsSync(artifactAbsolutePath) : false).toBe(true);

    const mappings = loadMappings();
    expect(mappings.mappings).toHaveLength(appliedCount);
    expect(new Set(mappings.mappings.map((mapping) => mapping.externalSystem))).toEqual(new Set([expectedExternalSystem]));

    const snapshot = await snapshotHandle({});
    expect(snapshot.maps).toHaveLength(appliedCount);
    expect(Object.keys(snapshot.traits).length).toBeGreaterThan(0);
    expect(Object.keys(snapshot.objects).length).toBeGreaterThan(0);
    expect(snapshot.maps.every((mapping) => mapping.externalSystem === expectedExternalSystem)).toBe(true);

    const artifact = JSON.parse(fs.readFileSync(artifactAbsolutePath!, 'utf8'));
    expect(artifact.schemaVersion).toBe('1.0.0');
    expect(artifact.reconciliationSummary).toBeNull();
    expect(artifact.conflicts).toHaveLength(0);
    expect(artifact.belowConfidence).toHaveLength(queuedCount);

    const reapplied = await applyHandle({
      reportPath: STAGE1_REAL_REPORT_PATH,
      apply: true,
      minConfidence: MIN_CONFIDENCE,
    });

    expect(reapplied.errors).toEqual([]);
    expect(reapplied.applied).toHaveLength(appliedCount);
    expect(reapplied.applied.every((entry) => entry.persisted === false)).toBe(true);
    expect(loadMappings().mappings).toHaveLength(appliedCount);
  });
});
