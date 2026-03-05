import { describe, it, expect } from 'vitest';
import { execSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';

const ROOT = path.resolve(import.meta.dirname, '../../../../');
const DOCS_DIR = path.join(ROOT, 'docs/api');
const REGISTRY_PATH = path.join(ROOT, 'packages/mcp-server/src/tools/registry.json');

describe('API reference generator', () => {
  it('docs/api/ directory exists with generated files', () => {
    expect(fs.existsSync(DOCS_DIR)).toBe(true);
    const files = fs.readdirSync(DOCS_DIR);
    expect(files.length).toBeGreaterThan(0);
    expect(files).toContain('README.md');
  });

  it('generates a markdown file for each auto-registered tool', () => {
    const registry = JSON.parse(fs.readFileSync(REGISTRY_PATH, 'utf-8'));
    const autoTools: string[] = registry.auto;

    for (const tool of autoTools) {
      const slug = tool.replace(/\./g, '-');
      const filePath = path.join(DOCS_DIR, `${slug}.md`);
      expect(fs.existsSync(filePath), `Missing doc for ${tool}`).toBe(true);
    }
  });

  it('each doc contains required sections', () => {
    const files = fs.readdirSync(DOCS_DIR).filter((f) => f !== 'README.md');

    for (const file of files) {
      const content = fs.readFileSync(path.join(DOCS_DIR, file), 'utf-8');
      expect(content, `${file} missing Input Parameters`).toContain('## Input Parameters');
      expect(content, `${file} missing Output Shape`).toContain('## Output Shape');
      expect(content, `${file} missing Error Codes`).toContain('## Error Codes');
      expect(content, `${file} missing Example Request`).toContain('## Example Request');
    }
  });

  it('README.md index links to all tool docs', () => {
    const indexContent = fs.readFileSync(path.join(DOCS_DIR, 'README.md'), 'utf-8');
    const files = fs.readdirSync(DOCS_DIR).filter((f) => f !== 'README.md');

    for (const file of files) {
      expect(indexContent, `README.md missing link to ${file}`).toContain(`./${file}`);
    }
  });

  it('regeneration is idempotent', () => {
    // Generate once to establish baseline
    execSync('pnpm -w run docs:api', { cwd: ROOT, stdio: 'pipe' });

    // Read all current files
    const filesBefore: Record<string, string> = {};
    const files = fs.readdirSync(DOCS_DIR);
    for (const file of files) {
      filesBefore[file] = fs.readFileSync(path.join(DOCS_DIR, file), 'utf-8');
    }

    // Regenerate again
    execSync('pnpm -w run docs:api', { cwd: ROOT, stdio: 'pipe' });

    // Verify same files, same content
    const filesAfter = fs.readdirSync(DOCS_DIR);
    expect(filesAfter.sort()).toEqual(files.sort());

    for (const file of files) {
      const contentAfter = fs.readFileSync(path.join(DOCS_DIR, file), 'utf-8');
      expect(contentAfter, `${file} changed after regeneration`).toBe(filesBefore[file]);
    }
  });
});
