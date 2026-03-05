/**
 * s55-m05 contract tests — fresh install verification and docs update
 *
 * Validates all six success criteria:
 * 1. Adapter starts and serves all registry tools (verified by smoke-test.js)
 * 2. Cursor MCP config example added to configs/agents/
 * 3. docs/mcp/Connections.md updated with stdio adapter setup
 * 4. Claude Desktop stdio config documented as alternative to bridge
 * 5. Smoke harness passes (verified by smoke-test.js)
 * 6. All tools show descriptions and typed parameters in list_tools
 */

import { strict as assert } from 'node:assert';
import { readFileSync, existsSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const PROJECT_ROOT = path.resolve(__dirname, '..', '..');

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

console.log('s55-m05 contract tests\n');

// ── Criterion 1: Adapter starts and serves all 20 tools ──────────────
// (Full live verification done by smoke-test.js; here we verify static requirements)

test('Adapter entry point exists', () => {
  assert.ok(existsSync(path.join(__dirname, 'index.js')), 'index.js should exist');
});

test('Native server dist exists with entry point', () => {
  const serverEntry = path.join(PROJECT_ROOT, 'packages', 'mcp-server', 'dist', 'index.js');
  assert.ok(existsSync(serverEntry), `Server dist entry should exist at ${serverEntry}`);
});

test('Registry exposes at least one tool', () => {
  const reg = JSON.parse(readFileSync(
    path.join(PROJECT_ROOT, 'packages', 'mcp-server', 'dist', 'tools', 'registry.json'), 'utf8'
  ));
  assert.ok((reg.auto.length + reg.onDemand.length) > 0);
});

// ── Criterion 2: Cursor MCP config example ───────────────────────────

test('Cursor stdio config exists at configs/agents/cursor.stdio-mcp.json', () => {
  const configPath = path.join(PROJECT_ROOT, 'configs', 'agents', 'cursor.stdio-mcp.json');
  assert.ok(existsSync(configPath), 'cursor.stdio-mcp.json should exist');
});

test('Cursor config has cursorConfig block with mcpServers', () => {
  const config = JSON.parse(readFileSync(
    path.join(PROJECT_ROOT, 'configs', 'agents', 'cursor.stdio-mcp.json'), 'utf8'
  ));
  assert.ok(config.cursorConfig?.mcpServers, 'Should have cursorConfig.mcpServers');
  assert.ok(config.cursorConfig.mcpServers['oods-foundry'], 'Should have oods-foundry server');
  assert.ok(
    config.cursorConfig.mcpServers['oods-foundry'].command,
    'Should have command field'
  );
});

test('Cursor config uses stdio transport', () => {
  const config = JSON.parse(readFileSync(
    path.join(PROJECT_ROOT, 'configs', 'agents', 'cursor.stdio-mcp.json'), 'utf8'
  ));
  assert.equal(config.transport?.type, 'stdio');
});

// ── Criterion 3: Connections.md updated with stdio adapter setup ──────

test('Connections.md exists', () => {
  assert.ok(existsSync(path.join(PROJECT_ROOT, 'docs', 'mcp', 'Connections.md')));
});

const connectionsMd = readFileSync(
  path.join(PROJECT_ROOT, 'docs', 'mcp', 'Connections.md'), 'utf8'
);

test('Connections.md has stdio adapter section', () => {
  assert.ok(connectionsMd.includes('Stdio Adapter'), 'Should mention Stdio Adapter');
});

test('Connections.md has Cursor setup instructions', () => {
  assert.ok(connectionsMd.includes('Cursor'), 'Should mention Cursor');
  assert.ok(connectionsMd.includes('.cursor/mcp.json'), 'Should reference .cursor/mcp.json');
});

test('Connections.md has environment variables table', () => {
  assert.ok(connectionsMd.includes('MCP_TOOLSET'), 'Should document MCP_TOOLSET');
  assert.ok(connectionsMd.includes('MCP_EXTRA_TOOLS'), 'Should document MCP_EXTRA_TOOLS');
  assert.ok(connectionsMd.includes('OODS_NODE_PATH'), 'Should document OODS_NODE_PATH');
});

// ── Criterion 4: Claude Desktop stdio config ─────────────────────────

test('Claude Desktop stdio config exists', () => {
  const configPath = path.join(PROJECT_ROOT, 'configs', 'agents', 'claude-desktop.stdio-mcp.json');
  assert.ok(existsSync(configPath), 'claude-desktop.stdio-mcp.json should exist');
});

test('Claude Desktop stdio config has claudeDesktopConfig block', () => {
  const config = JSON.parse(readFileSync(
    path.join(PROJECT_ROOT, 'configs', 'agents', 'claude-desktop.stdio-mcp.json'), 'utf8'
  ));
  assert.ok(config.claudeDesktopConfig?.mcpServers, 'Should have claudeDesktopConfig.mcpServers');
  const server = config.claudeDesktopConfig.mcpServers['oods-foundry'];
  assert.ok(server, 'Should have oods-foundry server');
  assert.equal(server.command, 'node', 'Command should be node');
});

test('Connections.md documents Claude Desktop stdio as alternative', () => {
  assert.ok(
    connectionsMd.includes('Claude Desktop (stdio)'),
    'Should have Claude Desktop stdio section'
  );
  assert.ok(
    connectionsMd.includes('claude-desktop.stdio-mcp.json'),
    'Should reference claude-desktop.stdio-mcp.json'
  );
});

// ── Criterion 5: Smoke harness exists ────────────────────────────────

test('Smoke harness exists at packages/mcp-adapter/smoke-test.js', () => {
  assert.ok(existsSync(path.join(__dirname, 'smoke-test.js')), 'smoke-test.js should exist');
});

test('Smoke harness tests list_tools response', () => {
  const smoke = readFileSync(path.join(__dirname, 'smoke-test.js'), 'utf8');
  assert.ok(smoke.includes('tools/list'), 'Smoke test should call tools/list');
  assert.ok(smoke.includes('descriptions'), 'Smoke test should verify descriptions');
  assert.ok(smoke.includes('inputSchema'), 'Smoke test should verify inputSchema');
});

// ── Criterion 6: Tools show descriptions and typed parameters ────────

const descriptions = JSON.parse(readFileSync(path.join(__dirname, 'tool-descriptions.json'), 'utf8'));

test('All registry tools have descriptions in manifest', () => {
  const reg = JSON.parse(readFileSync(
    path.join(PROJECT_ROOT, 'packages', 'mcp-server', 'dist', 'tools', 'registry.json'), 'utf8'
  ));
  assert.equal(Object.keys(descriptions).length, reg.auto.length + reg.onDemand.length);
});

test('No description says "Proxy to"', () => {
  for (const [tool, desc] of Object.entries(descriptions)) {
    assert.ok(!desc.includes('Proxy'), `${tool} still has generic description`);
  }
});

test('Tool-specific input schemas exist for key tools', () => {
  const schemasDir = path.join(PROJECT_ROOT, 'packages', 'mcp-server', 'dist', 'schemas');
  const keyTools = ['tokens.build', 'structuredData.fetch', 'brand.apply', 'catalog.list'];
  for (const tool of keyTools) {
    const schemaPath = path.join(schemasDir, `${tool}.input.json`);
    assert.ok(existsSync(schemaPath), `${tool}.input.json should exist`);
    const schema = JSON.parse(readFileSync(schemaPath, 'utf8'));
    assert.ok(schema.properties, `${tool} schema should have properties`);
  }
});

// ── Summary ──────────────────────────────────────────────────────────

console.log(`\n${passed + failed} tests: ${passed} passed, ${failed} failed`);
if (failed > 0) process.exit(1);
