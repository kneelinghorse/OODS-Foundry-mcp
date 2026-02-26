import { once } from 'node:events';
import { spawn, type ChildProcessWithoutNullStreams } from 'node:child_process';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import type { ReplRenderInput, ReplRenderOutput, UiSchema } from '../../src/schemas/generated.js';

const TEST_FILE_DIR = path.dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = path.resolve(TEST_FILE_DIR, '../../../../');
const MCP_SERVER_DIR = path.join(REPO_ROOT, 'packages', 'mcp-server');
const MCP_BRIDGE_DIR = path.join(REPO_ROOT, 'packages', 'mcp-bridge');

type BridgeProcess = {
  child: ChildProcessWithoutNullStreams;
  port: number;
};

let bridge: BridgeProcess | null = null;

function makeLargeFragmentSchema(fragmentCount = 12): UiSchema {
  const components = ['Button', 'Card', 'Badge'] as const;
  return {
    version: '2026.02',
    screens: [
      {
        id: 'bridge-parity-screen',
        component: 'Stack',
        children: Array.from({ length: fragmentCount }, (_, index) => {
          const component = components[index % components.length];
          const id = `bridge-fragment-${index + 1}`;
          if (component === 'Button') return { id, component, props: { label: `Button ${index + 1}` } };
          if (component === 'Card') return { id, component, props: { body: `Card ${index + 1}` } };
          return { id, component, props: { label: `Badge ${index + 1}` } };
        }),
      },
    ],
  };
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

    function onStdout(chunk: string): void {
      const match = chunk.match(/\[mcp-bridge\] listening on :(\d+)/);
      if (!match) return;
      clearTimeout(timeout);
      const port = Number(match[1]);
      if (!Number.isFinite(port) || port <= 0) {
        reject(new Error(`Invalid bridge port output: ${chunk}`));
        return;
      }
      resolve({ child, port });
    }

    child.stdout.on('data', onStdout);
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

async function runDirectMcpRender(input: ReplRenderInput): Promise<ReplRenderOutput> {
  const child = spawn(process.execPath, ['dist/index.js'], {
    cwd: MCP_SERVER_DIR,
    stdio: ['pipe', 'pipe', 'pipe'],
    env: { ...process.env },
  });
  child.stdout.setEncoding('utf8');
  child.stderr.setEncoding('utf8');

  const requestId = 1;
  child.stdin.write(`${JSON.stringify({ id: requestId, tool: 'repl.render', input })}\n`, 'utf8');

  const result = await new Promise<ReplRenderOutput>((resolve, reject) => {
    const timeout = setTimeout(() => reject(new Error('Timed out waiting for MCP stdio response')), 20_000);
    let buffer = '';

    child.stdout.on('data', (chunk: string) => {
      buffer += chunk;
      let idx = buffer.indexOf('\n');
      while (idx >= 0) {
        const line = buffer.slice(0, idx).trim();
        buffer = buffer.slice(idx + 1);
        idx = buffer.indexOf('\n');
        if (!line) continue;

        const payload = JSON.parse(line) as { id?: number; result?: ReplRenderOutput; error?: { message?: string } };
        if (payload.id !== requestId) continue;
        clearTimeout(timeout);
        if (payload.error) {
          reject(new Error(payload.error.message || 'Unknown MCP error'));
        } else if (payload.result) {
          resolve(payload.result);
        } else {
          reject(new Error(`Unexpected MCP payload: ${line}`));
        }
      }
    });

    child.stderr.on('data', (chunk: string) => {
      const text = chunk.trim();
      if (text.length > 0) {
        clearTimeout(timeout);
        reject(new Error(`MCP stderr: ${text}`));
      }
    });
  });

  child.kill('SIGTERM');
  await once(child, 'close');
  return result;
}

describe('bridge fragment parity', () => {
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

  it('supports fragment mode via bridge /run and matches direct MCP transport semantics', async () => {
    if (!bridge) throw new Error('Bridge process not initialized');
    const schema = makeLargeFragmentSchema(12);
    const input: ReplRenderInput = {
      mode: 'full',
      schema,
      apply: true,
      output: { format: 'fragments', strict: false, includeCss: true },
    };

    const [bridgeResult, directResult] = await Promise.all([
      runBridgeRender(bridge.port, input),
      runDirectMcpRender(input),
    ]);

    expect(bridgeResult.status).toBe('ok');
    expect(directResult.status).toBe('ok');
    expect(Object.keys(bridgeResult.fragments ?? {})).toHaveLength(12);
    expect(Object.keys(directResult.fragments ?? {})).toHaveLength(12);
    expect(Object.keys(bridgeResult.fragments ?? {})).toEqual(Object.keys(directResult.fragments ?? {}));
    expect(Object.keys(bridgeResult.css ?? {})).toEqual(Object.keys(directResult.css ?? {}));
    expect(bridgeResult.output).toEqual({ format: 'fragments', strict: false });
    expect(directResult.output).toEqual({ format: 'fragments', strict: false });

    for (const fragment of Object.values(bridgeResult.fragments ?? {})) {
      expect(fragment.cssRefs.length).toBeGreaterThanOrEqual(2);
      for (const ref of fragment.cssRefs) {
        expect(bridgeResult.css?.[ref]).toBeDefined();
      }
    }
  }, 60_000);
});
