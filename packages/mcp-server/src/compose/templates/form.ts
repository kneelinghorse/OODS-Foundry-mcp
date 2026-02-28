/**
 * Form layout template.
 *
 * Structure:
 *   Screen (Stack, vertical)
 *   ├── title      – slot: form heading
 *   ├── fields     – Stack with N field groups
 *   └── actions    – inline action bar (submit / cancel)
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

export interface FormOptions {
  /** Number of field groups / sections (default: 3). */
  fieldGroups?: number;
  /** Show a banner above the form (e.g. validation summary) (default: false). */
  includeBanner?: boolean;
  /** Theme token (optional). */
  theme?: string;
}

export function formTemplate(opts: FormOptions = {}): TemplateResult {
  resetIdCounter();
  const { fieldGroups = 3, includeBanner = false, theme } = opts;

  const slots: Slot[] = [
    { name: 'title', description: 'Form heading', intent: 'page-header', required: true },
    { name: 'actions', description: 'Submit / cancel buttons', intent: 'action-button', required: true },
  ];

  // Add per-field-group slots
  for (let i = 0; i < fieldGroups; i++) {
    slots.push({
      name: `field-${i}`,
      description: `Form field group ${i + 1}`,
      intent: 'form-input',
      required: i === 0,
    });
  }

  const children: UiElement[] = [];

  // -- optional banner --
  if (includeBanner) {
    slots.push({
      name: 'banner',
      description: 'Validation or info banner',
      intent: 'status-indicator',
      required: false,
    });
    children.push({
      id: uid('form-banner'),
      component: 'Banner',
      children: [slotElement('banner', 'status-indicator', 'Text')],
    });
  }

  // -- title slot --
  children.push({
    id: uid('form-title'),
    component: 'Text',
    props: { as: 'h1' },
    meta: { intent: 'slot:title', label: 'title' },
  });

  // -- field groups --
  const fieldChildren: UiElement[] = [];
  for (let i = 0; i < fieldGroups; i++) {
    fieldChildren.push({
      id: uid('form-field-group'),
      component: 'Stack',
      layout: { type: 'stack', gapToken: 'cluster-tight' },
      children: [slotElement(`field-${i}`, 'form-input')],
    });
  }
  children.push({
    id: uid('form-fields'),
    component: 'Stack',
    layout: { type: 'stack', gapToken: 'cluster-default' },
    children: fieldChildren,
  });

  // -- action bar --
  children.push({
    id: uid('form-actions'),
    component: 'Stack',
    layout: { type: 'inline', align: 'end' },
    style: { spacingToken: 'inset-default' },
    children: [slotElement('actions', 'action-button')],
  });

  // -- screen root --
  const screen: UiElement = {
    id: uid('screen-form'),
    component: 'Stack',
    layout: { type: 'stack', gapToken: 'cluster-default' },
    style: { spacingToken: 'inset-default' },
    children,
  };

  return { schema: wrapSchema(screen, theme), slots };
}
