/**
 * Dashboard layout template.
 *
 * Structure:
 *   Screen (Stack, vertical)
 *   ├── header        – slot: page title / breadcrumbs
 *   ├── metrics-grid  – Grid with N metric cards
 *   └── body (sidebar layout)
 *       ├── main-content – slot: primary content area
 *       └── sidebar      – slot: side panel / filters
 */
import type { UiElement } from '../../schemas/generated.js';
import {
  type Slot,
  type TemplateResult,
  resetIdCounter,
  uid,
  wrapSchema,
  slotElement,
} from './types.js';

export interface DashboardOptions {
  /** Number of metric card columns (default: 4). */
  metricColumns?: number;
  /** Whether to include the sidebar (default: true). */
  includeSidebar?: boolean;
  /** Theme token (optional). */
  theme?: string;
}

export function dashboardTemplate(opts: DashboardOptions = {}): TemplateResult {
  resetIdCounter();
  const { metricColumns = 4, includeSidebar = true, theme } = opts;

  const slots: Slot[] = [
    { name: 'header', description: 'Page header area', intent: 'page-header', required: true },
    { name: 'metrics', description: 'Metric display cards', intent: 'metrics-display', required: true },
    { name: 'main-content', description: 'Primary content area', intent: 'data-display', required: true },
  ];

  // -- header slot --
  const header: UiElement = {
    id: uid('dashboard-header'),
    component: 'Stack',
    layout: { type: 'inline', align: 'space-between' },
    style: { spacingToken: 'inset-default' },
    children: [slotElement('header', 'page-header', 'Text')],
  };

  // -- metrics grid --
  const metricsGrid: UiElement = {
    id: uid('dashboard-metrics'),
    component: 'Grid',
    props: { columns: metricColumns, gap: 'cluster-default' },
    children: [slotElement('metrics', 'metrics-display')],
  };

  // -- main content --
  const mainContent: UiElement = {
    id: uid('dashboard-main'),
    component: 'Stack',
    layout: { type: 'stack', gapToken: 'cluster-default' },
    children: [slotElement('main-content', 'data-display')],
  };

  // -- body (with or without sidebar) --
  let body: UiElement;
  if (includeSidebar) {
    slots.push({
      name: 'sidebar',
      description: 'Side panel for filters or navigation',
      intent: 'navigation-panel',
      required: false,
    });

    body = {
      id: uid('dashboard-body'),
      component: 'Card',
      layout: { type: 'sidebar', gapToken: 'cluster-default' },
      children: [
        mainContent,
        {
          id: uid('dashboard-sidebar'),
          component: 'Stack',
          layout: { type: 'stack', gapToken: 'cluster-tight' },
          style: { spacingToken: 'inset-default' },
          children: [slotElement('sidebar', 'navigation-panel')],
        },
      ],
    };
  } else {
    body = mainContent;
  }

  // -- screen root --
  const screen: UiElement = {
    id: uid('screen-dashboard'),
    component: 'Stack',
    layout: { type: 'stack', gapToken: 'cluster-default' },
    children: [header, metricsGrid, body],
  };

  return { schema: wrapSchema(screen, theme), slots };
}
