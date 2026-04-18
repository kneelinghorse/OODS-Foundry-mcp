import { once } from 'node:events';
import { spawn, type ChildProcessWithoutNullStreams } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

export type BridgeProcess = {
  child: ChildProcessWithoutNullStreams;
  port: number;
};

const BUILD_LOCK_DIR = path.join(os.tmpdir(), 'oods-mcp-bridge-build-lock');
const BUILD_LOCK_POLL_MS = 100;
const BUILD_LOCK_TIMEOUT_MS = 180_000;

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function acquireBuildLock(): Promise<void> {
  const startedAt = Date.now();

  while (true) {
    try {
      fs.mkdirSync(BUILD_LOCK_DIR);
      return;
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code !== 'EEXIST') {
        throw error;
      }
    }

    if (Date.now() - startedAt >= BUILD_LOCK_TIMEOUT_MS) {
      throw new Error(`Timed out waiting for bridge build lock at ${BUILD_LOCK_DIR}`);
    }

    await sleep(BUILD_LOCK_POLL_MS);
  }
}

function releaseBuildLock(): void {
  fs.rmSync(BUILD_LOCK_DIR, { recursive: true, force: true });
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

async function startBridge(bridgeDir: string, extraEnv?: Record<string, string>): Promise<BridgeProcess> {
  const child = spawn(process.execPath, ['dist/server.js'], {
    cwd: bridgeDir,
    stdio: ['ignore', 'pipe', 'pipe'],
    env: {
      ...process.env,
      MCP_BRIDGE_PORT: '0',
      ...extraEnv,
    },
  });
  child.stdout.setEncoding('utf8');
  child.stderr.setEncoding('utf8');

  return await new Promise<BridgeProcess>((resolve, reject) => {
    let resolved = false;
    const stdoutChunks: string[] = [];
    const stderrChunks: string[] = [];
    const timeout = setTimeout(() => {
      if (resolved) return;
      resolved = true;
      reject(
        new Error(
          `Timed out waiting for bridge startup.\nstdout: ${stdoutChunks.join('')}\nstderr: ${stderrChunks.join('')}`,
        ),
      );
    }, 20_000);

    function maybeResolve(chunk: string): void {
      const match = chunk.match(/\[mcp-bridge\] listening on :(\d+)/);
      if (!match || resolved) return;
      resolved = true;
      clearTimeout(timeout);
      resolve({ child, port: Number(match[1]) });
    }

    child.stdout.on('data', (chunk: string) => {
      stdoutChunks.push(chunk);
      maybeResolve(chunk);
    });
    child.stderr.on('data', (chunk: string) => {
      stderrChunks.push(chunk);
      maybeResolve(chunk);
    });

    child.once('close', (code) => {
      if (resolved) return;
      resolved = true;
      clearTimeout(timeout);
      reject(
        new Error(
          `Bridge exited before startup (code=${String(code)}).\nstdout: ${stdoutChunks.join('')}\nstderr: ${stderrChunks.join('')}`,
        ),
      );
    });
  });
}

export async function buildAndStartBridge(options: {
  repoRoot: string;
  bridgeDir: string;
  extraEnv?: Record<string, string>;
}): Promise<BridgeProcess> {
  await acquireBuildLock();
  try {
    await runCommand('pnpm', ['--filter', '@oods/mcp-server', 'run', 'build'], options.repoRoot);
    await runCommand('pnpm', ['--filter', '@oods/mcp-bridge', 'run', 'build'], options.repoRoot);
    return await startBridge(options.bridgeDir, options.extraEnv);
  } finally {
    releaseBuildLock();
  }
}

export async function stopBridge(proc: BridgeProcess): Promise<void> {
  proc.child.kill('SIGTERM');
  await once(proc.child, 'close');
}
