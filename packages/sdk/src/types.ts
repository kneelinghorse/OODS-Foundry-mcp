/**
 * Public type re-exports from @oods/mcp-server.
 *
 * All tool input/output types available from a single import:
 *   import type { DesignComposeInput } from '@oods/sdk';
 */

export type {
  // design.compose
  DesignComposeInput,
  DesignComposeOutput,
  ComposeIssue,
  SlotSelectionEntry,
  ObjectUsedInfo,

  // viz.compose
  VizComposeInput,
  VizComposeOutput,
  VizSlotEntry,
  VizIssue,
  ChartType,
  DataBindings,

  // pipeline
  PipelineInput,
  PipelineOutput,

  // code.generate
  CodeGenerateInput,
  CodeGenerateOutput,
  CodegenFramework,
  CodegenStyling,
  CodegenIssue,

  // catalog
  CatalogListInput,
  CatalogListOutput,
  ComponentCatalogSummary,
  ComponentCatalogEntry,
  ComponentStatus,

  // object.list
  ObjectListInput,
  ObjectListOutput,
  ObjectListEntry,

  // object.show
  ObjectShowInput,
  ObjectShowOutput,
  ObjectShowTraitEntry,

  // schema management
  SchemaListInput,
  SchemaListOutput,
  SchemaLoadInput,
  SchemaLoadOutput,
  SchemaSaveInput,
  SchemaSaveOutput,
  SchemaDeleteInput,
  SchemaDeleteOutput,

  // mapping tools
  MapCreateInput,
  MapCreateOutput,
  MapListInput,
  MapListOutput,
  MapResolveInput,
  MapResolveOutput,
  MapUpdateInput,
  MapUpdateOutput,
  MapDeleteInput,
  MapDeleteOutput,
  MapPropTranslation,

  // structured data
  StructuredDataFetchInput,
  StructuredDataFetchOutput,
  StructuredDataset,

  // tokens + brand
  TokensBuildInput,
  BrandApplyInput,
  BrandApplyStrategy,
  GenericOutput,
} from '@oods/mcp-server/types';
