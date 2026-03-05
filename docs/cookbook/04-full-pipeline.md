# Recipe 4: Full Pipeline

Run the complete pipeline from object to saved schema to multi-framework code generation.

## Problem

You want to take the Invoice object and produce a complete detail view: compose the UI, validate it, render a preview, generate code in React + Vue + HTML with Tailwind styling, and save the schema for reuse.

## Step 1: Run the pipeline

```json
// pipeline
{
  "object": "Invoice",
  "context": "detail",
  "layout": "detail",
  "framework": "react",
  "styling": "tailwind",
  "save": "invoice-detail",
  "options": {
    "skipValidation": false,
    "skipRender": false,
    "checkA11y": true,
    "renderApply": true
  }
}
```

**Expected output:**

```json
{
  "schemaRef": "ref:pipeline-inv-001",
  "compose": {
    "object": "Invoice",
    "context": "detail",
    "layout": "detail",
    "componentCount": 8
  },
  "validation": {
    "status": "ok",
    "errors": [],
    "warnings": []
  },
  "render": {
    "html": "<div data-component=\"DetailLayout\" ...>...</div>",
    "meta": {
      "componentCount": 8,
      "renderedCount": 8,
      "cssFragments": 5
    }
  },
  "code": {
    "framework": "react",
    "styling": "tailwind",
    "output": "import { cva } from 'class-variance-authority';\n\nexport function InvoiceDetail() {\n  return (\n    <div className=\"...\">\n      ...\n    </div>\n  );\n}"
  },
  "saved": {
    "name": "invoice-detail",
    "version": 1
  },
  "pipeline": {
    "steps": ["compose", "validate", "render", "codegen", "save"],
    "stepLatency": {
      "compose": 45,
      "validate": 12,
      "render": 28,
      "codegen": 18,
      "save": 5
    },
    "duration": 108
  }
}
```

## Step 2: Generate Vue code from the saved schema

```json
// schema.load
{
  "name": "invoice-detail"
}
```

Returns `schemaRef` from the saved schema, then:

```json
// code.generate
{
  "schemaRef": "ref:saved-inv-detail",
  "framework": "vue",
  "options": {
    "typescript": true,
    "styling": "tailwind"
  }
}
```

**Expected output (abbreviated):**

```json
{
  "status": "ok",
  "framework": "vue",
  "code": "<script setup lang=\"ts\">\n...\n</script>\n\n<template>\n  <div class=\"...\">\n    ...\n  </div>\n</template>",
  "fileExtension": ".vue",
  "imports": ["class-variance-authority"]
}
```

## Step 3: Generate HTML for email or static preview

```json
// code.generate
{
  "schemaRef": "ref:saved-inv-detail",
  "framework": "html",
  "options": {
    "typescript": false,
    "styling": "inline"
  }
}
```

The HTML emitter produces self-contained markup with inline styles, suitable for emails or static previews.

## Key Takeaways

- The `pipeline` tool runs all steps in a single call with step-level latency reporting
- `save` parameter persists the schema for multi-framework code generation
- Saved schemas are loaded via `schema.load` and produce a new `schemaRef`
- Same schema, three frameworks: React (TSX), Vue (SFC), HTML (inline styles)
- `checkA11y: true` runs WCAG contrast checks during validation
