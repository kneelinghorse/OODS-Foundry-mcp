# Recipe 2: Dashboard with Charts

Compose bar and line visualizations, then assemble them into a dashboard layout.

## Problem

You want a subscription analytics dashboard with a bar chart showing monthly revenue and a line chart showing subscriber growth over time. Both should use the Subscription object's data bindings.

## Step 1: Compose bar chart (revenue)

```json
// viz.compose
{
  "object": "Subscription",
  "chartType": "bar",
  "dataBindings": {
    "x": "billingPeriod",
    "y": "amount",
    "color": "status"
  },
  "options": {
    "validate": true
  }
}
```

**Expected output (abbreviated):**

```json
{
  "status": "ok",
  "chartType": "bar",
  "schemaRef": "ref:viz-bar-001",
  "slots": [
    { "slotName": "chart-area", "component": "BarChart", "props": { "xField": "billingPeriod", "yField": "amount" } },
    { "slotName": "legend", "component": "ChartLegend", "props": { "colorField": "status" } },
    { "slotName": "axis-config", "component": "AxisConfig", "props": {} }
  ],
  "meta": {
    "traitsResolved": ["SaaSBillingBillable"],
    "encodingsApplied": ["x", "y", "color"],
    "componentCount": 4
  }
}
```

## Step 2: Compose line chart (subscriber growth)

```json
// viz.compose
{
  "object": "Subscription",
  "chartType": "line",
  "dataBindings": {
    "x": "startDate",
    "y": "subscriberCount"
  }
}
```

**Expected output (abbreviated):**

```json
{
  "status": "ok",
  "chartType": "line",
  "schemaRef": "ref:viz-line-001",
  "slots": [
    { "slotName": "chart-area", "component": "LineChart", "props": { "xField": "startDate", "yField": "subscriberCount" } },
    { "slotName": "axis-config", "component": "AxisConfig", "props": {} }
  ]
}
```

## Step 3: Compose dashboard layout

```json
// design.compose
{
  "intent": "analytics dashboard with subscription metrics",
  "object": "Subscription",
  "layout": "dashboard",
  "preferences": {
    "metricColumns": 4
  }
}
```

**Expected output (abbreviated):**

```json
{
  "status": "ok",
  "layout": "dashboard",
  "schemaRef": "ref:dash-001",
  "selections": [
    { "slotName": "metric-0", "selectedComponent": "MetricCard" },
    { "slotName": "metric-1", "selectedComponent": "MetricCard" },
    { "slotName": "metric-2", "selectedComponent": "MetricCard" },
    { "slotName": "metric-3", "selectedComponent": "MetricCard" },
    { "slotName": "main-chart", "selectedComponent": "ChartPanel" },
    { "slotName": "secondary-chart", "selectedComponent": "ChartPanel" }
  ]
}
```

## Step 4: Generate the dashboard code

```json
// code.generate
{
  "schemaRef": "ref:dash-001",
  "framework": "react",
  "options": {
    "typescript": true,
    "styling": "tokens"
  }
}
```

## Key Takeaways

- `viz.compose` creates self-contained chart schemas with data bindings
- `design.compose` with `layout: "dashboard"` provides metric card slots and chart panels
- Chart schemas (via schemaRef) can be embedded into dashboard slots
- The `metricColumns` preference controls how many KPI cards appear
