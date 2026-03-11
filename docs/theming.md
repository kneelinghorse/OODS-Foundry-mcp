# OODS Foundry Theming Guide

OODS Foundry supports multi-brand theming through DTCG design tokens and the `brand.apply` MCP tool. This guide covers built-in brand presets and how to create custom themes.

## Brand Presets

Three ready-to-use brand presets are included in `packages/tokens/src/presets/`:

### Corporate Blue

**File:** `corporate-blue.json`

Professional, trust-forward palette with deep blue primaries and neutral grays. Best for B2B dashboards, enterprise tools, and financial interfaces.

- Primary: Deep corporate blue (`oklch(0.48 0.2 250)`)
- Canvas: Near-white with cool undertone
- Text: High-contrast near-black
- Accent: Blue highlights and links

### Startup Warm

**File:** `startup-warm.json`

Friendly, approachable palette with coral/orange primaries and warm neutrals. Best for consumer apps, onboarding flows, and creative tools.

- Primary: Vibrant coral (`oklch(0.65 0.2 30)`)
- Canvas: Warm off-white with peach undertone
- Text: Warm dark brown
- Accent: Coral highlights and CTAs

### Dark Minimal

**File:** `dark-minimal.json`

Sleek dark-mode palette with muted green accents and low-chroma neutrals. Best for developer tools, code editors, terminal UIs, and monitoring dashboards.

- Primary: Muted green (`oklch(0.65 0.15 155)`)
- Canvas: Near-black immersive background
- Text: Light gray on dark
- Accent: Green highlights

## Applying a Preset

Use `brand.apply` with the preset as the delta:

```json
// Dry run — preview changes without writing
{
  "delta": <contents of corporate-blue.json>,
  "apply": false
}

// Apply — write changes to disk
{
  "delta": <contents of corporate-blue.json>,
  "apply": true
}
```

The preset deep-merges into the existing brand A tokens across all themes (base, dark, high-contrast).

## How It Works

1. Each preset is a DTCG-compliant JSON file targeting `color.brand.A.*` tokens
2. `brand.apply` deep-merges the preset delta into `packages/tokens/src/tokens/brands/A/{base,dark,hc}.json`
3. Run `tokens.build` after applying to generate compiled CSS variables
4. The theme is reflected in all rendered components via CSS custom properties

## Creating Custom Presets

To create a new preset:

1. Copy an existing preset as a starting point
2. Modify the oklch color values to match your brand
3. Ensure all interactive states maintain sufficient contrast ratios:
   - Primary text on canvas: >= 4.5:1 (AA)
   - Text on interactive surfaces: >= 4.5:1 (AA)
   - Disabled text: >= 3:1
4. Save to `packages/tokens/src/presets/`
5. Test with `brand.apply` in dry-run mode first

### Token Structure

Each preset should include at minimum:

| Token Group | Purpose |
|------------|---------|
| `surface.canvas` | Main background |
| `surface.raised` | Card/panel backgrounds |
| `surface.interactive.primary.*` | Button/CTA states (default, hover, pressed) |
| `text.primary` | Body text |
| `text.secondary` | Labels and metadata |
| `text.accent` | Links and highlights |
| `text.onInteractive` | Text on interactive surfaces |
| `border.subtle` | Card/input borders |
| `border.strong` | Focus/separator borders |
| `accent.*` | Accent surface, border, text |

### Color Format

All colors use the oklch color space for perceptual uniformity:

```
oklch(lightness chroma hue)
```

- **Lightness:** 0 (black) to 1 (white)
- **Chroma:** 0 (gray) to ~0.4 (maximum saturation)
- **Hue:** 0-360 degrees (red=25, orange=60, yellow=90, green=155, blue=250, purple=310)

## Stage1 Integration

When Stage1 Inspector extracts tokens from a live application, they can be converted to an OODS brand preset using the token path translation table in [stage1-oods-contract.md](integration/stage1-oods-contract.md).
