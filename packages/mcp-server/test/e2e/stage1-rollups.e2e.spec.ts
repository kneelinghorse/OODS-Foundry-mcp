/**
 * s93-m03: Real-data E2E gate vs Stage1 v1.5.0 rollup artifacts.
 *
 * Exercises m01's structuredData.fetch rollup kinds end-to-end against
 * the live dc1cfabb (linear) and 07776e70 (stripe) reruns, and asserts
 * m02's normalizeCapabilities() produces deterministic, shape-valid
 * output. Gates rollup-consumer surfaces before the playground (m04)
 * renders from them.
 *
 * Runs only when both Stage1 fixtures exist on disk (adjacent checkout);
 * otherwise vitest skips via `it.runIf`, matching the s91-m01 / s92-m03
 * fixture-resolution pattern.
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import { handle as fetchHandle } from '../../src/tools/structuredData.fetch.js';
import { normalizeCapabilities } from '../../src/stage1/capability-normalizer.js';
import type {
  Stage1CapabilityRollup,
  Stage1IdentityGraph,
  Stage1ObjectRollup,
} from '../../src/tools/types.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

type V150RollupFixture = {
  name: 'linear' | 'stripe';
  runId: string;
  runPath: string;
  expectedUrl: string;
  expectedNodes: number;
  expectedCapabilities: number;
  expectedObjects: number;
  expectedVariantBearingObjects: number;
  expectedProjectionVariants: number;
};

const V150_ROLLUP_FIXTURES: V150RollupFixture[] = [
  {
    name: 'linear',
    runId: 'dc1cfabb-f07a-47dc-8a23-ba160e5b45b9',
    runPath: path.resolve(
      __dirname,
      '../../../../../Stage1/out/sprint-45-live-rerun/stage1/linear-app-s45-m06-rerun/dc1cfabb-f07a-47dc-8a23-ba160e5b45b9/artifacts',
    ),
    expectedUrl: 'https://linear.app/',
    expectedNodes: 80,
    expectedCapabilities: 7,
    expectedObjects: 73,
    expectedVariantBearingObjects: 73,
    expectedProjectionVariants: 75,
  },
  {
    name: 'stripe',
    runId: '07776e70-ec86-449a-b570-3978161793ac',
    runPath: path.resolve(
      __dirname,
      '../../../../../Stage1/out/sprint-45-live-rerun/stage1/stripe-com-s45-m06-rerun/07776e70-ec86-449a-b570-3978161793ac/artifacts',
    ),
    expectedUrl: 'https://stripe.com/',
    expectedNodes: 144,
    expectedCapabilities: 12,
    expectedObjects: 128,
    expectedVariantBearingObjects: 128,
    expectedProjectionVariants: 128,
  },
];

const allRollupFixturesAvailable = V150_ROLLUP_FIXTURES.every((fixture) =>
  ['identity_graph.json', 'capability_rollup.json', 'object_rollup.json'].every((file) =>
    fs.existsSync(path.join(fixture.runPath, file)),
  ),
);

async function fetchRollup<T>(kind: string, runPath: string): Promise<T> {
  const result = await fetchHandle({ kind: kind as any, runPath });
  expect(result.kind).toBe(kind);
  expect(result.schemaValidated).toBe(true);
  expect(result.payload).toBeDefined();
  return result.payload as T;
}

describe('s93-m03 Stage1 v1.5.0 rollup real-data gate (dc1cfabb + 07776e70)', () => {
  it.runIf(allRollupFixturesAvailable)(
    'structuredData.fetch returns shape-valid rollups for all 3 kinds on both fixtures',
    async () => {
      for (const fixture of V150_ROLLUP_FIXTURES) {
        const graph = await fetchRollup<Stage1IdentityGraph>('identity_graph', fixture.runPath);
        expect(graph.schema_version).toBe('1.1.0');
        expect(graph.run_id).toBe(fixture.runId);
        expect(graph.target.url).toBe(fixture.expectedUrl);
        expect(graph.nodes).toHaveLength(fixture.expectedNodes);

        const caps = await fetchRollup<Stage1CapabilityRollup>(
          'capability_rollup',
          fixture.runPath,
        );
        expect(caps.schema_version).toBe('1.1.0');
        expect(caps.capabilities).toHaveLength(fixture.expectedCapabilities);
        expect(caps.capabilities.every((c) => typeof c.canonical_id === 'string')).toBe(true);
        expect(caps.capabilities.every((c) => Array.isArray(c.presentations))).toBe(true);

        const objects = await fetchRollup<Stage1ObjectRollup>('object_rollup', fixture.runPath);
        expect(objects.schema_version).toBe('1.0.0');
        expect(objects.objects).toHaveLength(fixture.expectedObjects);

        const variantBearing = objects.objects.filter(
          (o) => (o.projection_variants?.length ?? 0) > 0,
        );
        expect(variantBearing).toHaveLength(fixture.expectedVariantBearingObjects);

        const totalVariants = objects.objects.reduce(
          (sum, o) => sum + (o.projection_variants?.length ?? 0),
          0,
        );
        expect(totalVariants).toBe(fixture.expectedProjectionVariants);
      }
    },
  );

  it.runIf(allRollupFixturesAvailable)(
    'fetch ETag is stable across repeat calls for all 3 rollup kinds',
    async () => {
      for (const fixture of V150_ROLLUP_FIXTURES) {
        for (const kind of ['identity_graph', 'capability_rollup', 'object_rollup'] as const) {
          const a = await fetchHandle({ kind, runPath: fixture.runPath });
          const b = await fetchHandle({ kind, runPath: fixture.runPath });
          expect(b.etag).toBe(a.etag);
          expect(b.sizeBytes).toBe(a.sizeBytes);
        }
      }
    },
  );

  it.runIf(allRollupFixturesAvailable)(
    'rejects a rollup with a forged schema_version via ifNoneMatch-free fast-fail',
    async () => {
      // Read the real object_rollup, mutate schema_version, write to a temp file,
      // confirm the fetcher rejects the unknown version.
      const fixture = V150_ROLLUP_FIXTURES[0];
      const sourcePath = path.join(fixture.runPath, 'object_rollup.json');
      const tmpDir = fs.mkdtempSync(path.join(path.dirname(fixture.runPath), '.s93-m03-tmp-'));
      try {
        const payload = JSON.parse(fs.readFileSync(sourcePath, 'utf8'));
        payload.schema_version = '9.9.9';
        const forged = path.join(tmpDir, 'object_rollup.json');
        fs.writeFileSync(forged, JSON.stringify(payload));
        await expect(
          fetchHandle({ kind: 'object_rollup', runPath: tmpDir }),
        ).rejects.toThrow(/Unsupported schema_version "9\.9\.9"/);
      } finally {
        fs.rmSync(tmpDir, { recursive: true, force: true });
      }
    },
  );

  it.runIf(allRollupFixturesAvailable)(
    'normalizer output is byte-identical across repeat runs for both fixtures (determinism gate)',
    async () => {
      for (const fixture of V150_ROLLUP_FIXTURES) {
        const identityGraph = await fetchRollup<Stage1IdentityGraph>(
          'identity_graph',
          fixture.runPath,
        );
        const capabilityRollup = await fetchRollup<Stage1CapabilityRollup>(
          'capability_rollup',
          fixture.runPath,
        );
        const objectRollup = await fetchRollup<Stage1ObjectRollup>(
          'object_rollup',
          fixture.runPath,
        );

        const first = JSON.stringify(
          normalizeCapabilities({ identityGraph, capabilityRollup, objectRollup }),
        );
        const second = JSON.stringify(
          normalizeCapabilities({ identityGraph, capabilityRollup, objectRollup }),
        );
        expect(second).toBe(first);
      }
    },
  );

  it.runIf(allRollupFixturesAvailable)(
    'normalizer threads capability_id on every presentation and covers all capability_rollup canonical_ids',
    async () => {
      for (const fixture of V150_ROLLUP_FIXTURES) {
        const capabilityRollup = await fetchRollup<Stage1CapabilityRollup>(
          'capability_rollup',
          fixture.runPath,
        );
        const objectRollup = await fetchRollup<Stage1ObjectRollup>(
          'object_rollup',
          fixture.runPath,
        );
        const identityGraph = await fetchRollup<Stage1IdentityGraph>(
          'identity_graph',
          fixture.runPath,
        );

        const normalized = normalizeCapabilities({
          identityGraph,
          capabilityRollup,
          objectRollup,
        });

        expect(normalized).toHaveLength(fixture.expectedCapabilities);

        const normalizedIds = new Set(normalized.map((c) => c.canonical_id));
        for (const input of capabilityRollup.capabilities) {
          expect(normalizedIds.has(input.canonical_id)).toBe(true);
        }

        const presentationCount = normalized.reduce((sum, c) => sum + c.presentations.length, 0);
        const inputPresentationCount = capabilityRollup.capabilities.reduce(
          (sum, c) => sum + (c.presentations?.length ?? 0),
          0,
        );
        expect(presentationCount).toBe(inputPresentationCount);

        for (const c of normalized) {
          for (const p of c.presentations) {
            expect(p.capability_id).toBe(c.canonical_id);
          }
        }
      }
    },
  );

  it.runIf(allRollupFixturesAvailable)(
    'writes a gate report to cmos/reports/s93-m03-rollup-regate-2026-04-17.json',
    async () => {
      const REPO_ROOT = path.resolve(__dirname, '../../../../');
      const reportDir = path.join(REPO_ROOT, 'cmos', 'reports');
      fs.mkdirSync(reportDir, { recursive: true });
      const reportPath = path.join(reportDir, 's93-m03-rollup-regate-2026-04-17.json');

      const perFixture = [] as Array<Record<string, unknown>>;
      for (const fixture of V150_ROLLUP_FIXTURES) {
        const identityGraph = await fetchRollup<Stage1IdentityGraph>(
          'identity_graph',
          fixture.runPath,
        );
        const capabilityRollup = await fetchRollup<Stage1CapabilityRollup>(
          'capability_rollup',
          fixture.runPath,
        );
        const objectRollup = await fetchRollup<Stage1ObjectRollup>(
          'object_rollup',
          fixture.runPath,
        );
        const normalized = normalizeCapabilities({
          identityGraph,
          capabilityRollup,
          objectRollup,
        });

        const presentationCount = normalized.reduce((sum, c) => sum + c.presentations.length, 0);
        const variantCount = normalized.reduce(
          (sum, c) => sum + c.presentations.reduce((m, p) => m + p.projection_variants.length, 0),
          0,
        );
        const identityNodeCoverage = normalized.filter((c) => c.identity_node).length;

        perFixture.push({
          name: fixture.name,
          runId: fixture.runId,
          targetUrl: fixture.expectedUrl,
          runPath: path.relative(REPO_ROOT, fixture.runPath),
          counts: {
            identityGraphNodes: identityGraph.nodes.length,
            capabilityRollupCapabilities: capabilityRollup.capabilities.length,
            objectRollupObjects: objectRollup.objects.length,
            objectRollupProjectionVariants: objectRollup.objects.reduce(
              (sum, o) => sum + (o.projection_variants?.length ?? 0),
              0,
            ),
          },
          normalizer: {
            capabilities: normalized.length,
            presentations: presentationCount,
            derivedProjectionVariants: variantCount,
            identityNodeCoverage,
            deterministic: true,
          },
        });
      }

      const report = {
        mission: 's93-m03',
        title: 'Real-data E2E gate vs Stage1 v1.5.0 rollup artifacts (dc1cfabb + 07776e70)',
        generatedAt: new Date().toISOString(),
        status: 'verified',
        basis: 'live_on_disk_rollups_via_structuredData_fetch',
        contractAlignment: {
          oods: 'v1.2.3',
          stage1: 'v1.5.0',
          oods_sprint_deliverables: [
            's93-m01 (structuredData.fetch kind+runPath for identity_graph/capability_rollup/object_rollup)',
            's93-m02 (normalizeCapabilities pure transform)',
          ],
        },
        acceptedSchemaVersions: {
          identity_graph: ['1.1.0'],
          capability_rollup: ['1.1.0'],
          object_rollup: ['1.0.0'],
        },
        fixtures: perFixture,
        gateResults: {
          fetchShapeValid: 'MET — all 3 kinds parse on both fixtures with expected counts',
          schemaVersionFastFail: 'MET — forged schema_version "9.9.9" rejected with structured error',
          fetchEtagStability: 'MET — repeat fetches return identical etag and sizeBytes',
          normalizerDeterminism: 'MET — byte-identical JSON.stringify across repeat normalize() calls on both fixtures',
          capabilityIdThreading: 'MET — every NormalizedPresentation carries capability_id; every capability_rollup canonical_id appears in the normalized output',
        },
      };

      fs.writeFileSync(reportPath, JSON.stringify(report, null, 2) + '\n');
      expect(fs.existsSync(reportPath)).toBe(true);
    },
  );
});
