import type {
  Stage1CapabilityEntity as GeneratedStage1CapabilityEntity,
  Stage1DisambiguationDecision as GeneratedStage1DisambiguationDecision,
  Stage1PreferredTermEntity as GeneratedStage1PreferredTermEntity,
  Stage1ProjectionVariant as GeneratedStage1ProjectionVariant,
} from "../schemas/generated.js";

export type BaseInput = { apply?: boolean };

export type TokensBuildInput = BaseInput & {
  brand?: "A";
  theme?: "light" | "dark" | "hc";
};

export type PlanDiffChange = {
  type: "context" | "add" | "remove";
  value: string;
};

export type PlanDiffHunk = {
  header: string;
  changes: PlanDiffChange[];
};

export type PlanDiffSummary = {
  additions?: number;
  deletions?: number;
};

export type PlanDiff = {
  path: string;
  status: "added" | "modified" | "deleted";
  summary?: PlanDiffSummary;
  hunks: PlanDiffHunk[];
  structured?:
    | {
        type: "json";
        before?: unknown;
        after?: unknown;
      }
    | undefined;
};

export type ArtifactDetail = {
  path: string;
  name: string;
  purpose?: string | null;
  sha256?: string | null;
  sizeBytes?: number | null;
};

export type ToolPreview = {
  summary?: string | null;
  notes?: string[];
  diffs?: PlanDiff[];
  specimens?: string[];
};

export type PreviewVerbosity = "full" | "compact";

export type GenericOutput = {
  artifacts: string[];
  diagnosticsPath?: string;
  transcriptPath: string;
  bundleIndexPath: string;
  preview?: ToolPreview;
  artifactsDetail?: ArtifactDetail[];
};

export type BrandApplyStrategy = "alias" | "patch";

export type BrandApplyInput = BaseInput & {
  brand?: "A";
  delta: Record<string, unknown> | Record<string, unknown>[];
  strategy?: BrandApplyStrategy;
  /** Scope modifications to specific theme files. Defaults to all themes. */
  themes?: Array<"base" | "dark" | "hc">;
  preview?: {
    verbosity?: PreviewVerbosity;
  };
};

export type BillingProvider = "stripe" | "chargebee";

export type BillingReviewKitInput = BaseInput & {
  object: "Subscription" | "Invoice" | "Plan" | "Usage";
  fixtures?: BillingProvider[];
};

export type BillingSwitchFixturesInput = BaseInput & {
  provider: BillingProvider;
};

export type ReleaseVerifyInput = BaseInput & {
  packages?: string[];
  fromTag?: string;
};

export type ReleaseVerifyResult = GenericOutput & {
  results: Array<{
    name: string;
    version: string;
    identical: boolean;
    sha256: string;
    sizeBytes: number;
    warnings?: string[];
    files?: string[];
  }>;
  changelogPath: string;
  summary: string;
  warnings?: string[];
};

export type ReleaseTagInput = BaseInput & {
  tag: string;
  message?: string | null;
};

export type ReleaseTagResult = GenericOutput & {
  tag: string;
  created: boolean;
  warnings?: string[];
};

export type StructuredDataset = "components" | "tokens" | "manifest";

/** Stage1 v1.5.0 rollup artifact kinds consumable via structuredData.fetch. */
export type Stage1RollupKind = "identity_graph" | "capability_rollup" | "object_rollup";

export type StructuredDataFetchInput = {
  dataset?: StructuredDataset;
  kind?: Stage1RollupKind;
  runPath?: string;
  ifNoneMatch?: string;
  includePayload?: boolean;
  version?: string;
  listVersions?: boolean;
};

export type StructuredDataFetchOutput = {
  dataset?: StructuredDataset;
  kind?: Stage1RollupKind;
  schemaVersion?: string;
  runId?: string;
  version?: string | null;
  generatedAt?: string | null;
  etag: string;
  matched: boolean;
  payloadIncluded: boolean;
  path: string;
  manifestPath?: string | null;
  sizeBytes: number;
  schemaValidated: boolean;
  validationErrors?: string[];
  warnings?: string[];
  meta?: Record<string, unknown>;
  payload?: Record<string, unknown>;
  availableVersions?: string[];
  requestedVersion?: string | null;
  resolvedVersion?: string | null;
};

/* Stage1 rollup shapes — accepted schema_versions (post v1.6.0):
 *   identity_graph: 1.1.0 | 1.2.0
 *   capability_rollup: 1.1.0 | 1.2.0
 *   object_rollup: 1.0.0 | 1.1.0
 * See ROLLUP_ALLOWED_SCHEMA_VERSIONS in structuredData.fetch.ts.
 */

export type Stage1EvidenceRef = {
  artifact_ref: string;
  json_pointer: string;
  run_id?: string;
  source_surface?: string;
  observation_type?: string;
};

/**
 * Stage1 v1.6.0 unified confidence surfaces (contract §2d).
 * Identical shape across identity_graph (candidate_mappings[]),
 * capability_rollup (presentations[]), object_rollup (projection_variants[]),
 * and reconciliation_report (candidate_objects[].decomposition).
 */
export type Stage1ConfidenceMethodId = 'weighted_blend_v1' | 'threshold_gate_v1' | string;

export type Stage1ConfidenceSignal = {
  type: string;
  raw_score: number;
  weight: number;
  weighted_contribution: number;
  evidence_ref: Stage1EvidenceRef;
  hint?: string;
};

export type Stage1ConfidenceDecomposition = {
  total: number;
  method: Stage1ConfidenceMethodId;
  signals: Stage1ConfidenceSignal[];
};

export type Stage1ConfidenceSummary = {
  total: number;
  method: Stage1ConfidenceMethodId;
  evidence_ref: Stage1EvidenceRef;
  top_signal_types?: string[];
};

export type Stage1CandidateMapping = {
  target: string;
  /** v1.1.0 scalar; v1.2.0 full decomposition. Use unwrap helpers in the normalizer. */
  confidence: number | Stage1ConfidenceDecomposition;
  /** Legacy v1.1.0 surface; removed in v1.2.0 (hints moved into confidence.signals[].hint). */
  hints?: Array<{ heuristic: string; contribution: number; detail?: string }>;
};

export type Stage1MemberCandidate = {
  surface_id: string;
  source_surface?: string;
  label?: string;
  aliases?: string[];
  attributes?: Record<string, unknown>;
  evidence_refs?: Stage1EvidenceRef[];
};

export type Stage1IdentityGraphNode = {
  canonical_id: string;
  canonical_label?: string;
  identity_class: string;
  candidate_mappings?: Stage1CandidateMapping[];
  review_status?: string;
  member_candidates?: Stage1MemberCandidate[];
};

export type Stage1IdentityGraph = {
  kind: "identity_graph";
  schema_version: string;
  generated_at: string;
  run_id: string;
  target: { id: string; url?: string };
  nodes: Stage1IdentityGraphNode[];
};

export type Stage1CapabilityPresentation = {
  surface: string;
  label?: string;
  /** v1.2.0 adds a ConfidenceDecomposition per presentation. */
  confidence?: Stage1ConfidenceDecomposition;
  preconditions?: unknown[];
  role_hints?: string[];
  state_hints?: string[];
  member_instances?: Stage1EvidenceRef[];
};

export type Stage1Capability = {
  canonical_id: string;
  display_label?: string;
  presentations: Stage1CapabilityPresentation[];
  minimum_preconditions?: unknown[];
  lifecycle_hints?: unknown[];
  conflicts?: unknown[];
  resolution_strategy?: string;
  derived_from_runs?: string[];
};

export type Stage1CapabilityRollup = {
  kind: "capability_rollup";
  schema_version: string;
  generated_at: string;
  run_id: string;
  target: { id: string; url?: string };
  capabilities: Stage1Capability[];
};

export type Stage1RollupProjectionVariant = {
  id: string;
  surface: string;
  /** v1.0.0 scalar; v1.1.0 full decomposition. Use unwrap helpers in the normalizer. */
  confidence?: number | Stage1ConfidenceDecomposition;
  /** v1.1.0 summary backref to object_rollup.json; preserved on normalized variants. */
  confidence_summary?: Stage1ConfidenceSummary;
  evidence_chain?: Stage1EvidenceRef[];
  metadata?: Record<string, unknown>;
  selector?: string;
  external_component?: string;
  capability_id?: string;
};

export type Stage1RollupObject = {
  canonical_id: string;
  canonical_label?: string;
  representative_object_id?: string;
  source_object_ids?: string[];
  external_component?: string;
  oods_traits?: string[];
  projection_variants?: Stage1RollupProjectionVariant[];
  conflicts?: unknown[];
  reconciliation?: { action?: string; [key: string]: unknown };
};

export type Stage1ObjectRollup = {
  kind: "object_rollup";
  schema_version: string;
  generated_at: string;
  run_id: string;
  target: { id: string; url?: string };
  objects: Stage1RollupObject[];
};

export type CatalogListDetail = "summary" | "full";

export type CatalogListInput = {
  category?: string;
  trait?: string;
  context?: string;
  /**
   * Filter by component status: 'stable', 'beta', or 'planned'.
   */
  status?: ComponentStatus;
  /**
   * Response detail level. Defaults to summary for unfiltered calls,
   * full when filters are provided.
   */
  detail?: CatalogListDetail;
  /**
   * 1-based page index for pagination.
   */
  page?: number;
  /**
   * Number of components per page.
   */
  pageSize?: number;
};

export type ComponentCodeReference = {
  kind: "storybook" | "code-connect";
  /**
   * Repo-relative path (POSIX) to a source file containing a usage example.
   */
  path: string;
  /**
   * Storybook title (or equivalent label) when available (e.g., `Traits/Core/Taggable`).
   */
  title?: string;
  /**
   * Concise usage snippet extracted from the story file.
   */
  snippet: string;
};

export type ComponentStatus = "stable" | "beta" | "planned";

export type ComponentCatalogSummary = {
  name: string;
  displayName: string;
  categories: string[];
  tags: string[];
  contexts: string[];
  regions: string[];
  traits: string[];
  status: ComponentStatus;
  maturity?: string;
  deprecated_since?: string;
};

export type ComponentCatalogEntry = ComponentCatalogSummary & {
  propSchema: Record<string, unknown>;
  slots: Record<string, { accept?: string[]; role?: string }>;
  /**
   * References into `.stories.tsx` files that show real usage patterns.
   */
  codeReferences?: ComponentCodeReference[];
  /**
   * Convenience: best single snippet picked from `codeReferences`.
   */
  codeSnippet?: string;
};

export type CatalogListOutput = {
  components: Array<ComponentCatalogSummary | ComponentCatalogEntry>;
  totalCount: number;
  returnedCount: number;
  page: number;
  pageSize: number;
  hasMore: boolean;
  detail: CatalogListDetail;
  generatedAt: string;
  stats: {
    componentCount: number;
    traitCount: number;
    filteredCount?: number;
  };
  availableCategories: string[];
  suggestions?: {
    traits?: string[];
  };
};

export type CodegenFramework = "react" | "vue" | "html";

export type CodegenStyling = "inline" | "tokens" | "tailwind";

export type CodeGenerateInput = {
  schema?: import("../schemas/generated.js").UiSchema;
  schemaRef?: string;
  framework: CodegenFramework;
  options?: {
    typescript?: boolean;
    styling?: CodegenStyling;
  };
};

export type CodegenIssue = {
  code: string;
  message: string;
  nodeId?: string;
  component?: string;
};

export type CodeGenerateOutput = {
  status: "ok" | "error";
  framework: CodegenFramework;
  code: string;
  fileExtension: string;
  imports: string[];
  warnings: CodegenIssue[];
  errors?: CodegenIssue[];
  meta?: {
    nodeCount?: number;
    componentCount?: number;
    unknownComponents?: string[];
  };
};

// -- Mapping tools --

export type MapCreateInput = {
  apply?: boolean;
  externalSystem: string;
  externalComponent: string;
  oodsTraits: string[];
  propMappings?: Array<{
    externalProp: string;
    oodsProp: string;
    coercion?:
      | (
          | { type: "enum"; mapping: Record<string, string> }
          | { type: "boolean_to_string"; trueValue: string; falseValue: string }
          | { type: "template"; pattern: string }
          | { type: "identity" }
        )
      | null;
  }>;
  confidence?: "auto" | "manual";
  metadata?: {
    author?: string;
    notes?: string;
  };
  projection_variants?: Stage1ProjectionVariant[];
};

export type MapCreateErrorDetail = {
  field: string;
  message: string;
  keyword: string;
};

export type MapCreateError = {
  message: string;
  details: MapCreateErrorDetail[];
};

export type MapCreateOutput = {
  status: "ok" | "error";
  mapping: Record<string, unknown>;
  etag: string;
  applied?: boolean;
  warnings?: string[];
  errors?: MapCreateError;
};

export type MapApplyAction = "create" | "patch" | "skip" | "conflict";

export type Stage1AlternateInterpretation =
  | string
  | {
      role: string;
      score: number;
      reasoning: string;
    };

export type Stage1AlternateVerb =
  | string
  | {
      verb_id: string;
      score: number;
      reasoning: string;
    };

export type Stage1ActionPrecondition = {
  type: "auth" | "role" | "state" | "data";
  description?: string;
  confidence?: number;
  evidence_chain?: Record<string, unknown>[];
};

export type Stage1DisambiguationDecision =
  GeneratedStage1DisambiguationDecision;
export type Stage1PreferredTermEntity = GeneratedStage1PreferredTermEntity;
export type Stage1CapabilityEntity = GeneratedStage1CapabilityEntity;
export type Stage1ProjectionVariant = GeneratedStage1ProjectionVariant;

export type Stage1CandidateDiff = {
  added_traits: string[];
  removed_traits: string[];
  changed_fields: Array<{
    field: string;
    from?: unknown;
    to?: unknown;
  }>;
};

export type Stage1CandidateObject = {
  object_id: string;
  name: string;
  role: string;
  inferred_role?: string;
  inferred_role_score?: number;
  confidence: number;
  recommended_oods_traits: string[];
  recommended_domain?: string;
  action: MapApplyAction;
  reasoning: string;
  verdict_reasoning?: string;
  existing_map_id?: string;
  external_component?: string;
  diff?: Stage1CandidateDiff;
  alternate_interpretations?: Stage1AlternateInterpretation[];
  evidence_chain?: Record<string, unknown>[];
  projection_variants?: Stage1ProjectionVariant[];
};

export type Stage1CandidateAction = {
  action_id: string;
  name: string;
  verb: string;
  source_object_id?: string;
  confidence?: number;
  suggested_oods_trait?: string;
  suggested_action?: string;
  reasoning?: string;
  alternate_verbs?: Stage1AlternateVerb[];
  preconditions?: Stage1ActionPrecondition[];
};

export type Stage1Conflict = {
  type: string;
  severity: "info" | "warning" | "error";
  description: string;
  action_id?: string;
  object_id?: string;
  existing_map_id?: string;
};

export type Stage1RegistryFetchTelemetry = {
  source: "pre-supplied" | "transport" | "empty-fallback";
  entries_count: number;
  warnings?: string[];
};

export type Stage1ReconciliationManifest = {
  inputs?: {
    oods_registry_fetch?: Stage1RegistryFetchTelemetry;
  };
};

export type Stage1ReconciliationSummary = {
  mode: string;
  existing_map_count: number;
  verdict_counts: Partial<Record<MapApplyAction, number>>;
};

export type Stage1ReconciliationReport = {
  kind: "reconciliation_report";
  schema_version: string;
  generated_at: string;
  target: {
    id: string;
    url?: string;
  };
  candidate_objects: Stage1CandidateObject[];
  candidate_actions?: Stage1CandidateAction[];
  candidate_traits?: Record<string, unknown>[];
  conflicts?: Stage1Conflict[];
  coverage_gaps?: Record<string, unknown>[];
  validation_failures?: Record<string, unknown>[];
  disambiguation_decisions?: Stage1DisambiguationDecision[];
  manifest?: Stage1ReconciliationManifest;
  reconciliation_summary?: Stage1ReconciliationSummary;
};

export type MapApplyInput = {
  apply?: boolean;
  minConfidence?: number;
  report?: Stage1ReconciliationReport;
  reportPath?: string;
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
  diff?: Stage1CandidateDiff;
};

export type MapApplyQueued = {
  objectId: string;
  name: string;
  action: MapApplyAction;
  confidence: number;
  threshold: number;
  queueReason: "below_confidence";
  recommendedOodsTraits: string[];
  existingMapId?: string;
  reason: string;
  diff?: Stage1CandidateDiff;
};

export type MapApplyConflict = {
  objectId: string;
  name: string;
  action: "conflict";
  confidence: number;
  existingMapId?: string;
  reason: string;
};

export type MapApplyError = {
  objectId?: string;
  name?: string;
  action?: MapApplyAction;
  message: string;
  details?: Record<string, unknown>;
};

export type MapApplyDiffSummary = {
  create: number;
  patch: number;
  skip: number;
  conflict: number;
  queued: number;
  changedFields: string[];
  addedTraits: string[];
  removedTraits: string[];
};

export type MapApplyOutput = {
  applied: MapApplyRoute[];
  skipped: MapApplyRoute[];
  queued: MapApplyQueued[];
  conflicted: MapApplyConflict[];
  errors: MapApplyError[];
  diff: MapApplyDiffSummary;
  conflictArtifactPath?: string;
  etag: string;
};

export type RegistrySnapshotInput = Record<string, never>;

export type RegistrySnapshotTraitInfo = {
  name: string;
  version: string;
  description: string;
  category: string;
  tags?: string[];
  contexts?: string[];
  viewExtensions?: Record<string, unknown>[];
  parameters?: Record<string, unknown>[];
  schema?: Record<string, unknown>;
  semantics?: Record<string, unknown>;
  tokens?: Record<string, unknown>;
  dependencies?: string[];
  metadata?: Record<string, unknown>;
  objects?: string[];
  source?: string;
};

export type RegistrySnapshotObjectInfo = {
  name: string;
  version: string;
  domain: string;
  description: string;
  tags?: string[];
  traits?: Array<{
    reference: string;
    alias?: string | null;
    parameters?: Record<string, unknown>;
  }>;
  fields?: string[];
  semantics?: Record<string, unknown>;
  tokens?: Record<string, unknown>;
  metadata?: Record<string, unknown>;
  source?: string;
};

export type RegistrySnapshotOutput = {
  maps: Record<string, unknown>[];
  traits: Record<string, RegistrySnapshotTraitInfo>;
  objects: Record<string, RegistrySnapshotObjectInfo>;
  etag: string;
  generatedAt: string;
};

export type MapListInput = {
  externalSystem?: string;
  cursor?: string;
  limit?: number;
};

export type MapListOutput = {
  mappings: Record<string, unknown>[];
  totalCount: number;
  stats: {
    mappingCount: number;
    systemCount: number;
  };
  etag: string;
  nextCursor?: string;
};

export type MapPropTranslation = {
  externalProp: string;
  oodsProp: string;
  coercionType: string | null;
  coercionDetail: Record<string, unknown> | null;
};

export type MapResolveInput = {
  externalSystem: string;
  externalComponent: string;
};

export type MapResolveOutput = {
  status: "ok" | "not_found";
  mapping?: Record<string, unknown>;
  propTranslations?: MapPropTranslation[];
  message?: string;
};

export type MapUpdateInput = {
  id: string;
  updates: {
    oodsTraits?: string[];
    confidence?: "auto" | "manual";
    propMappings?: Array<{
      externalProp: string;
      oodsProp: string;
      coercion?:
        | (
            | { type: "enum"; mapping: Record<string, string> }
            | {
                type: "boolean_to_string";
                trueValue: string;
                falseValue: string;
              }
            | { type: "template"; pattern: string }
            | { type: "identity" }
          )
        | null;
    }>;
    notes?: string;
    projection_variants?: Stage1ProjectionVariant[];
  };
};

export type MapUpdateOutput = {
  status: "ok" | "error";
  mapping?: Record<string, unknown>;
  etag?: string;
  changes?: string[];
  message?: string;
};

export type MapDeleteInput = {
  id: string;
};

export type MapDeleteOutput = {
  status: "ok" | "error";
  deleted?: {
    id: string;
    externalSystem: string;
    externalComponent: string;
  };
  etag?: string;
  message?: string;
};
