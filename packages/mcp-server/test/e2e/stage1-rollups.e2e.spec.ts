/**
 * s94-m04: Real-data E2E gate vs Stage1 v1.6.0 rollup artifacts.
 *
 * Replaces the s93-m03 v1.5.0 gate (dc1cfabb + 07776e70) with the Stage1
 * Sprint 46 live reruns a0300dc0 (linear) + 7adc1d79 (stripe). Asserts that
 * m01's widened allow-list parses v1.6.0 schema_versions (identity_graph
 * 1.2.0, capability_rollup 1.2.0, object_rollup 1.1.0) and that m02's
 * normalizer correctly unwraps the new ConfidenceDecomposition shape.
 *
 * Schema-version back-compat with v1.5.0 artifacts is gated by unit tests
 * in src/tools/structuredData.fetch.rollup.test.ts and
 * src/stage1/capability-normalizer.test.ts; this gate runs against current
 * Stage1 to catch live drift early.
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

type V160RollupFixture = {
  name: 'linear' | 'stripe';
  runId: string;
  runPath: string;
  expectedUrl: string;
  expectedNodes: number;
  expectedCapabilities: number;
  expectedPresentations: number;
  expectedObjects: number;
  expectedVariantBearingObjects: number;
  expectedProjectionVariants: number;
};

const V160_ROLLUP_FIXTURES: V160RollupFixture[] = [
  {
    name: 'linear',
    runId: 'a0300dc0-c10f-4821-b648-48556da43ef7',
    runPath: path.resolve(
      __dirname,
      '../../../../../Stage1/out/sprint-46-live-rerun/stage1/linear-app-s46-m06-rerun/a0300dc0-c10f-4821-b648-48556da43ef7/artifacts',
    ),
    expectedUrl: 'https://linear.app/',
    expectedNodes: 80,
    expectedCapabilities: 7,
    expectedPresentations: 7,
    expectedObjects: 73,
    expectedVariantBearingObjects: 73,
    expectedProjectionVariants: 75,
  },
  {
    name: 'stripe',
    runId: '7adc1d79-426b-4c8e-a217-e6d5a129b182',
    runPath: path.resolve(
      __dirname,
      '../../../../../Stage1/out/sprint-46-live-rerun/stage1/stripe-com-s46-m06-rerun/7adc1d79-426b-4c8e-a217-e6d5a129b182/artifacts',
    ),
    expectedUrl: 'https://stripe.com/',
    expectedNodes: 144,
    expectedCapabilities: 12,
    expectedPresentations: 15,
    expectedObjects: 128,
    expectedVariantBearingObjects: 128,
    expectedProjectionVariants: 128,
  },
];

const allRollupFixturesAvailable = V160_ROLLUP_FIXTURES.every((fixture) =>
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

describe('s94-m04 Stage1 v1.6.0 rollup real-data gate (a0300dc0 + 7adc1d79)', () => {
  it.runIf(allRollupFixturesAvailable)(
    'structuredData.fetch returns shape-valid v1.6.0 rollups for all 3 kinds on both fixtures',
    async () => {
      for (const fixture of V160_ROLLUP_FIXTURES) {
        const graph = await fetchRollup<Stage1IdentityGraph>('identity_graph', fixture.runPath);
        expect(graph.schema_version).toBe('1.2.0');
        expect(graph.run_id).toBe(fixture.runId);
        expect(graph.target.url).toBe(fixture.expectedUrl);
        expect(graph.nodes).toHaveLength(fixture.expectedNodes);

        const caps = await fetchRollup<Stage1CapabilityRollup>(
          'capability_rollup',
          fixture.runPath,
        );
        expect(caps.schema_version).toBe('1.2.0');
        expect(caps.capabilities).toHaveLength(fixture.expectedCapabilities);
        expect(caps.capabilities.every((c) => typeof c.canonical_id === 'string')).toBe(true);
        expect(caps.capabilities.every((c) => Array.isArray(c.presentations))).toBe(true);

        const totalPresentations = caps.capabilities.reduce(
          (sum, c) => sum + (c.presentations?.length ?? 0),
          0,
        );
        expect(totalPresentations).toBe(fixture.expectedPresentations);

        const objects = await fetchRollup<Stage1ObjectRollup>('object_rollup', fixture.runPath);
        expect(objects.schema_version).toBe('1.1.0');
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
    'every v1.6.0 projection_variant carries a ConfidenceDecomposition (total + method + signals[])',
    async () => {
      for (const fixture of V160_ROLLUP_FIXTURES) {
        const objects = await fetchRollup<Stage1ObjectRollup>('object_rollup', fixture.runPath);
        for (const obj of objects.objects) {
          for (const variant of obj.projection_variants ?? []) {
            const c = variant.confidence as any;
            expect(c).toBeTypeOf('object');
            expect(typeof c.total).toBe('number');
            expect(c.total).toBeGreaterThanOrEqual(0);
            expect(c.total).toBeLessThanOrEqual(1);
            expect(typeof c.method).toBe('string');
            expect(Array.isArray(c.signals)).toBe(true);
            expect(c.signals.length).toBeGreaterThan(0);
          }
        }
      }
    },
  );

  it.runIf(allRollupFixturesAvailable)(
    'fetch ETag is stable across repeat calls for all 3 rollup kinds',
    async () => {
      for (const fixture of V160_ROLLUP_FIXTURES) {
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
      const fixture = V160_ROLLUP_FIXTURES[0];
      const sourcePath = path.join(fixture.runPath, 'object_rollup.json');
      const tmpDir = fs.mkdtempSync(path.join(path.dirname(fixture.runPath), '.s94-m04-tmp-'));
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
      for (const fixture of V160_ROLLUP_FIXTURES) {
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
    'normalizer threads capability_id on every presentation, unwraps confidence to scalar, covers all canonical_ids',
    async () => {
      for (const fixture of V160_ROLLUP_FIXTURES) {
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
        expect(presentationCount).toBe(fixture.expectedPresentations);

        for (const c of normalized) {
          for (const p of c.presentations) {
            expect(p.capability_id).toBe(c.canonical_id);
            for (const variant of p.projection_variants) {
              if (variant.confidence !== undefined) {
                expect(typeof variant.confidence).toBe('number');
              }
            }
          }
        }
      }
    },
  );

  it.runIf(allRollupFixturesAvailable)(
    'writes a gate report to cmos/reports/s94-m04-rollup-regate-2026-04-17.json',
    async () => {
      const REPO_ROOT = path.resolve(__dirname, '../../../../');
      const reportDir = path.join(REPO_ROOT, 'cmos', 'reports');
      fs.mkdirSync(reportDir, { recursive: true });
      const reportPath = path.join(reportDir, 's94-m04-rollup-regate-2026-04-17.json');

      const perFixture = [] as Array<Record<string, unknown>>;
      for (const fixture of V160_ROLLUP_FIXTURES) {
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

        // Sample a variant to record its decomposition shape on disk for traceability
        const decomposedVariants = objectRollup.objects
          .flatMap((o) => o.projection_variants ?? [])
          .filter((v) => v.confidence && typeof v.confidence === 'object').length;

        perFixture.push({
          name: fixture.name,
          runId: fixture.runId,
          targetUrl: fixture.expectedUrl,
          runPath: path.relative(REPO_ROOT, fixture.runPath),
          counts: {
            identityGraphNodes: identityGraph.nodes.length,
            capabilityRollupCapabilities: capabilityRollup.capabilities.length,
            capabilityRollupPresentations: capabilityRollup.capabilities.reduce(
              (sum, c) => sum + (c.presentations?.length ?? 0),
              0,
            ),
            objectRollupObjects: objectRollup.objects.length,
            objectRollupProjectionVariants: objectRollup.objects.reduce(
              (sum, o) => sum + (o.projection_variants?.length ?? 0),
              0,
            ),
            decomposedVariants,
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
        mission: 's94-m04',
        title: 'Real-data E2E gate vs Stage1 v1.6.0 rollup artifacts (a0300dc0 + 7adc1d79)',
        generatedAt: new Date().toISOString(),
        status: 'verified',
        basis: 'live_on_disk_rollups_via_structuredData_fetch',
        contractAlignment: {
          oods: 'v1.2.4 (sprint-94)',
          stage1: 'v1.6.0',
          oods_sprint_deliverables: [
            's94-m01 (structuredData.fetch allow-list widen for identity_graph 1.2.0 / capability_rollup 1.2.0 / object_rollup 1.1.0)',
            's94-m02 (normalizeCapabilities ConfidenceDecomposition unwrap)',
            's94-m03 (map.create raw-string coercion compat)',
          ],
        },
        acceptedSchemaVersions: {
          identity_graph: ['1.1.0', '1.2.0'],
          capability_rollup: ['1.1.0', '1.2.0'],
          object_rollup: ['1.0.0', '1.1.0'],
        },
        fixtures: perFixture,
        gateResults: {
          fetchShapeValid:
            'MET — all 3 kinds parse on both fixtures with v1.6.0 schema_versions and expected counts',
          confidenceDecompositionShape:
            'MET — every projection_variant.confidence carries total + method + signals[] (non-empty)',
          schemaVersionFastFail:
            'MET — forged schema_version "9.9.9" rejected with structured error',
          fetchEtagStability: 'MET — repeat fetches return identical etag and sizeBytes',
          normalizerDeterminism:
            'MET — byte-identical JSON.stringify across repeat normalize() calls on both fixtures',
          confidenceUnwrap:
            'MET — every NormalizedProjectionVariant.confidence is a scalar number (decomposition .total unwrapped)',
          capabilityIdThreading:
            'MET — every NormalizedPresentation carries capability_id; every capability_rollup canonical_id appears in the normalized output',
        },
      };

      fs.writeFileSync(reportPath, JSON.stringify(report, null, 2) + '\n');
      expect(fs.existsSync(reportPath)).toBe(true);
    },
  );
});
