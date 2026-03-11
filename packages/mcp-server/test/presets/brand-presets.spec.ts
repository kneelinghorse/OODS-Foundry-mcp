import { describe, it, expect } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const PRESETS_DIR = path.resolve(
  fileURLToPath(new URL('../../../../packages/tokens/src/presets', import.meta.url)),
);

const BRAND_A_BASE = path.resolve(
  fileURLToPath(new URL('../../../../packages/tokens/src/tokens/brands/A/base.json', import.meta.url)),
);

const PRESET_FILES = ['corporate-blue.json', 'startup-warm.json', 'dark-minimal.json'];

describe('brand presets', () => {
  const brandABase = JSON.parse(fs.readFileSync(BRAND_A_BASE, 'utf8'));

  for (const presetFile of PRESET_FILES) {
    describe(presetFile, () => {
      const presetPath = path.join(PRESETS_DIR, presetFile);
      const preset = JSON.parse(fs.readFileSync(presetPath, 'utf8'));

      it('is valid JSON with $schema and $description', () => {
        expect(preset.$schema).toBe('https://design-tokens.org/dtcg/schema.json');
        expect(preset.$description).toBeTruthy();
      });

      it('targets brand A color tokens', () => {
        expect(preset.color).toBeDefined();
        expect(preset.color.brand).toBeDefined();
        expect(preset.color.brand.A).toBeDefined();
      });

      it('includes surface, text, and border tokens', () => {
        const brandA = preset.color.brand.A;
        expect(brandA.surface).toBeDefined();
        expect(brandA.text).toBeDefined();
        expect(brandA.border).toBeDefined();
      });

      it('includes interactive primary states (default, hover, pressed)', () => {
        const interactive = preset.color.brand.A.surface.interactive.primary;
        expect(interactive.default).toBeDefined();
        expect(interactive.hover).toBeDefined();
        expect(interactive.pressed).toBeDefined();
      });

      it('all color tokens use oklch format', () => {
        const tokens: string[] = [];
        function collectValues(obj: any) {
          for (const [key, val] of Object.entries(obj)) {
            if (key === '$value' && typeof val === 'string') {
              tokens.push(val);
            } else if (typeof val === 'object' && val !== null) {
              collectValues(val);
            }
          }
        }
        collectValues(preset);
        expect(tokens.length).toBeGreaterThan(0);
        for (const token of tokens) {
          expect(token).toMatch(/^oklch\(/);
        }
      });

      it('token structure is compatible with brand A base (deep-mergeable)', () => {
        // Verify preset keys exist in brand A base (no orphan paths)
        function checkPaths(presetObj: any, baseObj: any, path = '') {
          for (const [key, val] of Object.entries(presetObj)) {
            if (key.startsWith('$')) continue; // skip DTCG meta keys
            const currentPath = `${path}.${key}`;
            if (typeof val === 'object' && val !== null && !('$value' in val)) {
              // Nested group — base should have it too
              expect(baseObj[key], `Missing base path: ${currentPath}`).toBeDefined();
              checkPaths(val, baseObj[key], currentPath);
            }
          }
        }
        checkPaths(preset.color.brand.A, brandABase.color.brand.A);
      });

      it('includes accent tokens', () => {
        expect(preset.color.brand.A.accent).toBeDefined();
        expect(preset.color.brand.A.accent.background).toBeDefined();
        expect(preset.color.brand.A.accent.border).toBeDefined();
        expect(preset.color.brand.A.accent.text).toBeDefined();
      });
    });
  }

  it('presets produce visually distinct palettes', () => {
    const primaries = PRESET_FILES.map((f) => {
      const preset = JSON.parse(fs.readFileSync(path.join(PRESETS_DIR, f), 'utf8'));
      return preset.color.brand.A.surface.interactive.primary.default.$value;
    });
    // All primary colors should be different
    const unique = new Set(primaries);
    expect(unique.size).toBe(PRESET_FILES.length);
  });
});
