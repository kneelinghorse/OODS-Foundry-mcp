import { useCallback, useEffect, useMemo, useState } from "react";
import {
  healthCheck,
  runMapApply,
  runPipeline,
  runTool,
  type BridgeResponse,
  type MapApplyResult,
  type PipelineResult,
} from "./bridge-client";
import { useDebounce } from "./hooks";
import { IntentInput } from "./components/IntentInput";
import { Selectors } from "./components/Selectors";
import { PreviewPanel } from "./components/PreviewPanel";
import { CodePanel } from "./components/CodePanel";
import { StatusBar } from "./components/StatusBar";
import { StarterPrompts } from "./components/StarterPrompts";
import {
  Stage1DemoPanel,
  type Stage1FixtureMeta,
} from "./components/Stage1DemoPanel";

type Framework = "react" | "vue" | "html";
type Styling = "inline" | "tokens" | "tailwind";
type Brand = "default" | "A" | "B";
type ViewMode = "compose" | "stage1";

const STAGE1_FIXTURES: Record<Stage1FixtureMeta["id"], Stage1FixtureMeta> = {
  linear: {
    id: "linear",
    label: "Linear (v1.1.0)",
    schemaVersion: "v1.1.0",
    reportPath:
      "../Stage1/out/stage1/linear-reconciliation-s43-validation/82201fef-efed-4bcf-8b39-192a09555745/artifacts/reconciliation_report.json",
    targetUrl: "https://linear.app/",
    targetId: "82201fef-efed-4bcf-8b39-192a09555745",
    candidateObjects: 93,
    candidateActions: 9,
    verdictCounts: {
      create: 93,
      patch: 0,
      skip: 0,
      conflict: 0,
    },
    lowConfidenceConflictAnnotations: 4,
  },
  stripe: {
    id: "stripe",
    label: "Stripe (v1.1.0)",
    schemaVersion: "v1.1.0",
    reportPath:
      "../Stage1/out/stage1/stripe-reconciliation-s43-validation/da66f1d2-0d23-43c1-ba29-5c0ec7be631e/artifacts/reconciliation_report.json",
    targetUrl: "https://stripe.com/",
    targetId: "da66f1d2-0d23-43c1-ba29-5c0ec7be631e",
    candidateObjects: 195,
    candidateActions: 33,
    verdictCounts: {
      create: 195,
      patch: 0,
      skip: 0,
      conflict: 0,
    },
    lowConfidenceConflictAnnotations: 11,
  },
  "linear-v15": {
    id: "linear-v15",
    label: "Linear (v1.5.0)",
    schemaVersion: "v1.5.0",
    reportPath:
      "../Stage1/out/sprint-45-live-rerun/stage1/linear-app-s45-m06-rerun/dc1cfabb-f07a-47dc-8a23-ba160e5b45b9/artifacts/reconciliation_report.json",
    targetUrl: "https://linear.app/",
    targetId: "dc1cfabb-f07a-47dc-8a23-ba160e5b45b9",
    candidateObjects: 73,
    candidateActions: 0,
    verdictCounts: {
      create: 73,
      patch: 0,
      skip: 0,
      conflict: 0,
    },
    lowConfidenceConflictAnnotations: 5,
    bridgeMappingStats: {
      total: 73,
      variantBearing: 73,
      multiVariant: 2,
    },
    bridgeMappingSamples: [
      {
        externalSystem: "stage1-orca/general",
        externalComponent: "Header Button Item Crtcc",
        oodsTraits: ["actionable", "color", "interactive", "typography"],
        confidence: 0.95,
        projection_variants: [
          {
            id: "header-button-item-crtcc-desktop",
            surface: "desktop",
            selector: "cluster:cluster-41",
            confidence: 0.95,
            evidence_chain: [
              {
                artifact_ref: "component_clusters.json",
                json_pointer: "/clusters/35",
                source_surface: "dom",
                observation_type: "component_cluster",
              },
            ],
            metadata: {
              source_surface: "dom",
              candidate_type: "component_cluster",
            },
          },
          {
            id: "header-button-item-crtcc-mobile",
            surface: "mobile",
            selector: "cluster-41",
            confidence: 0.95,
            evidence_chain: [
              {
                artifact_ref: "orca_candidates.json",
                json_pointer: "/objects/33",
                source_surface: "dom",
                observation_type: "orca_object",
              },
            ],
            metadata: {
              source_surface: "dom",
              candidate_type: "orca_object",
            },
          },
        ],
      },
      {
        externalSystem: "stage1-orca/general",
        externalComponent: "Hero New Feature Link Pht6b",
        oodsTraits: [
          "border",
          "color",
          "interactive",
          "spacing",
          "typography",
          "visual",
        ],
        confidence: 0.85,
        projection_variants: [
          {
            id: "hero-new-feature-link-pht6b-desktop",
            surface: "desktop",
            selector: "cluster:cluster-10",
            confidence: 0.95,
            evidence_chain: [
              {
                artifact_ref: "component_clusters.json",
                json_pointer: "/clusters/7",
                source_surface: "dom",
                observation_type: "component_cluster",
              },
            ],
            metadata: {
              source_surface: "dom",
              candidate_type: "component_cluster",
            },
          },
          {
            id: "hero-new-feature-link-pht6b-mobile",
            surface: "mobile",
            selector: "cluster-10",
            confidence: 0.95,
            evidence_chain: [
              {
                artifact_ref: "orca_candidates.json",
                json_pointer: "/objects/7",
                source_surface: "dom",
                observation_type: "orca_object",
              },
            ],
            metadata: {
              source_surface: "dom",
              candidate_type: "orca_object",
            },
          },
        ],
      },
      {
        externalSystem: "stage1-orca/general",
        externalComponent: "Agent List Card Euuz1",
        oodsTraits: ["border", "color", "composable", "spacing", "visual"],
        confidence: 0.95,
        projection_variants: [
          {
            id: "agent-list-card-euuz1-desktop",
            surface: "desktop",
            selector: "cluster-67",
            confidence: 0.95,
            evidence_chain: [
              {
                artifact_ref: "orca_candidates.json",
                json_pointer: "/objects/26",
                source_surface: "dom",
                observation_type: "orca_object",
              },
              {
                artifact_ref: "component_clusters.json",
                json_pointer: "/clusters/27",
                source_surface: "dom",
                observation_type: "component_cluster",
              },
            ],
            metadata: {
              source_surface: "dom",
              candidate_type: "component_cluster",
            },
          },
        ],
      },
    ],
  },
  "stripe-v15": {
    id: "stripe-v15",
    label: "Stripe (v1.5.0)",
    schemaVersion: "v1.5.0",
    reportPath:
      "../Stage1/out/sprint-45-live-rerun/stage1/stripe-com-s45-m06-rerun/07776e70-ec86-449a-b570-3978161793ac/artifacts/reconciliation_report.json",
    targetUrl: "https://stripe.com/",
    targetId: "07776e70-ec86-449a-b570-3978161793ac",
    candidateObjects: 129,
    candidateActions: 0,
    verdictCounts: {
      create: 129,
      patch: 0,
      skip: 0,
      conflict: 0,
    },
    lowConfidenceConflictAnnotations: 9,
    bridgeMappingStats: {
      total: 129,
      variantBearing: 128,
      multiVariant: 0,
    },
    bridgeMappingSamples: [
      {
        externalSystem: "stage1-orca/general",
        externalComponent: "AnnualUpdatSvgPrimitive1",
        oodsTraits: ["border", "color", "spacing", "typography", "visual"],
        confidence: 0.8,
        projection_variants: [
          {
            id: "annualupdatsvgprimitive-desktop",
            surface: "desktop",
            external_component: "G",
            selector: "cluster-11",
            confidence: 0.95,
            evidence_chain: [
              {
                artifact_ref: "orca_candidates.json",
                json_pointer: "/objects/13",
                source_surface: "dom",
                observation_type: "orca_object",
              },
              {
                artifact_ref: "component_clusters.json",
                json_pointer: "/clusters/14",
                source_surface: "dom",
                observation_type: "component_cluster",
              },
            ],
            metadata: {
              source_surface: "dom",
              candidate_type: "component_cluster",
            },
          },
        ],
      },
    ],
  },
};

const SYNTHETIC_PATCH_FIXTURE_PATH =
  "packages/mcp-server/test/fixtures/reconciliation-report-v1.1.0.json";

function getInitialView(): ViewMode {
  return window.location.hash === "#stage1" ? "stage1" : "compose";
}

function setViewHash(next: ViewMode): void {
  if (next === "stage1") {
    window.location.hash = "stage1";
    return;
  }
  window.history.replaceState(
    null,
    "",
    `${window.location.pathname}${window.location.search}`,
  );
}

function buildStage1CodeSnippet(
  fixture: Stage1FixtureMeta,
  framework: Framework,
  styling: Styling,
): string {
  const header = `// Stage1 reconciliation consumer (${fixture.label})\n// Dry-run via the playground bridge, then hand off to code.generate (${framework}, ${styling}).\n`;

  if (framework === "vue") {
    return `${header}
<script setup lang="ts">
import { onMounted, ref } from 'vue';

type MapApplyResult = {
  applied: Array<{ name: string }>;
  queued: Array<{ name: string; confidence: number }>;
  conflicted: Array<{ name: string }>;
};

const routing = ref<MapApplyResult | null>(null);

onMounted(async () => {
  const response = await fetch('/api/run', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      tool: 'map_apply',
      input: {
        reportPath: '${fixture.reportPath}',
        minConfidence: 0.75,
      },
    }),
  });

  const payload = await response.json();
  routing.value = payload.result;

  // Example downstream hand-off:
  // await client.callTool('code_generate', {
  //   schemaRef,
  //   framework: '${framework}',
  //   options: { styling: '${styling}', typescript: true },
  // });
});
</script>

<template>
  <section v-if="routing">
    <h2>${fixture.label} reconciliation</h2>
    <p>{{ routing.applied.length }} applied / {{ routing.queued.length }} queued</p>
  </section>
</template>
`;
  }

  if (framework === "html") {
    return `${header}
<script type="module">
  async function boot() {
    const response = await fetch('/api/run', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        tool: 'map_apply',
        input: {
          reportPath: '${fixture.reportPath}',
          minConfidence: 0.75,
        },
      }),
    });

    const payload = await response.json();
    const summary = document.querySelector('[data-stage1-summary]');
    if (!summary) return;
    summary.textContent = \`\${payload.result.applied.length} applied / \${payload.result.queued.length} queued\`;
  }

  boot();

  // Example downstream hand-off:
  // code_generate({ schemaRef, framework: '${framework}', options: { styling: '${styling}' } })
</script>

<section class="stage1-reconciliation">
  <h2>${fixture.label} reconciliation</h2>
  <p data-stage1-summary>Loading…</p>
</section>
`;
  }

  return `${header}
import { useEffect, useState } from 'react';

type MapApplyResult = {
  applied: Array<{ name: string }>;
  queued: Array<{ name: string; confidence: number }>;
  conflicted: Array<{ name: string }>;
};

export function Stage1ReconciliationConsumer() {
  const [routing, setRouting] = useState<MapApplyResult | null>(null);

  useEffect(() => {
    fetch('/api/run', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        tool: 'map_apply',
        input: {
          reportPath: '${fixture.reportPath}',
          minConfidence: 0.75,
        },
      }),
    })
      .then((response) => response.json())
      .then((payload) => setRouting(payload.result));
  }, []);

  // Example downstream hand-off:
  // await client.callTool('code_generate', {
  //   schemaRef,
  //   framework: '${framework}',
  //   options: { styling: '${styling}', typescript: true },
  // });

  if (!routing) return <div>Loading reconciliation preview…</div>;

  return (
    <section>
      <h2>${fixture.label} reconciliation</h2>
      <p>{routing.applied.length} applied / {routing.queued.length} queued</p>
    </section>
  );
}
`;
}

function resolveToolResult<T>(response: BridgeResponse<T>): T {
  if ("error" in response && response.error) {
    throw new Error(response.error.message);
  }
  if ("ok" in response && response.ok && response.result) {
    return response.result;
  }
  throw new Error("Bridge returned an unexpected response shape.");
}

export default function App() {
  const [view, setView] = useState<ViewMode>(getInitialView);
  const [intent, setIntent] = useState("");
  const [framework, setFramework] = useState<Framework>("react");
  const [styling, setStyling] = useState<Styling>("tokens");
  const [brand, setBrand] = useState<Brand>("default");
  const [theme, setTheme] = useState<"light" | "dark">("light");
  const [stage1FixtureId, setStage1FixtureId] =
    useState<Stage1FixtureMeta["id"]>("linear");

  const [composeLoading, setComposeLoading] = useState(false);
  const [composeResult, setComposeResult] = useState<PipelineResult | null>(
    null,
  );
  const [composeError, setComposeError] = useState<string | null>(null);

  const [stage1Loading, setStage1Loading] = useState(false);
  const [stage1Result, setStage1Result] = useState<MapApplyResult | null>(null);
  const [syntheticPatchResult, setSyntheticPatchResult] =
    useState<MapApplyResult | null>(null);
  const [stage1Error, setStage1Error] = useState<string | null>(null);

  const [bridgeOk, setBridgeOk] = useState<boolean | null>(null);

  const debouncedIntent = useDebounce(intent, 400);
  const activeFixture = STAGE1_FIXTURES[stage1FixtureId];

  useEffect(() => {
    healthCheck().then((health) => setBridgeOk(health.ok));
  }, []);

  useEffect(() => {
    const onHashChange = () => setView(getInitialView());
    window.addEventListener("hashchange", onHashChange);
    return () => window.removeEventListener("hashchange", onHashChange);
  }, []);

  const handleViewChange = useCallback((next: ViewMode) => {
    setViewHash(next);
    setView(next);
  }, []);

  const runComposePipeline = useCallback(async () => {
    if (view !== "compose" || !debouncedIntent.trim()) return;
    setComposeLoading(true);
    setComposeError(null);

    const response: BridgeResponse<PipelineResult> = await runPipeline({
      intent: debouncedIntent,
      framework,
      styling,
      options: {
        compact: false,
        showConfidence: true,
        confidenceThreshold: 0.5,
      },
    });

    setComposeLoading(false);

    if ("error" in response && response.error) {
      setComposeError(response.error.message);
      setComposeResult(null);
      return;
    }

    if ("ok" in response && response.ok && response.result) {
      if (response.result.error) {
        setComposeError(
          `[${response.result.error.step}] ${response.result.error.message}`,
        );
      }
      setComposeResult(response.result);
    }
  }, [debouncedIntent, framework, styling, view]);

  useEffect(() => {
    if (view === "compose" && debouncedIntent.trim()) {
      runComposePipeline();
    }
  }, [debouncedIntent, runComposePipeline, view]);

  const loadStage1Demo = useCallback(async () => {
    if (view !== "stage1") return;
    setStage1Loading(true);
    setStage1Error(null);

    try {
      const [realFixture, syntheticFixture] = await Promise.all([
        runMapApply(activeFixture.reportPath, 0.75),
        runMapApply(SYNTHETIC_PATCH_FIXTURE_PATH, 0.75),
      ]);

      setStage1Result(resolveToolResult(realFixture));
      setSyntheticPatchResult(resolveToolResult(syntheticFixture));
    } catch (error) {
      const message =
        error instanceof Error
          ? error.message
          : "Failed to load Stage1 playground data.";
      setStage1Error(message);
      setStage1Result(null);
    } finally {
      setStage1Loading(false);
    }
  }, [activeFixture.reportPath, view]);

  useEffect(() => {
    if (view === "stage1") {
      loadStage1Demo();
    }
  }, [loadStage1Demo, view]);

  const handleStarterSelect = useCallback(
    (starterIntent: string) => {
      setIntent(starterIntent);
      handleViewChange("compose");
    },
    [handleViewChange],
  );

  const handleSaveSchema = useCallback(async () => {
    if (!composeResult?.schemaRef) return;
    const name = `playground-${Date.now()}`;
    const response = await runTool("schema_save", {
      name,
      schemaRef: composeResult.schemaRef,
    });
    if ("ok" in response && response.ok) {
      setComposeError(null);
    } else if ("error" in response && response.error) {
      setComposeError(response.error.message);
    }
  }, [composeResult?.schemaRef]);

  const handleDownloadHtml = useCallback(() => {
    const html = composeResult?.render?.html;
    if (!html) return;
    const blob = new Blob([html], { type: "text/html" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = "oods-preview.html";
    link.click();
    URL.revokeObjectURL(url);
  }, [composeResult?.render?.html]);

  const stage1CodeSnippet = useMemo(
    () => buildStage1CodeSnippet(activeFixture, framework, styling),
    [activeFixture, framework, styling],
  );

  const activeLoading = view === "compose" ? composeLoading : stage1Loading;
  const activeError = view === "compose" ? composeError : stage1Error;
  const activeSummary =
    view === "compose"
      ? (composeResult?.summary ?? null)
      : stage1Result
        ? `${activeFixture.label}: ${stage1Result.applied.length} applied, ${stage1Result.queued.length} queued at minConfidence 0.75`
        : "Load a live reconciliation fixture through map_apply dry-run.";

  return (
    <div className="flex h-screen flex-col bg-[#0f1117] text-gray-200">
      <header className="flex shrink-0 items-center justify-between gap-4 border-b border-gray-800 px-5 py-3">
        <div className="flex flex-wrap items-center gap-3">
          <h1 className="text-lg font-semibold tracking-tight text-white">
            OODS Playground
          </h1>
          <div className="flex overflow-hidden rounded-full border border-gray-700 bg-gray-950">
            <button
              onClick={() => handleViewChange("compose")}
              className={`px-3 py-1.5 text-xs font-medium transition-colors ${
                view === "compose"
                  ? "bg-indigo-600 text-white"
                  : "text-gray-400 hover:bg-gray-900 hover:text-gray-100"
              }`}
            >
              Compose
            </button>
            <button
              onClick={() => handleViewChange("stage1")}
              className={`px-3 py-1.5 text-xs font-medium transition-colors ${
                view === "stage1"
                  ? "bg-cyan-500 text-slate-950"
                  : "text-gray-400 hover:bg-gray-900 hover:text-gray-100"
              }`}
            >
              Stage1
            </button>
          </div>
          <span className="font-mono text-xs text-gray-500">
            {view === "stage1" ? "#stage1" : "v0.1"}
          </span>
        </div>

        <div className="flex flex-wrap items-center gap-3">
          {view === "compose" && composeResult?.render?.html ? (
            <button
              onClick={handleDownloadHtml}
              className="rounded border border-gray-700 px-2.5 py-1 text-xs text-gray-400 transition-colors hover:border-gray-500 hover:text-white"
            >
              Download HTML
            </button>
          ) : null}
          {view === "compose" && composeResult?.schemaRef ? (
            <button
              onClick={handleSaveSchema}
              className="rounded border border-indigo-600 px-2.5 py-1 text-xs text-indigo-300 transition-colors hover:bg-indigo-600/20"
            >
              Save Schema
            </button>
          ) : null}
          <Selectors
            framework={framework}
            styling={styling}
            brand={brand}
            theme={theme}
            onFrameworkChange={setFramework}
            onStylingChange={setStyling}
            onBrandChange={setBrand}
            onThemeChange={setTheme}
            showBrandTheme={view === "compose"}
          />
        </div>
      </header>

      {view === "compose" ? (
        <>
          <div className="shrink-0 space-y-2 border-b border-gray-800 px-5 py-3">
            <IntentInput
              value={intent}
              onChange={setIntent}
              loading={composeLoading}
            />
            <StarterPrompts onSelect={handleStarterSelect} />
          </div>

          <div className="flex min-h-0 flex-1">
            <PreviewPanel
              html={composeResult?.render?.html ?? null}
              theme={theme}
              loading={composeLoading}
            />
            <CodePanel
              code={composeResult?.code?.output ?? null}
              framework={composeResult?.code?.framework ?? framework}
              loading={composeLoading}
            />
          </div>
        </>
      ) : (
        <div className="flex min-h-0 flex-1">
          <Stage1DemoPanel
            fixture={activeFixture}
            fixtures={Object.values(STAGE1_FIXTURES)}
            onFixtureChange={setStage1FixtureId}
            result={stage1Result}
            syntheticPatchResult={syntheticPatchResult}
            loading={stage1Loading}
          />
          <CodePanel
            code={stage1CodeSnippet}
            framework={framework}
            loading={false}
          />
        </div>
      )}

      <StatusBar
        bridgeOk={bridgeOk}
        loading={activeLoading}
        error={activeError}
        metrics={view === "compose" ? (composeResult?.metrics ?? null) : null}
        pipeline={view === "compose" ? (composeResult?.pipeline ?? null) : null}
        summary={activeSummary}
      />
    </div>
  );
}
