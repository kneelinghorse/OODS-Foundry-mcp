import path from 'node:path';
import fs from 'node:fs';
import { fileURLToPath } from 'node:url';
import { spawn } from 'node:child_process';
import { todayDir, loadPolicy, withinAllowed } from '../lib/security.js';
import { writeTranscript, writeBundleIndex, sha256File } from '../lib/transcript.js';
import type { TokensBuildInput, GenericOutput, ToolPreview, ArtifactDetail } from './types.js';

type TokensBuildOutputs = {
  css: string;
  ts: string;
  tailwind: string;
};

const MCP_SERVER_DIR = path.resolve(fileURLToPath(new URL('../..', import.meta.url)));
const REPO_ROOT = path.resolve(MCP_SERVER_DIR, '..', '..');
const TOKENS_DIST_DIR = path.join(REPO_ROOT, 'packages', 'tokens', 'dist');
const TOKENS_BUILD_SCRIPT = path.join(REPO_ROOT, 'packages', 'tokens', 'scripts', 'build.mjs');

function isNonEmptyFile(filePath: string): boolean {
  try {
    const stat = fs.statSync(filePath);
    return stat.isFile() && stat.size > 0;
  } catch {
    return false;
  }
}

async function runTokensBuild(): Promise<void> {
  await new Promise<void>((resolve, reject) => {
    const child = spawn('node', [TOKENS_BUILD_SCRIPT], {
      cwd: REPO_ROOT,
      stdio: ['ignore', 'pipe', 'pipe'],
    });
    let stderr = '';
    child.stderr?.on('data', (chunk) => {
      stderr += chunk.toString();
    });
    child.on('error', (error) => reject(error));
    child.on('close', (code) => {
      if (code === 0) {
        resolve();
      } else {
        const message = stderr.trim();
        reject(new Error(`tokens build failed (exit ${code})${message ? `: ${message}` : ''}`));
      }
    });
  });
}

async function ensureTokensBuildOutputs(): Promise<TokensBuildOutputs> {
  const outputs: TokensBuildOutputs = {
    css: path.join(TOKENS_DIST_DIR, 'css', 'tokens.css'),
    ts: path.join(TOKENS_DIST_DIR, 'ts', 'tokens.ts'),
    tailwind: path.join(TOKENS_DIST_DIR, 'tailwind', 'tokens.json'),
  };

  const missing = Object.values(outputs).some((filePath) => !isNonEmptyFile(filePath));
  if (missing) {
    await runTokensBuild();
  }

  const stillMissing = Object.values(outputs).some((filePath) => !isNonEmptyFile(filePath));
  if (stillMissing) {
    throw new Error('tokens build outputs are missing after running the pipeline');
  }

  return outputs;
}

function ensureAllowed(base: string, candidate: string): void {
  if (!withinAllowed(base, candidate)) {
    throw new Error(`Path not allowed: ${candidate}`);
  }
  fs.mkdirSync(path.dirname(candidate), { recursive: true });
}

function recordArtifact(
  filePath: string,
  name: string,
  purpose: string,
  artifacts: string[],
  details: ArtifactDetail[],
): void {
  artifacts.push(filePath);
  try {
    const stat = fs.statSync(filePath);
    details.push({
      path: filePath,
      name,
      purpose,
      sha256: sha256File(filePath),
      sizeBytes: stat.size,
    });
  } catch {
    // ignore missing stats; verification will catch missing files
  }
}

export async function handle(input: TokensBuildInput = {}): Promise<GenericOutput> {
  const policy = loadPolicy();
  const base = todayDir(policy.artifactsBase);
  const outDir = path.join(base, 'tokens.build');
  const startedAt = new Date();
  const artifacts: string[] = [];
  const details: ArtifactDetail[] = [];
  let preview: ToolPreview | undefined;

  fs.mkdirSync(outDir, { recursive: true });

  const brand = input.brand ?? 'A';
  const theme = input.theme ?? 'dark';

  if (input.apply) {
    const outputs = await ensureTokensBuildOutputs();

    const tailwindPayload = JSON.parse(fs.readFileSync(outputs.tailwind, 'utf8')) as Record<string, unknown>;
    const tokensPayload = {
      ...tailwindPayload,
      meta: {
        ...(typeof tailwindPayload.meta === 'object' && tailwindPayload.meta ? tailwindPayload.meta : {}),
        brand,
        theme,
      },
    };

    const themeFile = path.join(outDir, `tokens.${theme}.json`);
    ensureAllowed(policy.artifactsBase, themeFile);
    fs.writeFileSync(themeFile, JSON.stringify(tokensPayload, null, 2), 'utf8');
    recordArtifact(
      themeFile,
      `tokens.${theme}.json`,
      'Compiled token payload (brand + theme context).',
      artifacts,
      details,
    );

    const cssOut = path.join(outDir, 'tokens.css');
    ensureAllowed(policy.artifactsBase, cssOut);
    fs.copyFileSync(outputs.css, cssOut);
    recordArtifact(cssOut, 'tokens.css', 'Compiled CSS custom properties.', artifacts, details);

    const tsOut = path.join(outDir, 'tokens.ts');
    ensureAllowed(policy.artifactsBase, tsOut);
    fs.copyFileSync(outputs.ts, tsOut);
    recordArtifact(tsOut, 'tokens.ts', 'Compiled TypeScript token map.', artifacts, details);

    const tailwindOut = path.join(outDir, 'tokens.tailwind.json');
    ensureAllowed(policy.artifactsBase, tailwindOut);
    fs.copyFileSync(outputs.tailwind, tailwindOut);
    recordArtifact(tailwindOut, 'tokens.tailwind.json', 'Tailwind-compatible token JSON.', artifacts, details);
  } else {
    const expected = [
      `tokens.${theme}.json`,
      'tokens.css',
      'tokens.ts',
      'tokens.tailwind.json',
    ];
    preview = {
      summary: `Preview only: would build ${expected.length} token artifact${expected.length === 1 ? '' : 's'} for brand ${brand} (${theme} theme).`,
      notes: expected.map((name) => `artifact: ${name}`),
      specimens: expected.map((name) => path.join(outDir, name)),
    };
  }

  const transcriptPath = writeTranscript(outDir, {
    tool: 'tokens.build',
    input,
    apply: Boolean(input.apply),
    artifacts,
    startTime: startedAt,
    endTime: new Date(),
  });
  const bundleIndexPath = writeBundleIndex(outDir, [transcriptPath, ...artifacts]);
  return {
    artifacts,
    transcriptPath,
    bundleIndexPath,
    ...(preview ? { preview } : {}),
    ...(details.length ? { artifactsDetail: details } : {}),
  };
}
