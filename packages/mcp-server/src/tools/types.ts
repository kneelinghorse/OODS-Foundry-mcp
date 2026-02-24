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
};

export type CatalogListInput = {
  category?: string;
  trait?: string;
  context?: string;
};

export type ComponentCodeReference = {
  kind: 'storybook';
  /**
   * Repo-relative path (POSIX) to a `.stories.tsx` file.
   */
  path: string;
  /**
   * Storybook title when available (e.g., `Traits/Core/Taggable`).
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
