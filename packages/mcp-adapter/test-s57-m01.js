/**
 * s57-m01 guard tests — Opus 4.6 UX findings
 *
 * These are contract/guard tests intended to fail until the
 * corresponding fixes land. Run manually:
 *   node packages/mcp-adapter/test-s57-m01.js
 */

import { strict as assert } from 'node:assert';
import { spawn } from 'node:child_process';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const ADAPTER_ENTRY = path.join(__dirname, 'index.js');
const PROJECT_ROOT = path.resolve(__dirname, '..', '..');
const FIXTURE_DIR = path.resolve(PROJECT_ROOT, 'packages', 'mcp-server', 'test', 'fixtures', 'ui');

const BASIC_SCHEMA = JSON.parse(readFileSync(path.join(FIXTURE_DIR, 'basic-mix.ui-schema.json'), 'utf8'));

const TIMEOUT_MS = 20000;

let passed = 0;
let failed = 0;

function test(name, fn) {
  try {
    fn();
    console.log(`  PASS  ${name}`);
    passed++;
  } catch (err) {
    console.error(`  FAIL  ${name}`);
    console.error(`        ${err.message}`);
    failed++;
  }
}

function jsonRpcRequest(method, params = {}, id = 1) {
  return JSON.stringify({ jsonrpc: '2.0', id, method, params }) + '\n';
}

function startAdapter() {
  const child = spawn(process.execPath, [ADAPTER_ENTRY], {
    cwd: __dirname,
    stdio: ['pipe', 'pipe', 'pipe'],
    env: { ...process.env, MCP_TOOLSET: 'all' },
  });
  return child;
}

async function waitForAdapterReady(child) {
  return new Promise((resolve, reject) => {
    let stderr = '';
    const timer = setTimeout(() => reject(new Error('Adapter startup timeout')), TIMEOUT_MS);
    child.stderr.setEncoding('utf8');
    child.stderr.on('data', (chunk) => {
      stderr += chunk;
      if (stderr.includes('[oods-mcp-adapter]')) {
        clearTimeout(timer);
        resolve();
      }
    });
    child.on('error', reject);
    child.on('exit', (code) => {
      clearTimeout(timer);
      reject(new Error(`Adapter exited with code ${code}`));
    });
  });
}

function createClient(child) {
  let seq = 0;
  let buffer = '';
  const pending = new Map();

  child.stdout.setEncoding('utf8');
  child.stdout.on('data', (chunk) => {
    buffer += chunk;
    let idx;
    while ((idx = buffer.indexOf('\n')) >= 0) {
      const line = buffer.slice(0, idx).trim();
      buffer = buffer.slice(idx + 1);
      if (!line) continue;
      let parsed;
      try {
        parsed = JSON.parse(line);
      } catch {
        continue;
      }
      if (parsed.id == null) continue;
      const handler = pending.get(parsed.id);
      if (!handler) continue;
      pending.delete(parsed.id);
      if (parsed.error) handler.reject(parsed.error);
      else handler.resolve(parsed.result);
    }
  });

  const request = (method, params) => {
    const id = ++seq;
    const payload = jsonRpcRequest(method, params, id);
    return new Promise((resolve, reject) => {
      pending.set(id, { resolve, reject });
      child.stdin.write(payload, 'utf8');
    });
  };

  const callTool = async (name, args) => {
    const result = await request('tools/call', { name, arguments: args ?? {} });
    const text = result?.content?.[0]?.text ?? '';
    let parsed = null;
    try {
      parsed = JSON.parse(text);
    } catch {
      parsed = text;
    }
    return { result, text, parsed };
  };

  return { request, callTool };
}

async function run() {
  console.log('s57-m01 guard tests\n');

  const child = startAdapter();
  await waitForAdapterReady(child);

  const client = createClient(child);

  await client.request('initialize', {
    protocolVersion: '2024-11-05',
    capabilities: {},
    clientInfo: { name: 's57-m01-guards', version: '1.0.0' },
  });
  child.stdin.write(JSON.stringify({ jsonrpc: '2.0', method: 'notifications/initialized' }) + '\n');

  // ── Critical: schemaRef handoff (design.compose -> validate/render) ─
  const composeInput = {
    intent: 'Account detail view with tabs for Overview, Billing, Activity, Settings.',
    layout: 'detail',
    preferences: { tabCount: 4, tabLabels: ['Overview', 'Billing', 'Activity', 'Settings'] },
    options: { topN: 1 },
  };
  const compose = await client.callTool('design_compose', composeInput);
  const composeObj = compose.parsed && typeof compose.parsed === 'object' ? compose.parsed : {};

  test('design.compose returns schemaRef for reuse', () => {
    assert.ok(
      typeof composeObj.schemaRef === 'string' && composeObj.schemaRef.length > 0,
      'Expected schemaRef string in compose output'
    );
  });

  // ── High: catalog.list summary/pagination default ──────────────────
  const catalogAll = await client.callTool('catalog_list', {});
  test('catalog.list unfiltered defaults to summary payload (<= 25k chars)', () => {
    assert.ok(
      catalogAll.text.length <= 25000,
      `Expected <= 25k chars, got ${catalogAll.text.length}`
    );
  });

  // ── High: code.generate React should not emit triple braces ─────────
  const codegen = await client.callTool('code_generate', {
    schema: BASIC_SCHEMA,
    framework: 'react',
    options: { styling: 'inline', typescript: true },
  });
  test('code.generate React does not emit style={{{ ... }}}', () => {
    assert.ok(
      !codegen.text.includes('style={{{'),
      'Found style={{{ in generated React output'
    );
  });

  // ── High: repl.render contract clarity (docs mention apply) ─────────
  const toolSpecs = readFileSync(
    path.join(PROJECT_ROOT, 'docs', 'mcp', 'Tool-Specs.md'),
    'utf8'
  );
  test('Tool-Specs repl.render section documents apply/preview-only behavior', () => {
    const marker = '### `repl.render`';
    const idx = toolSpecs.indexOf(marker);
    assert.ok(idx >= 0, 'Missing repl.render section in Tool-Specs');
    const section = toolSpecs.slice(idx, idx + 800);
    const mentionsApply = section.toLowerCase().includes('apply');
    const mentionsPreview = section.toLowerCase().includes('preview');
    assert.ok(
      mentionsApply || mentionsPreview,
      'Expected repl.render docs to mention apply or preview-only behavior'
    );
  });

  child.kill();

  console.log(`\n${passed + failed} tests: ${passed} passed, ${failed} failed`);
  if (failed > 0) process.exit(1);
}

run().catch((err) => {
  console.error('Guard test error:', err);
  process.exit(1);
});
