/**
 * HTTP client for the OODS MCP Bridge.
 *
 * Proxied via Vite dev server: /api/* → http://127.0.0.1:4466/*
 */

const BASE = "/api";

export type BridgeResponse<T = unknown> =
  | {
      ok: true;
      tool: string;
      mode: string;
      result: T;
      preview?: unknown;
    }
  | {
      ok?: false;
      error: { code: string; message: string };
    };

export type PipelineInput = {
  object?: string;
  intent?: string;
  context?: string;
  layout?: string;
  framework?: "react" | "vue" | "html";
  styling?: "inline" | "tokens" | "tailwind";
  save?: string;
  options?: {
    compact?: boolean;
    showConfidence?: boolean;
    confidenceThreshold?: number;
  };
};

export type PipelineResult = {
  schemaRef?: string;
  compose: {
    object?: string;
    context?: string;
    layout: string;
    componentCount: number;
  };
  validation?: {
    status: string;
    errors: Array<{ code: string; message: string }>;
    warnings: Array<{ code: string; message: string }>;
  };
  render?: {
    html?: string;
    tokenCssRef?: string;
    meta: Record<string, unknown>;
  };
  code?: {
    framework: string;
    styling: string;
    output: string;
  };
  summary?: string;
  metrics?: {
    totalNodes: number;
    componentsUsed: number;
    fieldsBound: number;
    fieldsOmitted?: Array<{ field: string; reason: string }>;
    responseBytes: number;
  };
  pipeline: {
    steps: string[];
    stepLatency?: Record<string, number>;
    duration: number;
  };
  error?: {
    step: string;
    code: string;
    message: string;
  };
};

export type MapApplyDiff = {
  create: number;
  patch: number;
  skip: number;
  conflict: number;
  queued: number;
  changedFields: string[];
  addedTraits: string[];
  removedTraits: string[];
};

export type MapApplyRoute = {
  objectId: string;
  name: string;
  action: "create" | "patch" | "skip";
  confidence: number;
  recommendedOodsTraits: string[];
  existingMapId?: string;
  mappingId?: string;
  reason: string;
  persisted: boolean;
  diff?: {
    added_traits: string[];
    removed_traits: string[];
    changed_fields: Array<{
      field: string;
      from?: unknown;
      to?: unknown;
    }>;
  };
};

export type MapApplyQueued = {
  objectId: string;
  name: string;
  action: "create" | "patch" | "skip" | "conflict";
  confidence: number;
  threshold: number;
  queueReason: "below_confidence";
  recommendedOodsTraits: string[];
  existingMapId?: string;
  reason: string;
  diff?: MapApplyRoute["diff"];
};

export type MapApplyConflict = {
  objectId: string;
  name: string;
  action: "conflict";
  confidence: number;
  existingMapId?: string;
  reason: string;
};

export type MapApplyResult = {
  applied: MapApplyRoute[];
  skipped: MapApplyRoute[];
  queued: MapApplyQueued[];
  conflicted: MapApplyConflict[];
  errors: Array<{
    objectId?: string;
    name?: string;
    action?: string;
    message: string;
  }>;
  diff: MapApplyDiff;
  conflictArtifactPath?: string;
  etag: string;
};

export async function runTool<T = unknown>(
  tool: string,
  input: Record<string, unknown>,
): Promise<BridgeResponse<T>> {
  const res = await fetch(`${BASE}/run`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ tool, input }),
  });
  return res.json() as Promise<BridgeResponse<T>>;
}

export async function runPipeline(
  input: PipelineInput,
): Promise<BridgeResponse<PipelineResult>> {
  return runTool<PipelineResult>("pipeline", input as Record<string, unknown>);
}

export async function runMapApply(
  reportPath: string,
  minConfidence = 0.75,
): Promise<BridgeResponse<MapApplyResult>> {
  return runTool<MapApplyResult>("map_apply", {
    reportPath,
    minConfidence,
  });
}

export async function healthCheck(): Promise<{ ok: boolean }> {
  try {
    const res = await fetch(`${BASE}/health`);
    const data = await res.json();
    return { ok: Boolean(data?.status === "ok" || data?.ok) };
  } catch {
    return { ok: false };
  }
}
