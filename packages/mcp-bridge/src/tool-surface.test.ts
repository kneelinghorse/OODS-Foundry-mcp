import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import { bridgeConfig } from './config.js';
import { resolveBridgeToolSurface } from './tool-surface.js';

const serverCwd = fileURLToPath(new URL('../../mcp-server/', import.meta.url));

describe('resolveBridgeToolSurface', () => {
  it('uses only auto tools for the default toolset', () => {
    const surface = resolveBridgeToolSurface(
      serverCwd,
      bridgeConfig.tools.allowed,
      { MCP_TOOLSET: 'default', MCP_EXTRA_TOOLS: '' } as NodeJS.ProcessEnv,
    );

    expect(surface.toolsetMode).toBe('default');
    expect(surface.enabled).toContain('design.compose');
    expect(surface.enabled).not.toContain('reviewKit.create');
  });

  it('includes on-demand tools when MCP_TOOLSET=all', () => {
    const surface = resolveBridgeToolSurface(
      serverCwd,
      bridgeConfig.tools.allowed,
      { MCP_TOOLSET: 'all', MCP_EXTRA_TOOLS: '' } as NodeJS.ProcessEnv,
    );

    expect(surface.toolsetMode).toBe('all');
    expect(surface.enabled).toContain('reviewKit.create');
    expect(surface.enabled).toContain('a11y.scan');
  });

  it('adds explicit extras and reports unknown extras', () => {
    const surface = resolveBridgeToolSurface(
      serverCwd,
      bridgeConfig.tools.allowed,
      {
        MCP_TOOLSET: 'default',
        MCP_EXTRA_TOOLS: 'reviewKit.create,unknown.tool',
      } as NodeJS.ProcessEnv,
    );

    expect(surface.enabled).toContain('reviewKit.create');
    expect(surface.unknownExtras).toEqual(['unknown.tool']);
    expect(surface.registrySource).toMatch(/tools\/registry\.json$/);
  });
});
