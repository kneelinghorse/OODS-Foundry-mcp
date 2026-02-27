import { once } from 'node:events';
import { spawn, type ChildProcessWithoutNullStreams } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import type { ReplRenderInput, ReplRenderOutput, UiSchema } from '../../src/schemas/generated.js';
import { handle as renderHandle } from '../../src/tools/repl.render.js';

type BridgeProcess = {
  child: ChildProcessWithoutNullStreams;
  port: number;
};

const TEST_FILE_DIR = path.dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = path.resolve(TEST_FILE_DIR, '../../../../');
const FIXTURE_DIR = path.resolve(TEST_FILE_DIR, '../fixtures/ui');
const MCP_BRIDGE_DIR = path.join(REPO_ROOT, 'packages', 'mcp-bridge');

let bridge: BridgeProcess | null = null;

function loadFixture(fileName: string): UiSchema {
  const fullPath = path.join(FIXTURE_DIR, fileName);
  return JSON.parse(fs.readFileSync(fullPath, 'utf8')) as UiSchema;
}

/** Workbench S44 component set with 1 unknown component injected. */
function workbenchWithUnknown(): UiSchema {
  const base = loadFixture('workbench-s44.ui-schema.json');
  const screen = base.screens[0];
  if (Array.isArray(screen.children)) {
    screen.children.push({
      id: 'unknown-widget',
      component: 'FancyWidget',
    });
  }
  return base;
}

async function runCommand(cmd: string, args: string[], cwd: string): Promise<void> {
  const child = spawn(cmd, args, {
    cwd,
    stdio: ['ignore', 'pipe', 'pipe'],
    env: { ...process.env },
  });
  const stderrChunks: string[] = [];
  child.stderr.setEncoding('utf8');
  child.stderr.on('data', (chunk) => stderrChunks.push(chunk));
  const [code] = (await once(child, 'close')) as [number | null];
  if (code !== 0) {
    throw new Error(`Command failed (${cmd} ${args.join(' ')}):\n${stderrChunks.join('')}`);
  }
}

async function startBridge(): Promise<BridgeProcess> {
  const child = spawn(process.execPath, ['dist/server.js'], {
    cwd: MCP_BRIDGE_DIR,
    stdio: ['ignore', 'pipe', 'pipe'],
    env: {
      ...process.env,
      MCP_BRIDGE_PORT: '0',
    },
  });
  child.stdout.setEncoding('utf8');
  child.stderr.setEncoding('utf8');

  return await new Promise<BridgeProcess>((resolve, reject) => {
    const timeout = setTimeout(() => reject(new Error('Timed out waiting for bridge startup')), 20_000);
    child.stdout.on('data', (chunk: string) => {
      const match = chunk.match(/\[mcp-bridge\] listening on :(\d+)/);
      if (!match) return;
      clearTimeout(timeout);
      resolve({ child, port: Number(match[1]) });
    });
    child.once('exit', (code) => {
      clearTimeout(timeout);
      reject(new Error(`Bridge exited before startup (code=${String(code)})`));
    });
  });
}

async function stopBridge(proc: BridgeProcess): Promise<void> {
  proc.child.kill('SIGTERM');
  await once(proc.child, 'close');
}

async function runBridgeRender(port: number, input: ReplRenderInput): Promise<ReplRenderOutput> {
  const response = await fetch(`http://127.0.0.1:${port}/run`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({
      tool: 'repl_render',
      input,
    }),
  });
  const payload = await response.json();
  if (!response.ok) {
    throw new Error(`Bridge /run failed (${response.status}): ${JSON.stringify(payload)}`);
  }
  if (!payload?.ok || !payload?.result) {
    throw new Error(`Unexpected bridge response: ${JSON.stringify(payload)}`);
  }
  return payload.result as ReplRenderOutput;
}

describe('registry gaps e2e verification', () => {
  beforeAll(async () => {
    await runCommand('pnpm', ['--filter', '@oods/mcp-server', 'run', 'build'], REPO_ROOT);
    await runCommand('pnpm', ['--filter', '@oods/mcp-bridge', 'run', 'build'], REPO_ROOT);
    bridge = await startBridge();
  }, 60_000);

  afterAll(async () => {
    if (bridge) {
      await stopBridge(bridge);
      bridge = null;
    }
  });

  it('Workbench S44 fixture with Grid + known components renders all fragments via bridge', async () => {
    if (!bridge) throw new Error('Bridge process not initialized');

    const schema = loadFixture('workbench-s44.ui-schema.json');
    const input: ReplRenderInput = {
      mode: 'full',
      schema,
      apply: true,
      output: { format: 'fragments', strict: false },
    };

    const [bridgeResult, directResult] = await Promise.all([
      runBridgeRender(bridge.port, input),
      renderHandle(input),
    ]);

    // Both transports return success
    expect(bridgeResult.status).toBe('ok');
    expect(directResult.status).toBe('ok');

    // All top-level fragments present (header-banner, main-grid, save-button)
    const expectedFragmentIds = ['header-banner', 'main-grid', 'save-button'];
    for (const id of expectedFragmentIds) {
      expect(bridgeResult.fragments?.[id]).toBeDefined();
      expect(directResult.fragments?.[id]).toBeDefined();
    }

    // Grid fragment renders correctly
    const gridFragment = bridgeResult.fragments?.['main-grid'];
    expect(gridFragment).toBeDefined();
    expect(gridFragment!.component).toBe('Grid');
    expect(gridFragment!.html).toContain('data-oods-component="Grid"');
    expect(gridFragment!.html).toContain('display:grid');
    expect(gridFragment!.html).toContain('grid-template-columns:repeat(3, minmax(0, 1fr))');

    // Grid children rendered inside
    expect(gridFragment!.html).toContain('data-oods-component="Card"');
    expect(gridFragment!.html).toContain('data-oods-component="Text"');
    expect(gridFragment!.html).toContain('data-oods-component="Badge"');
    expect(gridFragment!.html).toContain('data-oods-component="Input"');
    expect(gridFragment!.html).toContain('data-oods-component="Select"');
    expect(gridFragment!.html).toContain('data-oods-component="Table"');
    expect(gridFragment!.html).toContain('data-oods-component="Tabs"');

    // No errors
    expect(bridgeResult.errors.filter((e) => e.code === 'UNKNOWN_COMPONENT')).toHaveLength(0);

    // Bridge parity: fragment IDs match
    expect(Object.keys(bridgeResult.fragments ?? {}).sort()).toEqual(
      Object.keys(directResult.fragments ?? {}).sort()
    );
  }, 60_000);

  it('Workbench S44 fixture with unknown component returns partial fragments + per-node errors via bridge', async () => {
    if (!bridge) throw new Error('Bridge process not initialized');

    const schema = workbenchWithUnknown();
    const input: ReplRenderInput = {
      mode: 'full',
      schema,
      apply: true,
      output: { format: 'fragments', strict: false },
    };

    const [bridgeResult, directResult] = await Promise.all([
      runBridgeRender(bridge.port, input),
      renderHandle(input),
    ]);

    // Both return partial success
    expect(bridgeResult.status).toBe('ok');
    expect(directResult.status).toBe('ok');

    // Known components still render as fragments
    expect(bridgeResult.fragments?.['header-banner']).toBeDefined();
    expect(bridgeResult.fragments?.['main-grid']).toBeDefined();
    expect(bridgeResult.fragments?.['save-button']).toBeDefined();

    // Unknown component excluded from fragments
    expect(bridgeResult.fragments?.['unknown-widget']).toBeUndefined();

    // Unknown component reported as per-node error
    const unknownErrors = bridgeResult.errors.filter((e) => e.code === 'UNKNOWN_COMPONENT');
    expect(unknownErrors).toHaveLength(1);
    expect(unknownErrors[0]?.nodeId).toBe('unknown-widget');
    expect(unknownErrors[0]?.component).toBe('FancyWidget');
    expect(unknownErrors[0]?.path).toBe('/fragments/unknown-widget');

    // Response shape matches the proposed shape from the registry gaps report
    expect(bridgeResult.fragments).toBeDefined();
    expect(bridgeResult.css).toBeDefined();
    expect(bridgeResult.errors).toBeDefined();

    // Bridge parity: error isolation behavior is identical
    const directUnknownErrors = directResult.errors.filter((e) => e.code === 'UNKNOWN_COMPONENT');
    expect(directUnknownErrors).toHaveLength(unknownErrors.length);
    expect(Object.keys(bridgeResult.fragments ?? {}).sort()).toEqual(
      Object.keys(directResult.fragments ?? {}).sort()
    );
  }, 60_000);

  it('bridge transport does not alter error isolation — strict mode still fails globally', async () => {
    if (!bridge) throw new Error('Bridge process not initialized');

    const schema = workbenchWithUnknown();
    const input: ReplRenderInput = {
      mode: 'full',
      schema,
      apply: true,
      output: { format: 'fragments', strict: true },
    };

    const [bridgeResult, directResult] = await Promise.all([
      runBridgeRender(bridge.port, input),
      renderHandle(input),
    ]);

    // Both return error status — strict mode blocks
    expect(bridgeResult.status).toBe('error');
    expect(directResult.status).toBe('error');
    expect(bridgeResult.fragments).toBeUndefined();
    expect(directResult.fragments).toBeUndefined();
  }, 60_000);
});
