import { describe, expect, it } from 'vitest';
import type { UiElement } from '../schemas/generated.js';
import { hasMappedRenderer, renderMappedComponent } from './component-map.js';

function makeNode(component: string, props: Record<string, unknown> = {}, extras: Partial<UiElement> = {}): UiElement {
  return {
    id: extras.id ?? `${component.toLowerCase()}-node`,
    component,
    props,
    children: extras.children,
    layout: extras.layout,
    meta: extras.meta,
    route: extras.route,
    style: extras.style,
    bindings: extras.bindings,
  };
}

describe('component map coverage', () => {
  it('covers required components', () => {
    for (const component of [
      'Button',
      'Card',
      'CardHeader',
      'AddressCollectionPanel',
      'ClassificationPanel',
      'CommunicationDetailPanel',
      'MembershipPanel',
      'PreferencePanel',
      'AddressEditor',
      'ClassificationEditor',
      'PreferenceEditor',
      'RoleAssignmentForm',
      'CancellationForm',
      'TagInput',
      'TagManager',
      'GeoFieldMappingForm',
      'ColorStatePicker',
      'TemplatePicker',
      'AuditTimeline',
      'AddressValidationTimeline',
      'MembershipAuditTimeline',
      'MessageEventTimeline',
      'PreferenceTimeline',
      'StatusTimeline',
      'AuditEvent',
      'ArchiveEvent',
      'CancellationEvent',
      'StateTransitionEvent',
      'RelativeTimestamp',
      'ArchiveSummary',
      'CancellationSummary',
      'OwnershipMeta',
      'OwnershipSummary',
      'PriceCardMeta',
      'PriceSummary',
      'TagPills',
      'TagSummary',
      'StatusSelector',
      'ColorSwatch',
      'StatusColorLegend',
      'GeocodablePreview',
      'VizAreaControls',
      'VizAreaPreview',
      'VizMarkControls',
      'VizMarkPreview',
      'VizLineControls',
      'VizLinePreview',
      'VizPointControls',
      'VizPointPreview',
      'VizColorControls',
      'VizColorLegendConfig',
      'VizEncodingBadge',
      'VizAxisControls',
      'VizAxisSummary',
      'VizSizeControls',
      'VizSizeSummary',
      'VizScaleControls',
      'VizScaleSummary',
      'VizRoleBadge',
      'DetailHeader',
      'FormLabelGroup',
      'InlineLabel',
      'LabelCell',
      'StatusBadge',
      'CancellationBadge',
      'ArchivePill',
      'ColorizedBadge',
      'PreferenceSummaryBadge',
      'ClassificationBadge',
      'OwnerBadge',
      'MessageStatusBadge',
      'GeoResolutionBadge',
      'AddressSummaryBadge',
      'PriceBadge',
      'RoleBadgeList',
      'Stack',
      'Text',
      'Input',
      'Select',
      'Badge',
      'Banner',
      'Table',
      'Tabs',
    ]) {
      expect(hasMappedRenderer(component)).toBe(true);
    }
  });

  it('renders Button with semantic HTML and prop serialization', () => {
    const html = renderMappedComponent(
      makeNode('Button', { type: 'submit', disabled: true, label: 'Save', variant: 'primary', count: 2 })
    );

    expect(html.startsWith('<button')).toBe(true);
    expect(html).toContain('type="submit"');
    expect(html).toContain(' disabled');
    expect(html).toContain('data-oods-component="Button"');
    expect(html).toContain('data-prop-variant="primary"');
    expect(html).toContain('data-prop-count="2"');
    expect(html).toContain('>Save</button>');
  });

  it('renders Card as article', () => {
    const html = renderMappedComponent(makeNode('Card', { elevation: 'md' }), '<p>Content</p>');

    expect(html.startsWith('<article')).toBe(true);
    expect(html).toContain('data-oods-component="Card"');
    expect(html).toContain('data-prop-elevation="md"');
    expect(html).toContain('<p>Content</p>');
  });

  it('renders Stack as div and preserves child HTML', () => {
    const html = renderMappedComponent(makeNode('Stack', { gapToken: 'spacing.md' }), '<span>Row</span>');

    expect(html.startsWith('<div')).toBe(true);
    expect(html).toContain('data-layout="stack"');
    expect(html).toContain('data-prop-gap-token="spacing.md"');
    expect(html).toContain('<span>Row</span>');
  });

  it('renders Text with tag override', () => {
    const html = renderMappedComponent(makeNode('Text', { as: 'h3', text: 'Heading', tone: 'positive' }));

    expect(html.startsWith('<h3')).toBe(true);
    expect(html).toContain('data-oods-component="Text"');
    expect(html).toContain('data-prop-tone="positive"');
    expect(html).toContain('>Heading</h3>');
  });

  it('renders Input as semantic input element', () => {
    const html = renderMappedComponent(
      makeNode('Input', { type: 'email', placeholder: 'name@site.tld', required: true, mask: 'email' })
    );

    expect(html.startsWith('<input')).toBe(true);
    expect(html).toContain('type="email"');
    expect(html).toContain('placeholder="name@site.tld"');
    expect(html).toContain(' required');
    expect(html).toContain('data-prop-mask="email"');
  });

  it('renders Select with option list and selected value', () => {
    const html = renderMappedComponent(
      makeNode('Select', {
        name: 'status',
        value: 'active',
        options: [
          { value: 'draft', label: 'Draft' },
          { value: 'active', label: 'Active' },
        ],
      })
    );

    expect(html.startsWith('<select')).toBe(true);
    expect(html).toContain('name="status"');
    expect(html).toContain('<option value="draft">Draft</option>');
    expect(html).toContain('<option value="active" selected>Active</option>');
  });

  it('renders Badge as span', () => {
    const html = renderMappedComponent(makeNode('Badge', { label: 'New', tone: 'info' }));

    expect(html.startsWith('<span')).toBe(true);
    expect(html).toContain('data-oods-component="Badge"');
    expect(html).toContain('data-prop-tone="info"');
    expect(html).toContain('>New</span>');
  });

  it.each([
    {
      component: 'StatusBadge',
      props: { status: 'active', variant: 'subtle', label: 'Active' },
      expectedVariant: 'subtle',
      expectedStatus: 'active',
    },
    {
      component: 'CancellationBadge',
      props: { cancelAtPeriodEnd: true },
      expectedVariant: 'cancellation',
      expectedStatus: 'true',
    },
    {
      component: 'ArchivePill',
      props: { isArchived: true, label: 'Archived' },
      expectedVariant: 'archive',
      expectedStatus: 'true',
    },
    {
      component: 'ColorizedBadge',
      props: { state: 'warning', color: 'amber' },
      expectedVariant: 'colorized',
      expectedStatus: 'warning',
      expectedColor: 'amber',
    },
    {
      component: 'PreferenceSummaryBadge',
      props: { namespace: 'billing', version: 3 },
      expectedVariant: 'preference',
      expectedStatus: '3',
    },
    {
      component: 'ClassificationBadge',
      props: { category: 'enterprise', mode: 'strict' },
      expectedVariant: 'classification',
      expectedStatus: 'strict',
    },
    {
      component: 'OwnerBadge',
      props: { owner: 'Operations', status: 'assigned' },
      expectedVariant: 'owner',
      expectedStatus: 'assigned',
    },
    {
      component: 'MessageStatusBadge',
      props: { delivery: 'delivered' },
      expectedVariant: 'message',
      expectedStatus: 'delivered',
    },
    {
      component: 'GeoResolutionBadge',
      props: { resolution: 'rooftop' },
      expectedVariant: 'geo',
      expectedStatus: 'rooftop',
      expectedColor: 'rooftop',
    },
    {
      component: 'AddressSummaryBadge',
      props: { role: 'billing' },
      expectedVariant: 'address',
      expectedStatus: 'billing',
    },
    {
      component: 'PriceBadge',
      props: { amountCents: 2599, currency: 'usd' },
      expectedVariant: 'usd',
    },
  ])(
    'renders $component as a span badge and maps status/variant/color props to data attributes',
    ({ component, props, expectedVariant, expectedStatus, expectedColor }) => {
      const html = renderMappedComponent(makeNode(component, props));

      expect(html.startsWith('<span')).toBe(true);
      expect(html).toContain(`data-oods-component="${component}"`);
      expect(html).toContain(`data-badge-variant="${expectedVariant}"`);
      if (expectedStatus) expect(html).toContain(`data-badge-status="${expectedStatus}"`);
      if (expectedColor) expect(html).toContain(`data-badge-color="${expectedColor}"`);
    }
  );

  it('renders RoleBadgeList as nested span badges', () => {
    const html = renderMappedComponent(makeNode('RoleBadgeList', { roles: ['admin', 'auditor'], tone: 'compact' }));

    expect(html.startsWith('<span')).toBe(true);
    expect(html).toContain('data-oods-component="RoleBadgeList"');
    expect(html).toContain('data-badge-variant="compact"');
    expect((html.match(/data-role-badge="true"/g) || []).length).toBe(2);
    expect(html).toContain('admin');
    expect(html).toContain('auditor');
  });

  it('renders Banner as section with default status role', () => {
    const html = renderMappedComponent(makeNode('Banner', { message: 'Sync complete', intent: 'success' }));

    expect(html.startsWith('<section')).toBe(true);
    expect(html).toContain('role="status"');
    expect(html).toContain('data-prop-intent="success"');
    expect(html).toContain('>Sync complete</section>');
  });

  it('renders CardHeader as semantic header with title and supporting copy', () => {
    const html = renderMappedComponent(
      makeNode('CardHeader', { title: 'Account Summary', supporting: 'Last updated 2m ago', level: 4 })
    );

    expect(html.startsWith('<header')).toBe(true);
    expect(html).toContain('<h4>Account Summary</h4>');
    expect(html).toContain('data-oods-supporting="true"');
    expect(html).toContain('Last updated 2m ago');
  });

  it('renders CardHeader children when provided', () => {
    const html = renderMappedComponent(makeNode('CardHeader', { title: 'Ignored' }), '<h5>Slot Title</h5>');

    expect(html.startsWith('<header')).toBe(true);
    expect(html).toContain('<h5>Slot Title</h5>');
    expect(html).not.toContain('<h3>Ignored</h3>');
  });

  it('renders DetailHeader with semantic heading, subtitle, and metadata', () => {
    const html = renderMappedComponent(
      makeNode('DetailHeader', {
        title: 'Invoice #1042',
        subtitle: 'Billing profile',
        metadata: 'Updated 2026-02-26',
        level: 1,
      })
    );

    expect(html.startsWith('<header')).toBe(true);
    expect(html).toContain('<h1>Invoice #1042</h1>');
    expect(html).toContain('data-oods-subtitle="true"');
    expect(html).toContain('Billing profile');
    expect(html).toContain('data-oods-metadata="true"');
    expect(html).toContain('Updated 2026-02-26');
  });

  it('renders DetailHeader children when provided', () => {
    const html = renderMappedComponent(makeNode('DetailHeader', { title: 'Ignored' }), '<h2>Slot Detail Header</h2>');

    expect(html.startsWith('<header')).toBe(true);
    expect(html).toContain('<h2>Slot Detail Header</h2>');
    expect(html).not.toContain('<h2>Ignored</h2>');
  });

  it('renders FormLabelGroup as semantic label with for/hint content', () => {
    const html = renderMappedComponent(
      makeNode('FormLabelGroup', { label: 'Email', htmlFor: 'email-input', placeholder: 'name@example.com' })
    );

    expect(html.startsWith('<label')).toBe(true);
    expect(html).toContain('for="email-input"');
    expect(html).toContain('data-oods-form-label="true"');
    expect(html).toContain('Email');
    expect(html).toContain('data-oods-form-hint="true"');
    expect(html).toContain('name@example.com');
  });

  it('renders FormLabelGroup children after label text', () => {
    const html = renderMappedComponent(
      makeNode('FormLabelGroup', { label: 'Role', inputId: 'role-select' }),
      '<span>Admin</span>'
    );

    expect(html.startsWith('<label')).toBe(true);
    expect(html).toContain('for="role-select"');
    expect(html).toContain('<span data-oods-form-label="true">Role</span><span>Admin</span>');
  });

  it('renders InlineLabel as span and applies maxLength truncation', () => {
    const html = renderMappedComponent(makeNode('InlineLabel', { label: 'Customer Success Specialist', maxLength: 12 }));

    expect(html.startsWith('<span')).toBe(true);
    expect(html).toContain('data-oods-component="InlineLabel"');
    expect(html).toContain('Customer Su...');
  });

  it('renders InlineLabel children when provided', () => {
    const html = renderMappedComponent(makeNode('InlineLabel', { label: 'Ignored' }), '<strong>Slot Label</strong>');

    expect(html.startsWith('<span')).toBe(true);
    expect(html).toContain('<strong>Slot Label</strong>');
    expect(html).not.toContain('Ignored');
  });

  it('renders LabelCell with primary and supporting text', () => {
    const html = renderMappedComponent(
      makeNode('LabelCell', {
        label: 'Extremely Long Customer Label',
        description: 'Description requiring truncation',
        truncate: true,
        maxLength: 10,
      })
    );

    expect(html.startsWith('<span')).toBe(true);
    expect(html).toContain('data-oods-label-cell-primary="true"');
    expect(html).toContain('Extremely...');
    expect(html).toContain('data-oods-label-cell-description="true"');
    expect(html).toContain('Descripti...');
  });

  it('renders LabelCell children when provided', () => {
    const html = renderMappedComponent(makeNode('LabelCell', { label: 'Ignored' }), '<em>Slot Cell</em>');

    expect(html.startsWith('<span')).toBe(true);
    expect(html).toContain('<em>Slot Cell</em>');
    expect(html).not.toContain('Ignored');
  });

  it.each([
    {
      component: 'AddressCollectionPanel',
      props: { title: 'Addresses', field: 'addresses', roleField: 'address_roles', summary: '2 addresses' },
      panelType: 'address',
      expectedTitle: 'Addresses',
      expectedDataProp: 'data-prop-field="addresses"',
      expectedSummary: '2 addresses',
    },
    {
      component: 'ClassificationPanel',
      props: { title: 'Classification', categoriesField: 'categories', modeParameter: 'strict' },
      panelType: 'classification',
      expectedTitle: 'Classification',
      expectedDataProp: 'data-prop-categories-field="categories"',
    },
    {
      component: 'CommunicationDetailPanel',
      props: { label: 'Communication', channelsField: 'channel_catalog' },
      panelType: 'communication',
      expectedTitle: 'Communication',
      expectedDataProp: 'data-prop-channels-field="channel_catalog"',
    },
    {
      component: 'MembershipPanel',
      props: { heading: 'Membership', membershipsField: 'membership_records' },
      panelType: 'membership',
      expectedTitle: 'Membership',
      expectedDataProp: 'data-prop-memberships-field="membership_records"',
    },
    {
      component: 'PreferencePanel',
      props: { name: 'Preferences', preferencesField: 'preference_document' },
      panelType: 'preference',
      expectedTitle: 'Preferences',
      expectedDataProp: 'data-prop-preferences-field="preference_document"',
    },
  ])('renders $component as semantic section panel', ({ component, props, panelType, expectedTitle, expectedDataProp, expectedSummary }) => {
    const html = renderMappedComponent(makeNode(component, props));

    expect(html.startsWith('<section')).toBe(true);
    expect(html).toContain(`data-oods-component="${component}"`);
    expect(html).toContain(`data-panel-type="${panelType}"`);
    expect(html).toContain('<header data-panel-header="true">');
    expect(html).toContain(`<h3>${expectedTitle}</h3>`);
    expect(html).toContain('<div data-panel-content="true">');
    expect(html).toContain(expectedDataProp);
    if (expectedSummary) {
      expect(html).toContain('data-panel-summary="true"');
      expect(html).toContain(expectedSummary);
    }
  });

  it('renders panel children inside the panel content slot', () => {
    const html = renderMappedComponent(
      makeNode('CommunicationDetailPanel', { title: 'Communication' }),
      '<article data-testid="child-thread">thread</article>'
    );

    expect(html).toContain('<div data-panel-content="true"><article data-testid="child-thread">thread</article></div>');
  });

  it.each([
    {
      component: 'AddressEditor',
      props: { title: 'Address', street: '123 Main', city: 'Seattle' },
      expectedTag: 'form',
      formType: 'address-editor',
      expectedControls: ['name="street"', 'name="city"', 'data-form-control="input"'],
    },
    {
      component: 'ClassificationEditor',
      props: { title: 'Classification', category: 'enterprise', modes: ['strict', 'flexible'], mode: 'strict' },
      expectedTag: 'form',
      formType: 'classification-editor',
      expectedControls: ['name="mode"', 'data-form-control="select"'],
    },
    {
      component: 'PreferenceEditor',
      props: { title: 'Preferences', namespaces: ['billing'], namespace: 'billing', document: '{"enabled":true}' },
      expectedTag: 'form',
      formType: 'preference-editor',
      expectedControls: ['name="namespace"', 'data-form-control="textarea"'],
    },
    {
      component: 'RoleAssignmentForm',
      props: { title: 'Roles', roles: ['admin', 'viewer'], role: 'admin' },
      expectedTag: 'form',
      formType: 'role-assignment',
      expectedControls: ['name="role"', 'name="assignee"'],
    },
    {
      component: 'CancellationForm',
      props: { title: 'Cancel', allowedReasons: ['budget', 'duplicate'], reasonCode: 'budget' },
      expectedTag: 'form',
      formType: 'cancellation',
      expectedControls: ['name="reasonCode"', 'name="reason"'],
    },
    {
      component: 'TagInput',
      props: { label: 'Tags', tags: ['core', 'urgent'] },
      expectedTag: 'fieldset',
      formType: 'tag-input',
      expectedControls: ['data-tag-list="true"', 'data-tag-item="true"', 'name="tag"'],
    },
    {
      component: 'TagManager',
      props: { title: 'Manage Tags', tags: ['alpha'] },
      expectedTag: 'form',
      formType: 'tag-manager',
      expectedControls: ['data-tag-list="true"', 'name="newTag"'],
    },
    {
      component: 'GeoFieldMappingForm',
      props: { title: 'Geo Mapping', latitudeField: 'lat', longitudeField: 'lon', identifierField: 'city', autoDetect: true },
      expectedTag: 'form',
      formType: 'geo-mapping',
      expectedControls: ['name="latitudeField"', 'name="longitudeField"', 'type="checkbox"'],
    },
    {
      component: 'ColorStatePicker',
      props: { title: 'Color', colorStates: ['default', 'warning'], value: 'warning' },
      expectedTag: 'fieldset',
      formType: 'color-state-picker',
      expectedControls: ['name="colorState"', 'data-form-control="select"'],
    },
    {
      component: 'TemplatePicker',
      props: { title: 'Template', templates: ['welcome'], channels: ['email'], value: 'welcome', channel: 'email' },
      expectedTag: 'fieldset',
      formType: 'template-picker',
      expectedControls: ['name="template"', 'name="channel"'],
    },
  ])('renders $component as semantic form/editor container', ({ component, props, expectedTag, formType, expectedControls }) => {
    const html = renderMappedComponent(makeNode(component, props));

    expect(html.startsWith(`<${expectedTag}`)).toBe(true);
    expect(html).toContain(`data-oods-component="${component}"`);
    expect(html).toContain(`data-form-type="${formType}"`);
    expect(html).toContain('data-form-content="true"');
    for (const control of expectedControls) {
      expect(html).toContain(control);
    }
  });

  it('renders form/editor children inside the form content slot', () => {
    const html = renderMappedComponent(
      makeNode('TagManager', { title: 'Tag Manager' }),
      '<p data-testid="custom-form-body">Custom editor body</p>'
    );

    expect(html).toContain('<div data-form-content="true"><p data-testid="custom-form-body">Custom editor body</p></div>');
  });

  it.each([
    {
      component: 'AuditTimeline',
      props: { title: 'Audit', events: [{ label: 'Created', timestamp: '2026-02-26T00:00:00Z' }] },
      timelineType: 'audit',
      expectedLabel: 'Created',
    },
    {
      component: 'AddressValidationTimeline',
      props: { title: 'Address Validation', validations: [{ label: 'Validated', timestamp: '2026-02-26T00:01:00Z' }] },
      timelineType: 'address-validation',
      expectedLabel: 'Validated',
    },
    {
      component: 'MembershipAuditTimeline',
      props: { title: 'Membership', memberships: [{ label: 'Role Granted', timestamp: '2026-02-26T00:02:00Z' }] },
      timelineType: 'membership',
      expectedLabel: 'Role Granted',
    },
    {
      component: 'MessageEventTimeline',
      props: { title: 'Messages', messages: [{ label: 'Message Sent', timestamp: '2026-02-26T00:03:00Z' }] },
      timelineType: 'message',
      expectedLabel: 'Message Sent',
    },
    {
      component: 'PreferenceTimeline',
      props: { title: 'Preferences', changes: [{ label: 'Preference Updated', timestamp: '2026-02-26T00:04:00Z' }] },
      timelineType: 'preference',
      expectedLabel: 'Preference Updated',
    },
    {
      component: 'StatusTimeline',
      props: { title: 'Status', stateHistory: [{ label: 'active', timestamp: '2026-02-26T00:05:00Z' }] },
      timelineType: 'status',
      expectedLabel: 'active',
    },
  ])('renders $component as timeline log with ordered event stream', ({ component, props, timelineType, expectedLabel }) => {
    const html = renderMappedComponent(makeNode(component, props));

    expect(html.startsWith('<div')).toBe(true);
    expect(html).toContain(`data-oods-component="${component}"`);
    expect(html).toContain(`data-timeline-type="${timelineType}"`);
    expect(html).toContain('role="log"');
    expect(html).toContain('<ol data-timeline-events="true">');
    expect(html).toContain(expectedLabel);
  });

  it('renders timeline children in ordered event slot', () => {
    const html = renderMappedComponent(
      makeNode('AuditTimeline', { title: 'Audit' }),
      '<li><article data-testid="timeline-child">Custom Event</article></li>'
    );

    expect(html).toContain('<ol data-timeline-events="true"><li><article data-testid="timeline-child">Custom Event</article></li></ol>');
  });

  it.each([
    {
      component: 'AuditEvent',
      props: { label: 'Record Created', timestamp: '2026-02-26T00:00:00Z', detail: 'Created by system' },
      eventType: 'audit',
    },
    {
      component: 'ArchiveEvent',
      props: { label: 'Record Archived', timestamp: '2026-02-26T01:00:00Z', reason: 'policy' },
      eventType: 'archive',
    },
    {
      component: 'CancellationEvent',
      props: { label: 'Cancellation Requested', timestamp: '2026-02-26T02:00:00Z', reason: 'budget' },
      eventType: 'cancellation',
    },
    {
      component: 'StateTransitionEvent',
      props: { label: 'State changed to active', timestamp: '2026-02-26T03:00:00Z', from: 'pending', to: 'active' },
      eventType: 'state-transition',
    },
  ])('renders $component as semantic timeline article event', ({ component, props, eventType }) => {
    const html = renderMappedComponent(makeNode(component, props));

    expect(html.startsWith('<article')).toBe(true);
    expect(html).toContain(`data-oods-component="${component}"`);
    expect(html).toContain(`data-event-type="${eventType}"`);
    expect(html).toContain('data-event-time="true"');
    expect(html).toContain('data-event-label="true"');
  });

  it('renders RelativeTimestamp as semantic time element with datetime', () => {
    const html = renderMappedComponent(
      makeNode('RelativeTimestamp', { datetime: '2026-02-26T03:00:00Z', relative: '2 minutes ago' })
    );

    expect(html.startsWith('<time')).toBe(true);
    expect(html).toContain('data-oods-component="RelativeTimestamp"');
    expect(html).toContain('datetime="2026-02-26T03:00:00Z"');
    expect(html).toContain('>2 minutes ago</time>');
  });

  it.each([
    {
      component: 'ArchiveSummary',
      props: { title: 'Archive', isArchived: true, archivedAt: '2026-02-26T01:00:00Z', reason: 'policy' },
      summaryType: 'archive',
    },
    {
      component: 'CancellationSummary',
      props: { title: 'Cancellation', cancelAtPeriodEnd: true, requestedAt: '2026-02-26T02:00:00Z', reason: 'budget' },
      summaryType: 'cancellation',
    },
    {
      component: 'OwnershipSummary',
      props: { title: 'Ownership', ownerId: 'usr_123', ownerType: 'team', role: 'admin' },
      summaryType: 'ownership',
    },
    {
      component: 'PriceSummary',
      props: { title: 'Pricing', amount: '29.00', currency: 'USD', model: 'tiered', interval: 'monthly' },
      summaryType: 'price',
    },
    {
      component: 'TagSummary',
      props: { title: 'Tags', tagCount: 4, tags: 'core, urgent' },
      summaryType: 'tags',
    },
    {
      component: 'GeocodablePreview',
      props: { title: 'Geo Preview', resolution: 'rooftop', requiresLookup: false, detectedFields: 'lat,lon' },
      summaryType: 'geocodable',
    },
  ])('renders $component as summary section with definition list', ({ component, props, summaryType }) => {
    const html = renderMappedComponent(makeNode(component, props));

    expect(html.startsWith('<section')).toBe(true);
    expect(html).toContain(`data-oods-component="${component}"`);
    expect(html).toContain(`data-summary-type="${summaryType}"`);
    expect(html).toContain('<dl>');
    expect(html).toContain('<dt>');
    expect(html).toContain('<dd>');
  });

  it.each([
    {
      component: 'OwnershipMeta',
      props: { title: 'Ownership Meta', ownerType: 'team', role: 'admin' },
      metaType: 'ownership',
    },
    {
      component: 'PriceCardMeta',
      props: { title: 'Price Meta', model: 'tiered', interval: 'monthly' },
      metaType: 'price',
    },
  ])('renders $component as compact meta inline display', ({ component, props, metaType }) => {
    const html = renderMappedComponent(makeNode(component, props));

    expect(html.startsWith('<div')).toBe(true);
    expect(html).toContain(`data-oods-component="${component}"`);
    expect(html).toContain(`data-meta-type="${metaType}"`);
    expect(html).toContain('data-meta-item="true"');
  });

  it('renders TagPills with overflow indicator', () => {
    const html = renderMappedComponent(
      makeNode('TagPills', { tags: ['alpha', 'beta', 'gamma', 'delta'], maxVisible: 3, overflowLabel: '+{{ tag_count }}' })
    );

    expect(html.startsWith('<div')).toBe(true);
    expect(html).toContain('data-summary-type="tag-pills"');
    expect((html.match(/data-tag-pill="true"/g) || []).length).toBe(3);
    expect(html).toContain('data-tag-overflow="true"');
    expect(html).toContain('+4');
  });

  it('renders StatusSelector with select-like control', () => {
    const html = renderMappedComponent(
      makeNode('StatusSelector', { label: 'Status', states: ['draft', 'active'], value: 'active' })
    );

    expect(html.startsWith('<div')).toBe(true);
    expect(html).toContain('data-summary-type="status-selector"');
    expect(html).toContain('data-form-control="select"');
    expect(html).toContain('name="status"');
  });

  it('renders ColorSwatch as compact swatch span', () => {
    const html = renderMappedComponent(makeNode('ColorSwatch', { color: 'emerald', label: 'Emerald' }));

    expect(html.startsWith('<span')).toBe(true);
    expect(html).toContain('data-summary-type="color-swatch"');
    expect(html).toContain('data-swatch-color="emerald"');
    expect(html).toContain('Emerald');
  });

  it('renders StatusColorLegend as semantic definition list', () => {
    const html = renderMappedComponent(
      makeNode('StatusColorLegend', {
        legend: [
          { label: 'Active', color: 'green' },
          { label: 'Paused', color: 'amber' },
        ],
      })
    );

    expect(html.startsWith('<section')).toBe(true);
    expect(html).toContain('data-summary-type="status-color-legend"');
    expect(html).toContain('data-legend-item="true"');
    expect(html).toContain('<dl>');
  });

  it.each([
    {
      component: 'VizAreaControls',
      props: { title: 'Area Controls', curve: 'linear', opacity: '0.6' },
      formType: 'viz-area-controls',
      expectedControls: ['name="curve"', 'name="opacity"'],
    },
    {
      component: 'VizMarkControls',
      props: { title: 'Mark Controls', orientation: 'vertical', stacking: 'stack' },
      formType: 'viz-mark-controls',
      expectedControls: ['name="orientation"', 'name="stacking"'],
    },
    {
      component: 'VizLineControls',
      props: { title: 'Line Controls', curve: 'monotone', markers: 'auto' },
      formType: 'viz-line-controls',
      expectedControls: ['name="curve"', 'name="markers"'],
    },
    {
      component: 'VizPointControls',
      props: { title: 'Point Controls', shape: 'circle', size: '16' },
      formType: 'viz-point-controls',
      expectedControls: ['name="shape"', 'name="size"'],
    },
    {
      component: 'VizColorControls',
      props: { title: 'Color Controls', scheme: 'viridis', channel: 'fill' },
      formType: 'viz-color-controls',
      expectedControls: ['name="scheme"', 'name="channel"'],
    },
    {
      component: 'VizAxisControls',
      props: { title: 'Axis Controls', xField: 'date', yField: 'revenue' },
      formType: 'viz-axis-controls',
      expectedControls: ['name="xField"', 'name="yField"'],
    },
    {
      component: 'VizSizeControls',
      props: { title: 'Size Controls', strategy: 'range', min: '8', max: '42' },
      formType: 'viz-size-controls',
      expectedControls: ['name="strategy"', 'name="minSize"'],
    },
    {
      component: 'VizScaleControls',
      props: { title: 'Scale Controls', type: 'linear', domainMin: '0', domainMax: '100' },
      formType: 'viz-scale-controls',
      expectedControls: ['name="scaleType"', 'name="domainMin"'],
    },
  ])('renders $component as viz controls form structure', ({ component, props, formType, expectedControls }) => {
    const html = renderMappedComponent(makeNode(component, props));

    expect(html.startsWith('<fieldset')).toBe(true);
    expect(html).toContain(`data-oods-component="${component}"`);
    expect(html).toContain(`data-form-type="${formType}"`);
    for (const control of expectedControls) {
      expect(html).toContain(control);
    }
  });

  it.each([
    { component: 'VizAreaPreview', previewType: 'area' },
    { component: 'VizMarkPreview', previewType: 'mark' },
    { component: 'VizLinePreview', previewType: 'line' },
    { component: 'VizPointPreview', previewType: 'point' },
  ])('renders $component as preview placeholder container', ({ component, previewType }) => {
    const html = renderMappedComponent(makeNode(component, { width: 800, height: 400 }));

    expect(html.startsWith('<div')).toBe(true);
    expect(html).toContain(`data-oods-component="${component}"`);
    expect(html).toContain(`data-viz-preview-type="${previewType}"`);
    expect(html).toContain('data-viz-preview-placeholder="true"');
  });

  it.each([
    {
      component: 'VizColorLegendConfig',
      props: { title: 'Legend', field: 'segment', scheme: 'viridis', redundancy: 'shape' },
      summaryType: 'viz-color-legend',
    },
    {
      component: 'VizAxisSummary',
      props: { title: 'Axis Summary', axis: 'x', scale: 'linear', zero: true },
      summaryType: 'viz-axis-summary',
    },
    {
      component: 'VizSizeSummary',
      props: { title: 'Size Summary', field: 'revenue', strategy: 'range', min: 8, max: 42 },
      summaryType: 'viz-size-summary',
    },
    {
      component: 'VizScaleSummary',
      props: { title: 'Scale Summary', type: 'linear', domainMin: 0, domainMax: 100, mode: 'fit' },
      summaryType: 'viz-scale-summary',
    },
  ])('renders $component as viz summary/legend section', ({ component, props, summaryType }) => {
    const html = renderMappedComponent(makeNode(component, props));

    expect(html.startsWith('<section')).toBe(true);
    expect(html).toContain(`data-oods-component="${component}"`);
    expect(html).toContain(`data-summary-type="${summaryType}"`);
    expect(html).toContain('<dl>');
  });

  it.each([
    {
      component: 'VizEncodingBadge',
      props: { axis: 'x', field: 'revenue' },
      expectedVariant: 'viz-encoding',
    },
    {
      component: 'VizRoleBadge',
      props: { role: 'mark' },
      expectedVariant: 'viz-role',
    },
  ])('renders $component as viz badge', ({ component, props, expectedVariant }) => {
    const html = renderMappedComponent(makeNode(component, props));

    expect(html.startsWith('<span')).toBe(true);
    expect(html).toContain(`data-oods-component="${component}"`);
    expect(html).toContain(`data-badge-variant="${expectedVariant}"`);
  });

  it('renders Table with semantic header/body sections', () => {
    const html = renderMappedComponent(
      makeNode('Table', {
        columns: [{ key: 'name', label: 'Name' }, { key: 'value', label: 'Value' }],
        rows: [{ name: 'Latency', value: '120ms' }],
      })
    );

    expect(html.startsWith('<table')).toBe(true);
    expect(html).toContain('<thead>');
    expect(html).toContain('<th scope="col">Name</th>');
    expect(html).toContain('<tbody>');
    expect(html).toContain('<td>Latency</td>');
    expect(html).toContain('<td>120ms</td>');
  });

  it('renders Tabs with tablist and tabpanels', () => {
    const html = renderMappedComponent(
      makeNode('Tabs', {
        tabs: [
          { id: 'overview', label: 'Overview', content: 'Overview panel', active: true },
          { id: 'details', label: 'Details', content: 'Details panel', active: false },
        ],
      })
    );

    expect(html.startsWith('<section')).toBe(true);
    expect(html).toContain('role="tablist"');
    expect(html).toContain('aria-selected="true"');
    expect(html).toContain('aria-selected="false"');
    expect(html).toContain('role="tabpanel"');
    expect(html).toContain('Overview panel');
    expect(html).toContain('Details panel');
  });

  it('renders fallback div for unknown components with component label', () => {
    const html = renderMappedComponent(makeNode('NotInRegistry', { danger: 'yes' }), '<em>Fallback child</em>');

    expect(html.startsWith('<div')).toBe(true);
    expect(html).toContain('data-oods-fallback="true"');
    expect(html).toContain('Unknown component: NotInRegistry');
    expect(html).toContain('<em>Fallback child</em>');
  });
});
