/**
 * Bridge E2E tests for mapping tools and versioned structuredData.fetch (s52-m04).
 *
 * Tests map.create, map.list, map.resolve, and versioned structuredData.fetch
 * through the MCP bridge HTTP transport.
 */
import { once } from 'node:events';
import { spawn, type ChildProcessWithoutNullStreams } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';

type BridgeProcess = {
  child: ChildProcessWithoutNullStreams;
  port: number;
};

const TEST_FILE_DIR = path.dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = path.resolve(TEST_FILE_DIR, '../../../../');
const MCP_BRIDGE_DIR = path.join(REPO_ROOT, 'packages', 'mcp-bridge');
const MAPPINGS_PATH = path.join(REPO_ROOT, 'artifacts', 'structured-data', 'component-mappings.json');

let bridge: BridgeProcess | null = null;
let originalMappings: string | null = null;

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

async function runBridgeTool(port: number, tool: string, input: Record<string, unknown>): Promise<any> {
  const response = await fetch(`http://127.0.0.1:${port}/run`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ tool, input }),
  });
  const payload = await response.json();
  if (!response.ok) {
    throw new Error(`Bridge /run failed (${response.status}): ${JSON.stringify(payload)}`);
  }
  return payload.result;
}

describe('mapping + versioning bridge E2E', () => {
  beforeAll(async () => {
    // Preserve mappings file
    originalMappings = fs.existsSync(MAPPINGS_PATH) ? fs.readFileSync(MAPPINGS_PATH, 'utf8') : null;

    // Reset to empty for clean test
    const empty = {
      $schema: '../../packages/mcp-server/src/schemas/component-mapping.schema.json',
      generatedAt: new Date().toISOString(),
      version: new Date().toISOString().slice(0, 10),
      stats: { mappingCount: 0, systemCount: 0 },
      mappings: [],
    };
    fs.writeFileSync(MAPPINGS_PATH, JSON.stringify(empty, null, 2) + '\n');

    await runCommand('pnpm', ['--filter', '@oods/mcp-server', 'run', 'build'], REPO_ROOT);
    await runCommand('pnpm', ['--filter', '@oods/mcp-bridge', 'run', 'build'], REPO_ROOT);
    bridge = await startBridge();
  }, 60_000);

  afterAll(async () => {
    if (bridge) {
      await stopBridge(bridge);
      bridge = null;
    }
    // Restore mappings file
    if (originalMappings === null) {
      fs.rmSync(MAPPINGS_PATH, { force: true });
    } else {
      fs.writeFileSync(MAPPINGS_PATH, originalMappings);
    }
  });

  it('map.create → map.list → map.resolve round-trip via bridge', async () => {
    // Create a mapping
    const created = await runBridgeTool(bridge!.port, 'map_create', {
      externalSystem: 'e2e-test',
      externalComponent: 'TestButton',
      oodsTraits: ['Stateful'],
      propMappings: [
        { externalProp: 'variant', oodsProp: 'appearance', coercion: { type: 'enum-map', values: { primary: 'primary' } } },
      ],
      confidence: 'auto',
    });

    expect(created.status).toBe('ok');
    expect(created.mapping.id).toBe('e2e-test-test-button');
    expect(created.etag).toMatch(/^[a-f0-9]{64}$/);

    // List mappings
    const listed = await runBridgeTool(bridge!.port, 'map_list', {
      externalSystem: 'e2e-test',
    });

    expect(listed.totalCount).toBeGreaterThanOrEqual(1);
    expect(listed.mappings.some((m: any) => m.id === 'e2e-test-test-button')).toBe(true);

    // Resolve mapping
    const resolved = await runBridgeTool(bridge!.port, 'map_resolve', {
      externalSystem: 'e2e-test',
      externalComponent: 'TestButton',
    });

    expect(resolved.status).toBe('ok');
    expect(resolved.mapping.oodsTraits).toEqual(['Stateful']);
    expect(resolved.propTranslations).toBeInstanceOf(Array);
    expect(resolved.propTranslations.length).toBe(1);
    expect(resolved.propTranslations[0].coercionType).toBe('enum-map');
  });

  it('structuredData.fetch listVersions via bridge', async () => {
    const result = await runBridgeTool(bridge!.port, 'structuredData_fetch', {
      dataset: 'components',
      listVersions: true,
    });

    expect(result.availableVersions).toBeInstanceOf(Array);
    expect(result.availableVersions.length).toBeGreaterThan(0);
    expect(result.payloadIncluded).toBe(false);
  });

  it('structuredData.fetch versioned request via bridge', async () => {
    // Use a known version date
    const versions = await runBridgeTool(bridge!.port, 'structuredData_fetch', {
      dataset: 'components',
      listVersions: true,
    });

    const latestVersion = versions.availableVersions[versions.availableVersions.length - 1];

    const result = await runBridgeTool(bridge!.port, 'structuredData_fetch', {
      dataset: 'components',
      version: latestVersion,
      includePayload: false,
    });

    expect(result.resolvedVersion).toBe(latestVersion);
    expect(result.etag).toMatch(/^[a-f0-9]{64}$/);
    expect(result.payloadIncluded).toBe(false);
  });
});
