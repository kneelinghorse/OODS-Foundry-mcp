// Use Ajv 2020-12 to match schema meta
// eslint-disable-next-line @typescript-eslint/ban-ts-comment
// @ts-ignore - type resolution for subpath import
import AjvCtor from 'ajv/dist/2020.js';
import addFormatsImport from 'ajv-formats';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

let ajvInstance: any | null = null;

export function getAjv(): any {
  if (!ajvInstance) {
    const AjvClass: any = AjvCtor as any;
    ajvInstance = new AjvClass({
      allErrors: true,
      allowUnionTypes: true,
      strict: false,
      removeAdditional: 'failing',
      useDefaults: true
    });
    const addFormats: any = (addFormatsImport as any).default ?? addFormatsImport;
    addFormats(ajvInstance);
    const metaPath = path.join(path.dirname(fileURLToPath(import.meta.url)), '../schemas/json-schema-draft-07.json');
    try {
      const draft7 = JSON.parse(fs.readFileSync(metaPath, 'utf8'));
      ajvInstance.addMetaSchema(draft7);
    } catch {
      // ignore missing meta schema; validation will be less strict without it
    }
  }
  return ajvInstance;
}
