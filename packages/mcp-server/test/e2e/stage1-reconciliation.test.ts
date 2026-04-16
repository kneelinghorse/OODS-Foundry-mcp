import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { handle as applyHandle } from "../../src/tools/map.apply.js";
import { handle as snapshotHandle } from "../../src/tools/registry.snapshot.js";
import {
  loadMappings,
  slugify,
  type MappingsDoc,
} from "../../src/tools/map.shared.js";
import type {
  Stage1CandidateAction,
  Stage1CandidateObject,
  Stage1ReconciliationReport,
} from "../../src/tools/types.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = path.resolve(__dirname, "../../../../");
const MAPPINGS_PATH = path.join(
  REPO_ROOT,
  "artifacts",
  "structured-data",
  "component-mappings.json",
);
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

function seedEmptyMappings(): void {
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
  fs.writeFileSync(MAPPINGS_PATH, JSON.stringify(doc, null, 2) + "\n");
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
  originalMappings = fs.existsSync(MAPPINGS_PATH)
    ? fs.readFileSync(MAPPINGS_PATH, "utf8")
    : null;

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
  if (originalMappings === null) {
    fs.rmSync(MAPPINGS_PATH, { force: true });
  } else {
    fs.writeFileSync(MAPPINGS_PATH, originalMappings);
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
