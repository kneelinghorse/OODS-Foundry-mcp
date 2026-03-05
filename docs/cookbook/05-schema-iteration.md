# Recipe 5: Schema Iteration

Save a schema, load it back, compose with overrides, and re-save.

## Problem

You composed a User detail view but want to iterate: change the tab labels, override a component, and save a new version. This shows the save/load/modify/re-save workflow.

## Step 1: Initial compose and save

```json
// design.compose
{
  "object": "User",
  "context": "detail",
  "layout": "detail",
  "preferences": {
    "tabCount": 3,
    "tabLabels": ["Profile", "Settings", "Activity"]
  }
}
```

Save the result:

```json
// schema.save
{
  "name": "user-detail",
  "schemaRef": "ref:user-001",
  "tags": ["identity", "v1"],
  "author": "design-agent"
}
```

**Expected output:**

```json
{
  "name": "user-detail",
  "version": 1,
  "object": "User",
  "context": "detail",
  "author": "design-agent",
  "createdAt": "2026-03-05T10:00:00Z",
  "updatedAt": "2026-03-05T10:00:00Z",
  "tags": ["identity", "v1"]
}
```

## Step 2: List schemas to confirm

```json
// schema.list
{
  "object": "User",
  "tags": ["identity"]
}
```

**Expected output:**

```json
[
  {
    "name": "user-detail",
    "version": 1,
    "object": "User",
    "context": "detail",
    "tags": ["identity", "v1"]
  }
]
```

## Step 3: Load the schema back

```json
// schema.load
{
  "name": "user-detail"
}
```

**Expected output:**

```json
{
  "schemaRef": "ref:loaded-user-001",
  "name": "user-detail",
  "version": 1,
  "object": "User",
  "context": "detail",
  "tags": ["identity", "v1"]
}
```

## Step 4: Compose again with modifications

Now recompose with updated preferences:

```json
// design.compose
{
  "object": "User",
  "context": "detail",
  "layout": "detail",
  "preferences": {
    "tabCount": 4,
    "tabLabels": ["Profile", "Security", "Notifications", "Activity"],
    "componentOverrides": {
      "tab-1": "SecurityPanel"
    }
  }
}
```

This produces a new schema with 4 tabs and a SecurityPanel override in the second tab.

## Step 5: Save as a new version

```json
// schema.save
{
  "name": "user-detail",
  "schemaRef": "ref:user-002",
  "tags": ["identity", "v2", "security"],
  "author": "design-agent"
}
```

**Expected output:**

```json
{
  "name": "user-detail",
  "version": 2,
  "object": "User",
  "context": "detail",
  "author": "design-agent",
  "createdAt": "2026-03-05T10:00:00Z",
  "updatedAt": "2026-03-05T10:05:00Z",
  "tags": ["identity", "v2", "security"]
}
```

## Step 6: Generate code from the latest version

```json
// schema.load
{
  "name": "user-detail"
}
```

Always loads the latest version (v2), then:

```json
// code.generate
{
  "schemaRef": "ref:loaded-user-002",
  "framework": "react",
  "options": {
    "typescript": true,
    "styling": "tokens"
  }
}
```

## Key Takeaways

- `schema.save` auto-increments the version when saving to the same name
- `schema.load` always returns the latest version
- Tags let you filter and organize saved schemas
- The compose/save/load cycle enables iterative refinement without losing history
- `componentOverrides` in preferences lets you swap specific slot components
