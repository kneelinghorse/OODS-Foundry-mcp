# Recipe 3: Multi-Brand Theming

Apply different brand configurations and build themed token artifacts.

## Problem

You need to render the same UI for two different brands. Brand A uses a blue primary palette; Brand B uses a green palette with different typography. You want to compose once, then build tokens for each brand.

## Step 1: Compose the UI once

```json
// design.compose
{
  "object": "User",
  "context": "detail",
  "layout": "detail"
}
```

Save the resulting `schemaRef` (e.g., `"ref:user-detail-001"`) for reuse.

## Step 2: Build tokens for Brand A (default)

```json
// tokens.build
{
  "brand": "A",
  "theme": "light",
  "apply": true
}
```

**Expected output (abbreviated):**

```json
{
  "artifacts": [
    "packages/tokens/dist/css/variables.css",
    "packages/tokens/dist/css/brand-a.css"
  ],
  "transcriptPath": "artifacts/transcripts/tokens-build-<id>.json"
}
```

## Step 3: Apply Brand B overlay

```json
// brand.apply
{
  "brand": "A",
  "delta": {
    "color.primary.500": { "$value": "#16a34a" },
    "color.primary.600": { "$value": "#15803d" },
    "color.primary.700": { "$value": "#166534" },
    "font.family.heading": { "$value": "'Inter', sans-serif" },
    "font.family.body": { "$value": "'Noto Sans', sans-serif" }
  },
  "strategy": "patch",
  "apply": true,
  "preview": {
    "verbosity": "full"
  }
}
```

**Expected output (abbreviated):**

```json
{
  "artifacts": [
    "packages/tokens/overlays/brand-b-patch.json"
  ],
  "preview": {
    "summary": "5 token overrides applied via patch strategy",
    "diffs": [
      {
        "path": "color.primary.500",
        "status": "modified",
        "structured": { "type": "json", "before": "#2563eb", "after": "#16a34a" }
      }
    ]
  }
}
```

## Step 4: Rebuild tokens with the overlay

```json
// tokens.build
{
  "brand": "A",
  "theme": "light",
  "apply": true
}
```

Now the token output reflects Brand B's green palette and Inter typography.

## Step 5: Render both brands

```json
// repl.render (Brand A)
{
  "schemaRef": "ref:user-detail-001",
  "apply": true,
  "output": { "format": "document" }
}
```

The same schema renders with different visual treatments depending on which token artifacts are active.

## Key Takeaways

- Compose once, theme many times: the UiSchema is brand-agnostic
- `brand.apply` with `strategy: "patch"` overwrites specific tokens via RFC 6902 semantics
- `brand.apply` with `strategy: "alias"` creates alias references instead of direct overrides
- `preview.verbosity: "full"` shows before/after diffs for each changed token
- Token rebuild picks up overlays automatically
