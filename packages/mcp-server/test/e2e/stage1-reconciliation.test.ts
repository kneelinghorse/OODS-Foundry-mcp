import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { handle as applyHandle } from "../../src/tools/map.apply.js";
import { handle as createHandle } from "../../src/tools/map.create.js";
import { handle as snapshotHandle } from "../../src/tools/registry.snapshot.js";
import {
  loadMappings,
  slugify,
  type MappingsDoc,
} from "../../src/tools/map.shared.js";
import type {
  MapCreateInput,
  Stage1CandidateAction,
  Stage1CandidateObject,
  Stage1ProjectionVariant,
  Stage1ReconciliationReport,
} from "../../src/tools/types.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = path.resolve(__dirname, "../../../../");
const DEFAULT_MAPPINGS_PATH = path.join(
  REPO_ROOT,
  "artifacts",
  "structured-data",
  "component-mappings.json",
);
const MAPPINGS_PATH_ENV = "MCP_MAPPINGS_PATH";
const SYNTHETIC_REPORT_PATH = path.join(
  REPO_ROOT,
  "packages",
  "mcp-server",
  "test",
  "fixtures",
  "reconciliation-report-v1.1.0.json",
);
const MIN_CONFIDENCE = 0.75;

type RealReportFixture = {
  name: "linear" | "stripe";
  reportPath: string;
  expectedUrl: string;
  externalSystem: string;
  expectedCandidateObjects: number;
  expectedQueuedAtDefaultThreshold: number;
  expectedLowConfidenceConflictAnnotations: number;
};

const REAL_REPORT_FIXTURES: RealReportFixture[] = [
  {
    name: "linear",
    reportPath: path.resolve(
      __dirname,
      "../../../../../Stage1/out/stage1/linear-reconciliation-s43-validation/82201fef-efed-4bcf-8b39-192a09555745/artifacts/reconciliation_report.json",
    ),
    expectedUrl: "https://linear.app/",
    externalSystem: "linear",
    expectedCandidateObjects: 93,
    expectedQueuedAtDefaultThreshold: 13,
    expectedLowConfidenceConflictAnnotations: 4,
  },
  {
    name: "stripe",
    reportPath: path.resolve(
      __dirname,
      "../../../../../Stage1/out/stage1/stripe-reconciliation-s43-validation/da66f1d2-0d23-43c1-ba29-5c0ec7be631e/artifacts/reconciliation_report.json",
    ),
    expectedUrl: "https://stripe.com/",
    externalSystem: "stripe",
    expectedCandidateObjects: 195,
    expectedQueuedAtDefaultThreshold: 25,
    expectedLowConfidenceConflictAnnotations: 11,
  },
];

let originalMappings: string | null = null;
const originalArtifacts = new Map<string, string | null>();
let originalMappingsPathEnv: string | undefined;
let mappingsTmpDir: string | null = null;

function currentMappingsPath(): string {
  return process.env[MAPPINGS_PATH_ENV] || DEFAULT_MAPPINGS_PATH;
}

function seedEmptyMappings(): void {
  const mappingsPath = currentMappingsPath();
  const doc: MappingsDoc = {
    $schema:
      "../../packages/mcp-server/src/schemas/component-mapping.schema.json",
    generatedAt: "2026-04-16T00:00:00.000Z",
    version: "2026-04-16",
    stats: {
      mappingCount: 0,
      systemCount: 0,
    },
    mappings: [],
  };
  fs.mkdirSync(path.dirname(mappingsPath), { recursive: true });
  fs.writeFileSync(mappingsPath, JSON.stringify(doc, null, 2) + "\n");
}

function loadReport(reportPath: string): Stage1ReconciliationReport {
  return JSON.parse(
    fs.readFileSync(reportPath, "utf8"),
  ) as Stage1ReconciliationReport;
}

function buildArtifactRelativePath(report: Stage1ReconciliationReport): string {
  return path.join(
    ".oods",
    "conflicts",
    `${report.generated_at.replace(/:/g, "-")}-${slugify(report.target.id)}.json`,
  );
}

function buildArtifactAbsolutePath(report: Stage1ReconciliationReport): string {
  return path.join(REPO_ROOT, buildArtifactRelativePath(report));
}

function countQueuedCandidates(
  report: Stage1ReconciliationReport,
  minConfidence = MIN_CONFIDENCE,
): number {
  return report.candidate_objects.filter(
    (candidate) => candidate.confidence < minConfidence,
  ).length;
}

function countLowConfidenceConflictAnnotations(
  report: Stage1ReconciliationReport,
): number {
  return (
    report.conflicts?.filter((conflict) => conflict.type === "low_confidence")
      .length ?? 0
  );
}

function hasObjectOptionalFields(
  predicate: (candidate: Stage1CandidateObject) => boolean,
  report: Stage1ReconciliationReport,
): boolean {
  return report.candidate_objects.some((candidate) => predicate(candidate));
}

function hasActionOptionalFields(
  predicate: (action: Stage1CandidateAction) => boolean,
  report: Stage1ReconciliationReport,
): boolean {
  return (report.candidate_actions ?? []).some((action) => predicate(action));
}

const allRealReportsAvailable = REAL_REPORT_FIXTURES.every((fixture) =>
  fs.existsSync(fixture.reportPath),
);

beforeAll(() => {
  originalMappingsPathEnv = process.env[MAPPINGS_PATH_ENV];
  const originalPath = currentMappingsPath();
  originalMappings = fs.existsSync(originalPath)
    ? fs.readFileSync(originalPath, "utf8")
    : null;
  mappingsTmpDir = fs.mkdtempSync(path.join(os.tmpdir(), "oods-stage1-reconciliation-"));
  process.env[MAPPINGS_PATH_ENV] = path.join(mappingsTmpDir, "component-mappings.json");

  for (const fixture of REAL_REPORT_FIXTURES) {
    if (!fs.existsSync(fixture.reportPath)) continue;
    const report = loadReport(fixture.reportPath);
    const artifactPath = buildArtifactAbsolutePath(report);
    originalArtifacts.set(
      artifactPath,
      fs.existsSync(artifactPath)
        ? fs.readFileSync(artifactPath, "utf8")
        : null,
    );
  }
});

afterAll(() => {
  if (mappingsTmpDir) {
    fs.rmSync(mappingsTmpDir, { force: true, recursive: true });
    mappingsTmpDir = null;
  }
  if (originalMappingsPathEnv === undefined) {
    delete process.env[MAPPINGS_PATH_ENV];
  } else {
    process.env[MAPPINGS_PATH_ENV] = originalMappingsPathEnv;
  }
  const mappingsPath = currentMappingsPath();
  if (originalMappings === null) {
    fs.rmSync(mappingsPath, { force: true });
  } else {
    fs.mkdirSync(path.dirname(mappingsPath), { recursive: true });
    fs.writeFileSync(mappingsPath, originalMappings);
  }

  for (const [artifactPath, originalArtifact] of originalArtifacts.entries()) {
    if (originalArtifact === null) {
      fs.rmSync(artifactPath, { force: true });
      continue;
    }
    fs.mkdirSync(path.dirname(artifactPath), { recursive: true });
    fs.writeFileSync(artifactPath, originalArtifact);
  }
});

beforeEach(() => {
  seedEmptyMappings();
  for (const fixture of REAL_REPORT_FIXTURES) {
    if (!fs.existsSync(fixture.reportPath)) continue;
    fs.rmSync(buildArtifactAbsolutePath(loadReport(fixture.reportPath)), {
      force: true,
    });
  }
});

describe("real emitted Stage1 reconciliation report → map.apply → registry.snapshot", () => {
  it.runIf(allRealReportsAvailable)(
    "re-gates the on-disk linear.app and stripe.com reports against actual routing behavior",
    async () => {
      let aggregateAppliedAtZeroThreshold = 0;
      let aggregateQueuedAtDefaultThreshold = 0;
      let aggregateLowConfidenceConflictAnnotations = 0;

      for (const fixture of REAL_REPORT_FIXTURES) {
        const report = loadReport(fixture.reportPath);
        const artifactRelativePath = buildArtifactRelativePath(report);
        const artifactAbsolutePath = buildArtifactAbsolutePath(report);
        const queuedAtDefaultThreshold = countQueuedCandidates(report);
        const lowConfidenceConflictAnnotations =
          countLowConfidenceConflictAnnotations(report);

        expect(report.kind).toBe("reconciliation_report");
        expect(report.schema_version).toBe("1.1.0");
        expect(report.target.url).toBe(fixture.expectedUrl);
        expect(report.candidate_objects).toHaveLength(
          fixture.expectedCandidateObjects,
        );
        expect(
          report.candidate_objects.every(
            (candidate) => candidate.action === "create",
          ),
        ).toBe(true);
        expect(
          report.candidate_objects.every(
            (candidate) => typeof candidate.verdict_reasoning === "string",
          ),
        ).toBe(true);
        expect(
          report.candidate_objects.every(
            (candidate) => !("external_component" in candidate),
          ),
        ).toBe(true);
        expect(report.reconciliation_summary).toMatchObject({
          mode: "reconciliation",
          existing_map_count: 0,
          verdict_counts: {
            create: fixture.expectedCandidateObjects,
            patch: 0,
            skip: 0,
            conflict: 0,
          },
        });
        expect(queuedAtDefaultThreshold).toBe(
          fixture.expectedQueuedAtDefaultThreshold,
        );
        expect(lowConfidenceConflictAnnotations).toBe(
          fixture.expectedLowConfidenceConflictAnnotations,
        );

        seedEmptyMappings();
        fs.rmSync(artifactAbsolutePath, { force: true });

        const minZeroDryRun = await applyHandle({
          reportPath: fixture.reportPath,
          minConfidence: 0,
        });

        expect(minZeroDryRun.errors).toEqual([]);
        expect(minZeroDryRun.applied).toHaveLength(
          fixture.expectedCandidateObjects,
        );
        expect(
          minZeroDryRun.applied.every(
            (entry) => entry.action === "create" && entry.persisted === false,
          ),
        ).toBe(true);
        expect(minZeroDryRun.skipped).toHaveLength(0);
        expect(minZeroDryRun.conflicted).toHaveLength(0);
        expect(minZeroDryRun.queued).toHaveLength(0);
        expect(minZeroDryRun.diff).toMatchObject({
          create: fixture.expectedCandidateObjects,
          patch: 0,
          skip: 0,
          conflict: 0,
          queued: 0,
          changedFields: [],
          addedTraits: [],
          removedTraits: [],
        });
        expect(minZeroDryRun.conflictArtifactPath).toBeUndefined();
        expect(loadMappings().mappings).toHaveLength(0);
        expect(fs.existsSync(artifactAbsolutePath)).toBe(false);

        const defaultThresholdDryRun = await applyHandle({
          reportPath: fixture.reportPath,
          minConfidence: MIN_CONFIDENCE,
        });

        expect(defaultThresholdDryRun.errors).toEqual([]);
        expect(defaultThresholdDryRun.applied).toHaveLength(
          fixture.expectedCandidateObjects -
            fixture.expectedQueuedAtDefaultThreshold,
        );
        expect(
          defaultThresholdDryRun.applied.every(
            (entry) => entry.action === "create" && entry.persisted === false,
          ),
        ).toBe(true);
        expect(defaultThresholdDryRun.skipped).toHaveLength(0);
        expect(defaultThresholdDryRun.conflicted).toHaveLength(0);
        expect(defaultThresholdDryRun.queued).toHaveLength(
          fixture.expectedQueuedAtDefaultThreshold,
        );
        expect(
          defaultThresholdDryRun.queued.every(
            (entry) =>
              entry.action === "create" &&
              entry.queueReason === "below_confidence" &&
              entry.threshold === MIN_CONFIDENCE,
          ),
        ).toBe(true);
        expect(defaultThresholdDryRun.diff).toMatchObject({
          create:
            fixture.expectedCandidateObjects -
            fixture.expectedQueuedAtDefaultThreshold,
          patch: 0,
          skip: 0,
          conflict: 0,
          queued: fixture.expectedQueuedAtDefaultThreshold,
          changedFields: [],
          addedTraits: [],
          removedTraits: [],
        });
        expect(defaultThresholdDryRun.conflictArtifactPath).toBe(
          artifactRelativePath,
        );
        expect(loadMappings().mappings).toHaveLength(0);
        expect(fs.existsSync(artifactAbsolutePath)).toBe(false);

        seedEmptyMappings();
        fs.rmSync(artifactAbsolutePath, { force: true });

        const minZeroApplied = await applyHandle({
          reportPath: fixture.reportPath,
          apply: true,
          minConfidence: 0,
        });

        expect(minZeroApplied.errors).toEqual([]);
        expect(minZeroApplied.applied).toHaveLength(
          fixture.expectedCandidateObjects,
        );
        expect(
          minZeroApplied.applied.every(
            (entry) => entry.action === "create" && entry.persisted === true,
          ),
        ).toBe(true);
        expect(minZeroApplied.skipped).toHaveLength(0);
        expect(minZeroApplied.conflicted).toHaveLength(0);
        expect(minZeroApplied.queued).toHaveLength(0);
        expect(minZeroApplied.conflictArtifactPath).toBeUndefined();
        expect(fs.existsSync(artifactAbsolutePath)).toBe(false);

        const mappings = loadMappings();
        expect(mappings.mappings).toHaveLength(
          fixture.expectedCandidateObjects,
        );
        expect(
          new Set(mappings.mappings.map((mapping) => mapping.externalSystem)),
        ).toEqual(new Set([fixture.externalSystem]));

        const snapshot = await snapshotHandle({});
        expect(snapshot.maps).toHaveLength(fixture.expectedCandidateObjects);
        expect(
          snapshot.maps.every(
            (mapping) => mapping.externalSystem === fixture.externalSystem,
          ),
        ).toBe(true);
        expect(Object.keys(snapshot.traits).length).toBeGreaterThan(0);
        expect(Object.keys(snapshot.objects).length).toBeGreaterThan(0);

        seedEmptyMappings();
        fs.rmSync(artifactAbsolutePath, { force: true });

        const defaultThresholdApplied = await applyHandle({
          reportPath: fixture.reportPath,
          apply: true,
          minConfidence: MIN_CONFIDENCE,
        });

        expect(defaultThresholdApplied.errors).toEqual([]);
        expect(defaultThresholdApplied.applied).toHaveLength(
          fixture.expectedCandidateObjects -
            fixture.expectedQueuedAtDefaultThreshold,
        );
        expect(
          defaultThresholdApplied.applied.every(
            (entry) => entry.action === "create" && entry.persisted === true,
          ),
        ).toBe(true);
        expect(defaultThresholdApplied.skipped).toHaveLength(0);
        expect(defaultThresholdApplied.conflicted).toHaveLength(0);
        expect(defaultThresholdApplied.queued).toHaveLength(
          fixture.expectedQueuedAtDefaultThreshold,
        );
        expect(defaultThresholdApplied.conflictArtifactPath).toBe(
          artifactRelativePath,
        );
        expect(fs.existsSync(artifactAbsolutePath)).toBe(true);

        const artifact = JSON.parse(
          fs.readFileSync(artifactAbsolutePath, "utf8"),
        );
        expect(artifact.schemaVersion).toBe("1.1.0");
        expect(artifact.reconciliationSummary).toMatchObject(
          report.reconciliation_summary ?? {},
        );
        expect(artifact.conflicts).toHaveLength(0);
        expect(artifact.belowConfidence).toHaveLength(
          fixture.expectedQueuedAtDefaultThreshold,
        );

        aggregateAppliedAtZeroThreshold += minZeroApplied.applied.length;
        aggregateQueuedAtDefaultThreshold +=
          defaultThresholdDryRun.queued.length;
        aggregateLowConfidenceConflictAnnotations +=
          lowConfidenceConflictAnnotations;
      }

      expect(aggregateAppliedAtZeroThreshold).toBe(288);
      expect(aggregateQueuedAtDefaultThreshold).toBe(38);
      expect(aggregateLowConfidenceConflictAnnotations).toBe(15);
    },
  );

  it.runIf(allRealReportsAvailable)(
    "documents the optional-field distinction between the synthetic fixture and the live reports",
    () => {
      const syntheticReport = loadReport(SYNTHETIC_REPORT_PATH);

      expect(syntheticReport.schema_version).toBe("1.1.0");
      expect(syntheticReport.reconciliation_summary).toBeDefined();
      expect(
        syntheticReport.manifest?.inputs?.oods_registry_fetch,
      ).toBeDefined();
      expect(
        hasObjectOptionalFields(
          (candidate) => candidate.diff !== undefined,
          syntheticReport,
        ),
      ).toBe(true);
      expect(
        hasObjectOptionalFields(
          (candidate) =>
            Array.isArray(candidate.alternate_interpretations) &&
            candidate.alternate_interpretations.length > 0,
          syntheticReport,
        ),
      ).toBe(true);
      expect(
        hasActionOptionalFields(
          (action) =>
            Array.isArray(action.alternate_verbs) &&
            action.alternate_verbs.length > 0,
          syntheticReport,
        ),
      ).toBe(true);
      expect(
        hasActionOptionalFields(
          (action) =>
            Array.isArray(action.preconditions) &&
            action.preconditions.length > 0,
          syntheticReport,
        ),
      ).toBe(true);

      for (const fixture of REAL_REPORT_FIXTURES) {
        const report = loadReport(fixture.reportPath);

        // v1.1.0 regression gate: these are the older s43-validation fixtures.
        // v1.2.0+ reports (s92-m03 v1.5.0 fixtures) are exercised in a separate
        // describe block below and carry additional candidate-object fields.
        expect(report.schema_version).toBe("1.1.0");
        expect(report.reconciliation_summary).toBeDefined();
        expect(report.manifest).toBeUndefined();
        expect(
          report.candidate_objects.every(
            (candidate) => typeof candidate.verdict_reasoning === "string",
          ),
        ).toBe(true);
        expect(
          hasObjectOptionalFields(
            (candidate) => candidate.diff !== undefined,
            report,
          ),
        ).toBe(false);
        expect(
          hasObjectOptionalFields(
            (candidate) =>
              Array.isArray(candidate.alternate_interpretations) &&
              candidate.alternate_interpretations.length > 0,
            report,
          ),
        ).toBe(false);
        expect(
          hasActionOptionalFields(
            (action) =>
              Array.isArray(action.alternate_verbs) &&
              action.alternate_verbs.length > 0,
            report,
          ),
        ).toBe(false);
        expect(
          hasActionOptionalFields(
            (action) =>
              Array.isArray(action.preconditions) &&
              action.preconditions.length > 0,
            report,
          ),
        ).toBe(false);
        expect(countLowConfidenceConflictAnnotations(report)).toBeGreaterThan(
          0,
        );
      }
    },
  );
});

// ── s92-m03: Real-data re-gate vs Stage1 v1.5.0 runs (dc1cfabb + 07776e70) ──
// Supersedes the older 82201fef + da66f1d2 v1.3 captures used in s91-m01. The
// new v1.5.0 runs produce reconciliation_report schema_version="1.2.0" (now with
// external_component on candidates) AND bridge.json mappings that carry the
// Stage1 v1.5.0 §7.3 projection_variants[]. Two pathways are gated here:
//   1) recon_report → map.apply (confirms m02's external_component acceptance
//      and bucket-count stability against real-shape data)
//   2) bridge.json mappings → map.create (confirms m01's projection_variants
//      write-path survives round-trip on 73 + 128 variant-bearing mappings)

type V150Fixture = {
  name: "linear" | "stripe";
  reportPath: string;
  bridgePath: string;
  expectedUrl: string;
  expectedCandidateObjects: number;
  expectedBridgeMappings: number;
  expectedVariantBearing: number;
  expectedMultiVariant: number;
  expectedQueuedAtDefaultThreshold: number;
  expectedLowConfidenceConflictAnnotations: number;
};

const V150_FIXTURES: V150Fixture[] = [
  {
    name: "linear",
    reportPath: path.resolve(
      __dirname,
      "../../../../../Stage1/out/sprint-45-live-rerun/stage1/linear-app-s45-m06-rerun/dc1cfabb-f07a-47dc-8a23-ba160e5b45b9/artifacts/reconciliation_report.json",
    ),
    bridgePath: path.resolve(
      __dirname,
      "../../../../../Stage1/out/sprint-45-live-rerun/stage1/linear-app-s45-m06-rerun/dc1cfabb-f07a-47dc-8a23-ba160e5b45b9/bridge.json",
    ),
    expectedUrl: "https://linear.app/",
    expectedCandidateObjects: 73,
    expectedBridgeMappings: 73,
    expectedVariantBearing: 73,
    expectedMultiVariant: 2,
    expectedQueuedAtDefaultThreshold: 12,
    expectedLowConfidenceConflictAnnotations: 5,
  },
  {
    name: "stripe",
    reportPath: path.resolve(
      __dirname,
      "../../../../../Stage1/out/sprint-45-live-rerun/stage1/stripe-com-s45-m06-rerun/07776e70-ec86-449a-b570-3978161793ac/artifacts/reconciliation_report.json",
    ),
    bridgePath: path.resolve(
      __dirname,
      "../../../../../Stage1/out/sprint-45-live-rerun/stage1/stripe-com-s45-m06-rerun/07776e70-ec86-449a-b570-3978161793ac/bridge.json",
    ),
    expectedUrl: "https://stripe.com/",
    expectedCandidateObjects: 129,
    expectedBridgeMappings: 129,
    expectedVariantBearing: 128,
    expectedMultiVariant: 0,
    expectedQueuedAtDefaultThreshold: 17,
    expectedLowConfidenceConflictAnnotations: 9,
  },
];

type BridgeMapping = {
  externalSystem: string;
  externalComponent: string;
  oodsTraits: string[];
  confidence?: number;
  propMappings?: Array<{ externalProp: string; oodsProp: string }>;
  projection_variants?: Stage1ProjectionVariant[];
};

type BridgePayload = {
  mappings: BridgeMapping[];
};

const allV150ReportsAvailable = V150_FIXTURES.every(
  (fixture) =>
    fs.existsSync(fixture.reportPath) && fs.existsSync(fixture.bridgePath),
);

describe("s92-m03 Stage1 v1.5.0 real-data re-gate (dc1cfabb + 07776e70)", () => {
  beforeEach(() => {
    seedEmptyMappings();
    for (const fixture of V150_FIXTURES) {
      if (!fs.existsSync(fixture.reportPath)) continue;
      fs.rmSync(buildArtifactAbsolutePath(loadReport(fixture.reportPath)), {
        force: true,
      });
    }
  });

  it.runIf(allV150ReportsAvailable)(
    "recon_report path: accepts v1.2.0 external_component on candidate_objects and routes to create verdicts without regression",
    async () => {
      for (const fixture of V150_FIXTURES) {
        const report = loadReport(fixture.reportPath);

        expect(report.kind).toBe("reconciliation_report");
        expect(report.schema_version).toBe("1.2.0");
        expect(report.target.url).toBe(fixture.expectedUrl);
        expect(report.candidate_objects).toHaveLength(
          fixture.expectedCandidateObjects,
        );
        expect(
          report.candidate_objects.every(
            (candidate) => candidate.action === "create",
          ),
        ).toBe(true);
        // v1.2.0 carries external_component on every candidate_object — this
        // would have been rejected pre-s92-m02.
        expect(
          report.candidate_objects.every(
            (candidate) => typeof candidate.external_component === "string",
          ),
        ).toBe(true);

        seedEmptyMappings();

        const applyZero = await applyHandle({
          reportPath: fixture.reportPath,
          apply: true,
          minConfidence: 0,
        });

        expect(applyZero.errors).toEqual([]);
        expect(applyZero.applied).toHaveLength(
          fixture.expectedCandidateObjects,
        );
        expect(
          applyZero.applied.every(
            (entry) => entry.action === "create" && entry.persisted === true,
          ),
        ).toBe(true);

        expect(
          countQueuedCandidates(report, MIN_CONFIDENCE),
        ).toBe(fixture.expectedQueuedAtDefaultThreshold);
        expect(countLowConfidenceConflictAnnotations(report)).toBe(
          fixture.expectedLowConfidenceConflictAnnotations,
        );

        seedEmptyMappings();
      }
    },
  );

  it.runIf(allV150ReportsAvailable)(
    "bridge.json path: all variant-bearing mappings round-trip through map.create with projection_variants preserved byte-identical",
    async () => {
      for (const fixture of V150_FIXTURES) {
        seedEmptyMappings();

        const bridge = JSON.parse(
          fs.readFileSync(fixture.bridgePath, "utf8"),
        ) as BridgePayload;

        expect(bridge.mappings).toHaveLength(fixture.expectedBridgeMappings);

        const variantBearing = bridge.mappings.filter(
          (mapping) =>
            Array.isArray(mapping.projection_variants) &&
            mapping.projection_variants.length > 0,
        );
        expect(variantBearing).toHaveLength(fixture.expectedVariantBearing);

        const multiVariant = bridge.mappings.filter(
          (mapping) =>
            Array.isArray(mapping.projection_variants) &&
            mapping.projection_variants.length > 1,
        );
        expect(multiVariant).toHaveLength(fixture.expectedMultiVariant);

        // Exercise map.create for every variant-bearing mapping and confirm
        // variants survive byte-identical through persistence.
        let created = 0;
        for (const mapping of variantBearing) {
          const input: MapCreateInput = {
            apply: true,
            externalSystem: mapping.externalSystem,
            externalComponent: mapping.externalComponent,
            oodsTraits: mapping.oodsTraits,
            confidence: "auto",
            projection_variants: mapping.projection_variants,
          };
          const result = await createHandle(input);
          expect(result.status).toBe("ok");
          const persistedVariants = (result.mapping as { projection_variants?: unknown })
            .projection_variants;
          expect(persistedVariants).toEqual(mapping.projection_variants);
          created += 1;
        }

        expect(created).toBe(fixture.expectedVariantBearing);

        // Re-read from disk to confirm the on-disk shape is byte-identical for
        // projection_variants (canonical JSON comparison of each mapping).
        const doc = loadMappings();
        for (const mapping of variantBearing) {
          const persisted = doc.mappings.find(
            (candidate) =>
              candidate.externalSystem === mapping.externalSystem &&
              candidate.externalComponent === mapping.externalComponent,
          );
          expect(persisted).toBeDefined();
          expect(JSON.stringify(persisted?.projection_variants)).toBe(
            JSON.stringify(mapping.projection_variants),
          );
        }

        seedEmptyMappings();
      }
    },
  );
});
