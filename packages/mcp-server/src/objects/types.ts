/**
 * TypeScript types matching the on-disk YAML schema for OODS objects and traits.
 */

// ---- Shared Field Types ----

export interface FieldValidation {
  enum?: string[];
  enumFromParameter?: string;
  minLength?: number;
  maxLength?: number;
  maxLengthFromParameter?: string;
  minimum?: number;
  maximum?: number;
  minItems?: number;
  maxItems?: number;
  uniqueItems?: boolean;
  pattern?: string;
  format?: string;
  items?: Record<string, unknown>;
  [key: string]: unknown;
}

export interface FieldDefinition {
  type: string;
  required: boolean;
  description: string;
  default?: unknown;
  defaultFromParameter?: string;
  validation?: FieldValidation;
}

export interface SemanticMapping {
  semantic_type: string;
  token_mapping: string;
  ui_hints?: Record<string, string | boolean | number>;
}

// ---- Object Types ----

export interface ObjectHeader {
  name: string;
  version: string;
  domain: string;
  description: string;
  tags?: string[];
}

export interface TraitReference {
  name: string;
  alias?: string;
  parameters?: Record<string, unknown>;
}

export interface ChangelogEntry {
  version: string;
  date: string;
  description: string;
}

export interface ObjectMetadata {
  owners?: string[];
  steward?: string;
  maturity?: string;
  changelog?: ChangelogEntry[];
  references?: string[];
}

export interface ObjectDefinition {
  object: ObjectHeader;
  traits: TraitReference[];
  schema: Record<string, FieldDefinition>;
  semantics: Record<string, SemanticMapping>;
  tokens: Record<string, unknown>;
  metadata: ObjectMetadata;
}

// ---- Trait Types ----

export interface TraitHeader {
  name: string;
  version: string;
  description: string;
  category: string;
  tags?: string[];
}

export interface ParameterDefinition {
  name: string;
  type: string;
  required: boolean;
  description: string;
  default?: unknown;
  validation?: FieldValidation;
}

export interface ViewExtension {
  component: string;
  position?: string;
  priority?: number;
  props?: Record<string, unknown>;
}

export interface EventDefinition {
  description: string;
  payload: string[];
}

export interface TraitAccessibility {
  keyboard?: string;
  screenreader?: string;
  rule_reference?: string;
  notes?: string;
}

export interface TraitMetadata {
  created?: string;
  updated?: string;
  owners?: string[];
  maturity?: string;
  conflicts_with?: string[];
  accessibility?: TraitAccessibility;
  regionsUsed?: string[];
  examples?: string[];
  references?: string[];
}

export interface TraitDefinition {
  trait: TraitHeader;
  parameters: ParameterDefinition[];
  schema: Record<string, FieldDefinition>;
  semantics: Record<string, SemanticMapping>;
  view_extensions: Record<string, ViewExtension[]>;
  tokens: Record<string, unknown>;
  events?: Record<string, EventDefinition>;
  dependencies: string[];
  metadata: TraitMetadata;
}
