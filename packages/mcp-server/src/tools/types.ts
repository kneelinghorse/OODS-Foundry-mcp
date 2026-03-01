export type BaseInput = { apply?: boolean };

export type TokensBuildInput = BaseInput & {
  brand?: 'A';
  theme?: 'light' | 'dark' | 'hc';
};

export type PlanDiffChange = {
  type: 'context' | 'add' | 'remove';
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
  status: 'added' | 'modified' | 'deleted';
  summary?: PlanDiffSummary;
  hunks: PlanDiffHunk[];
  structured?:
    | {
        type: 'json';
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

export type GenericOutput = {
  artifacts: string[];
  diagnosticsPath?: string;
  transcriptPath: string;
  bundleIndexPath: string;
  preview?: ToolPreview;
  artifactsDetail?: ArtifactDetail[];
};

export type BrandApplyStrategy = 'alias' | 'patch';

export type BrandApplyInput = BaseInput & {
  brand?: 'A';
  delta: Record<string, unknown> | Record<string, unknown>[];
  strategy?: BrandApplyStrategy;
};

export type BillingProvider = 'stripe' | 'chargebee';

export type BillingReviewKitInput = BaseInput & {
  object: 'Subscription' | 'Invoice' | 'Plan' | 'Usage';
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

export type StructuredDataset = 'components' | 'tokens' | 'manifest';

export type StructuredDataFetchInput = {
  dataset: StructuredDataset;
  ifNoneMatch?: string;
  includePayload?: boolean;
  version?: string;
  listVersions?: boolean;
};

export type StructuredDataFetchOutput = {
  dataset: StructuredDataset;
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

export type CatalogListInput = {
  category?: string;
  trait?: string;
  context?: string;
};

export type ComponentCodeReference = {
  kind: 'storybook' | 'code-connect';
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

export type ComponentCatalogEntry = {
  name: string;
  displayName: string;
  categories: string[];
  tags: string[];
  contexts: string[];
  regions: string[];
  traits: string[];
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
  components: ComponentCatalogEntry[];
  totalCount: number;
  generatedAt: string;
  stats: {
    componentCount: number;
    traitCount: number;
  };
};

export type CodegenFramework = 'react' | 'vue' | 'html';

export type CodegenStyling = 'inline' | 'tokens';

export type CodeGenerateInput = {
  schema: import('../schemas/generated.js').UiSchema;
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
  status: 'ok' | 'error';
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
  externalSystem: string;
  externalComponent: string;
  oodsTraits: string[];
  propMappings?: Array<{
    externalProp: string;
    oodsProp: string;
    coercion?: {
      type: 'enum-map' | 'boolean-invert' | 'string-template' | 'type-cast';
      values?: Record<string, string>;
      template?: string;
      targetType?: 'string' | 'number' | 'boolean';
    } | null;
  }>;
  confidence?: 'auto' | 'manual';
  metadata?: {
    author?: string;
    notes?: string;
  };
};

export type MapCreateOutput = {
  status: 'ok' | 'error';
  mapping: Record<string, unknown>;
  etag: string;
  warnings?: string[];
};

export type MapListInput = {
  externalSystem?: string;
};

export type MapListOutput = {
  mappings: Record<string, unknown>[];
  totalCount: number;
  stats: {
    mappingCount: number;
    systemCount: number;
  };
  etag: string;
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
  status: 'ok' | 'not_found';
  mapping?: Record<string, unknown>;
  propTranslations?: MapPropTranslation[];
  message?: string;
};
