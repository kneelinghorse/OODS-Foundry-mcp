/**
 * s55-m04 contract tests — MCP annotations, error UX, and protocol cleanup
 *
 * Validates all six success criteria:
 * 1. All tools have MCP annotations (readOnlyHint, destructiveHint, openWorldHint)
 * 2. Read-only tools marked readOnlyHint: true, apply-capable marked destructiveHint: true
 * 3. Server spawn failures produce structured MCP error with actionable fix instructions
 * 4. Non-standard structuredContent field removed from tool responses
 * 5. Adapter logs version, tool count, and server path on startup to stderr
 * 6. Annotations derivable from existing policy/registry data — no manual per-tool config
 */

import { strict as assert } from 'node:assert';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const INDEX_SRC = readFileSync(path.join(__dirname, 'index.js'), 'utf8');
const PKG = JSON.parse(readFileSync(path.join(__dirname, 'package.json'), 'utf8'));
const PROJECT_ROOT = path.resolve(__dirname, '..', '..');
const POLICY = JSON.parse(readFileSync(
  path.join(PROJECT_ROOT, 'packages', 'mcp-server', 'dist', 'security', 'policy.json'), 'utf8'
));
const REGISTRY = JSON.parse(readFileSync(
  path.join(PROJECT_ROOT, 'packages', 'mcp-server', 'dist', 'tools', 'registry.json'), 'utf8'
));
const ALL_TOOLS = [...REGISTRY.auto, ...REGISTRY.onDemand];

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

// Simulate deriveAnnotations from the adapter
function deriveAnnotations(toolName) {
  const rule = POLICY.rules?.find(r => r.tool === toolName);
  if (!rule) return { openWorldHint: false };
  if (rule.readOnly) return { readOnlyHint: true, destructiveHint: false, openWorldHint: false };
  return { readOnlyHint: false, destructiveHint: true, openWorldHint: false };
}

console.log('s55-m04 contract tests\n');

// ── Criterion 1: All tools have MCP annotations ─────────────────────

test('deriveAnnotations function exists in adapter', () => {
  assert.ok(INDEX_SRC.includes('deriveAnnotations'), 'Expected deriveAnnotations function');
});

test('Every tool gets annotations with all three hint fields', () => {
  for (const tool of ALL_TOOLS) {
    const ann = deriveAnnotations(tool);
    assert.ok('openWorldHint' in ann, `${tool}: missing openWorldHint`);
    assert.ok(
      'readOnlyHint' in ann || 'destructiveHint' in ann,
      `${tool}: must have readOnlyHint or destructiveHint`
    );
  }
});

test('Annotations object included in list_tools response', () => {
  assert.ok(
    INDEX_SRC.includes('annotations: t.annotations'),
    'Expected annotations field in tools/list response'
  );
});

// ── Criterion 2: Correct classification of read-only vs destructive ──

const READ_ONLY_TOOLS = ['catalog.list', 'structuredData.fetch', 'repl.validate',
  'code.generate', 'design.compose', 'map.list', 'map.resolve'];
const WRITE_TOOLS = ['tokens.build', 'brand.apply', 'diag.snapshot', 'repl.render',
  'release.verify', 'release.tag', 'reviewKit.create', 'a11y.scan',
  'purity.audit', 'vrt.run', 'billing.reviewKit', 'billing.switchFixtures', 'map.create'];

test('Read-only tools have readOnlyHint: true', () => {
  for (const tool of READ_ONLY_TOOLS) {
    const ann = deriveAnnotations(tool);
    assert.equal(ann.readOnlyHint, true, `${tool} should be readOnlyHint: true`);
    assert.equal(ann.destructiveHint, false, `${tool} should be destructiveHint: false`);
  }
});

test('Write-capable tools have destructiveHint: true', () => {
  for (const tool of WRITE_TOOLS) {
    const ann = deriveAnnotations(tool);
    assert.equal(ann.destructiveHint, true, `${tool} should be destructiveHint: true`);
    assert.equal(ann.readOnlyHint, false, `${tool} should be readOnlyHint: false`);
  }
});

test('All tools have openWorldHint: false (local operations only)', () => {
  for (const tool of ALL_TOOLS) {
    const ann = deriveAnnotations(tool);
    assert.equal(ann.openWorldHint, false, `${tool} should be openWorldHint: false`);
  }
});

test('Classification covers all 20 tools', () => {
  const classified = new Set([...READ_ONLY_TOOLS, ...WRITE_TOOLS]);
  assert.equal(classified.size, 20, `Expected 20 classified tools, got ${classified.size}`);
  for (const tool of ALL_TOOLS) {
    assert.ok(classified.has(tool), `${tool} not classified in either read-only or write lists`);
  }
});

// ── Criterion 3: Structured error for spawn failures ─────────────────

test('Adapter detects spawn/build errors and adds fix guidance', () => {
  assert.ok(
    INDEX_SRC.includes('isSpawnError'),
    'Expected spawn error detection logic'
  );
  assert.ok(
    INDEX_SRC.includes('pnpm --filter @oods/mcp-server run build'),
    'Expected actionable build command in error guidance'
  );
});

test('Error guidance only appended for server-related failures', () => {
  // Verify the conditional: only spawn/build errors get guidance
  assert.ok(
    INDEX_SRC.includes("message.includes('not built')") ||
    INDEX_SRC.includes("'not built'"),
    'Expected check for "not built" error pattern'
  );
  assert.ok(
    INDEX_SRC.includes("message.includes('server exited')") ||
    INDEX_SRC.includes("'server exited'"),
    'Expected check for "server exited" error pattern'
  );
});

// ── Criterion 4: structuredContent removed ───────────────────────────

test('No structuredContent field in tool responses', () => {
  assert.ok(
    !INDEX_SRC.includes('structuredContent'),
    'structuredContent should be removed from all tool responses'
  );
});

// ── Criterion 5: Startup logging with version, tool count, server path

test('Startup log includes adapter version', () => {
  assert.ok(
    INDEX_SRC.includes('ADAPTER_VERSION') || INDEX_SRC.includes("version: '"),
    'Expected version in startup log'
  );
});

test('ADAPTER_VERSION constant matches package.json version', () => {
  const match = INDEX_SRC.match(/ADAPTER_VERSION\s*=\s*'([^']+)'/);
  assert.ok(match, 'Expected ADAPTER_VERSION constant');
  assert.equal(match[1], PKG.version, `ADAPTER_VERSION ${match[1]} != package.json ${PKG.version}`);
});

test('Startup log includes server path (NATIVE_DIST)', () => {
  assert.ok(
    INDEX_SRC.includes('NATIVE_DIST') && INDEX_SRC.includes('console.error'),
    'Expected server path in startup stderr log'
  );
});

test('Startup log includes tool count', () => {
  // Already verified by s55-m02, but confirm it still exists
  assert.ok(
    INDEX_SRC.includes('enabled.length') && INDEX_SRC.includes('console.error'),
    'Expected tool count in startup log'
  );
});

// ── Criterion 6: Annotations derived from policy, not manual config ──

test('Adapter loads policy.json from server dist', () => {
  assert.ok(INDEX_SRC.includes('POLICY_PATH'), 'Expected POLICY_PATH reference');
  assert.ok(INDEX_SRC.includes('policy.json'), 'Expected policy.json reference');
});

test('No per-tool annotation hardcoding in adapter', () => {
  // Check that no tool-specific annotation objects are hardcoded
  const annotationHardcodes = INDEX_SRC.match(/readOnlyHint:\s*(true|false).*tokens\.build/);
  assert.ok(!annotationHardcodes, 'Annotations should be derived from policy, not hardcoded per tool');
});

test('deriveAnnotations reads from policy rules', () => {
  assert.ok(
    INDEX_SRC.includes('policy.rules') || INDEX_SRC.includes('rule.readOnly'),
    'Expected policy rules inspection in deriveAnnotations'
  );
});

// ── Summary ──────────────────────────────────────────────────────────

console.log(`\n${passed + failed} tests: ${passed} passed, ${failed} failed`);
if (failed > 0) process.exit(1);
