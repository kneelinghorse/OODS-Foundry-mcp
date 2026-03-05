# Recipe 1: List to Detail

Compose a searchable product list, then a detail view for a selected item.

## Problem

You need a two-view pattern: a filterable product catalog list that links to a detail page for each product. The Product object has Searchable, Filterable, and Pageable behavioral traits that should drive the list layout.

## Step 1: Compose the list view

```json
// design.compose
{
  "object": "Product",
  "context": "list",
  "layout": "list",
  "preferences": {
    "componentOverrides": {}
  },
  "options": {
    "validate": true,
    "topN": 3
  }
}
```

**Expected output (abbreviated):**

```json
{
  "status": "ok",
  "layout": "list",
  "schemaRef": "ref:abc123",
  "selections": [
    {
      "slotName": "header",
      "selectedComponent": "SearchInput",
      "candidates": [
        { "name": "SearchInput", "confidence": 0.95, "reason": "Searchable trait" }
      ]
    },
    {
      "slotName": "items",
      "selectedComponent": "ProductCard",
      "candidates": [
        { "name": "ProductCard", "confidence": 0.88, "reason": "Best match for list context" }
      ]
    },
    {
      "slotName": "footer",
      "selectedComponent": "PaginationBar",
      "candidates": [
        { "name": "PaginationBar", "confidence": 0.92, "reason": "Pageable trait" }
      ]
    }
  ],
  "objectUsed": {
    "name": "Product",
    "traits": ["content/Labelled", "lifecycle/Stateful", "behavioral/Searchable", "behavioral/Filterable", "behavioral/Pageable"],
    "viewExtensionsApplied": { "list": 3 }
  }
}
```

The list view automatically picks up SearchInput, FilterPanel, and PaginationBar from the Product object's behavioral traits.

## Step 2: Compose the detail view

```json
// design.compose
{
  "object": "Product",
  "context": "detail",
  "layout": "detail",
  "preferences": {
    "tabCount": 3,
    "tabLabels": ["Overview", "Pricing", "History"]
  }
}
```

**Expected output (abbreviated):**

```json
{
  "status": "ok",
  "layout": "detail",
  "schemaRef": "ref:def456",
  "selections": [
    { "slotName": "tab-0", "selectedComponent": "SummaryPanel" },
    { "slotName": "tab-1", "selectedComponent": "PriceBreakdown" },
    { "slotName": "tab-2", "selectedComponent": "Timeline" }
  ],
  "objectUsed": {
    "name": "Product",
    "traits": ["content/Labelled", "financial/Priceable", "lifecycle/Timestampable"],
    "viewExtensionsApplied": { "detail": 3 }
  }
}
```

## Step 3: Generate code for both views

```json
// code.generate (list view)
{
  "schemaRef": "ref:abc123",
  "framework": "react",
  "options": {
    "typescript": true,
    "styling": "tailwind"
  }
}
```

```json
// code.generate (detail view)
{
  "schemaRef": "ref:def456",
  "framework": "react",
  "options": {
    "typescript": true,
    "styling": "tailwind"
  }
}
```

Both calls produce typed React components with Tailwind classes, ready to drop into your application.

## Key Takeaways

- The `context` parameter (`list` vs `detail`) controls which view_extensions are applied
- Behavioral traits (Searchable, Filterable, Pageable) automatically inject the right components into list layouts
- You can customize tab labels and structure via `preferences`
- The same object drives both views, ensuring consistent field coverage
