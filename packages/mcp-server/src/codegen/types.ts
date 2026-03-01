import type { UiSchema } from '../schemas/generated.js';

export type CodegenFramework = 'react' | 'vue' | 'html';

export type CodegenStyling = 'inline' | 'tokens';

export type CodegenOptions = {
  typescript: boolean;
  styling: CodegenStyling;
};

export type CodegenIssue = {
  code: string;
  message: string;
  nodeId?: string;
  component?: string;
};

export type CodegenResult = {
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

export type Emitter = (schema: UiSchema, options: CodegenOptions) => CodegenResult;
