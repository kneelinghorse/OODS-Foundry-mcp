import { describe, it, expect } from 'vitest';
import type {
  Stage1CapabilityRollup,
  Stage1IdentityGraph,
  Stage1ObjectRollup,
} from '../tools/types.js';
import { normalizeCapabilities } from './capability-normalizer.js';

const RUN = 'run-fixture-0001';

function baseCapabilityRollup(): Stage1CapabilityRollup {
  return {
    kind: 'capability_rollup',
    schema_version: '1.1.0',
    generated_at: '2026-04-17T00:00:00.000Z',
    run_id: RUN,
    target: { id: RUN, url: 'https://example.com/' },
    capabilities: [],
  };
}

function baseObjectRollup(): Stage1ObjectRollup {
  return {
    kind: 'object_rollup',
    schema_version: '1.0.0',
    generated_at: '2026-04-17T00:00:00.000Z',
    run_id: RUN,
    target: { id: RUN, url: 'https://example.com/' },
    objects: [],
  };
}

function baseIdentityGraph(): Stage1IdentityGraph {
  return {
    kind: 'identity_graph',
    schema_version: '1.1.0',
    generated_at: '2026-04-17T00:00:00.000Z',
    run_id: RUN,
    target: { id: RUN, url: 'https://example.com/' },
    nodes: [],
  };
}

describe('normalizeCapabilities', () => {
  it('returns an empty array when capability_rollup has no capabilities', () => {
    const result = normalizeCapabilities({
      capabilityRollup: baseCapabilityRollup(),
    });
    expect(result).toEqual([]);
  });

  it('emits every capability_rollup canonical_id in the output', () => {
    const capabilityRollup = baseCapabilityRollup();
    capabilityRollup.capabilities = [
      {
        canonical_id: 'capability:zeta',
        display_label: 'Zeta',
        presentations: [],
        resolution_strategy: 'identity_node',
      },
      {
        canonical_id: 'capability:alpha',
        display_label: 'Alpha',
        presentations: [],
        resolution_strategy: 'identity_node',
      },
    ];
    const result = normalizeCapabilities({ capabilityRollup });
    expect(result.map((c) => c.canonical_id)).toEqual([
      'capability:alpha',
      'capability:zeta',
    ]);
  });

  it('threads capability_id onto every normalized presentation', () => {
    const capabilityRollup = baseCapabilityRollup();
    capabilityRollup.capabilities = [
      {
        canonical_id: 'capability:alpha',
        display_label: 'Alpha',
        presentations: [
          { surface: 'dom', label: 'Alpha', member_instances: [] },
          { surface: 'mobile', label: 'Alpha Mobile', member_instances: [] },
        ],
      },
    ];
    const result = normalizeCapabilities({ capabilityRollup });
    expect(result).toHaveLength(1);
    for (const p of result[0].presentations) {
      expect(p.capability_id).toBe('capability:alpha');
    }
  });

  it('derives projection_variants from object_rollup when evidence refs overlap', () => {
    const sharedRef = {
      artifact_ref: 'orca_candidates.json',
      json_pointer: '/action_candidates/7',
      run_id: RUN,
      source_surface: 'dom',
      observation_type: 'orca_action',
    };
    const capabilityRollup = baseCapabilityRollup();
    capabilityRollup.capabilities = [
      {
        canonical_id: 'capability:share',
        presentations: [
          {
            surface: 'dom',
            label: 'Share',
            member_instances: [sharedRef],
          },
        ],
      },
    ];
    const objectRollup = baseObjectRollup();
    objectRollup.objects = [
      {
        canonical_id: 'canonical:object:share-button',
        canonical_label: 'Share Button',
        projection_variants: [
          {
            id: 'share-button-desktop',
            surface: 'desktop',
            confidence: 0.9,
            selector: 'cluster-12',
            evidence_chain: [sharedRef],
            metadata: { source_surface: 'dom' },
          },
          {
            id: 'share-button-unrelated',
            surface: 'desktop',
            confidence: 0.8,
            evidence_chain: [
              {
                artifact_ref: 'orca_candidates.json',
                json_pointer: '/action_candidates/99',
                run_id: RUN,
              },
            ],
          },
        ],
      },
    ];

    const [normalized] = normalizeCapabilities({ capabilityRollup, objectRollup });
    expect(normalized.presentations).toHaveLength(1);
    const variants = normalized.presentations[0].projection_variants;
    expect(variants.map((v) => v.id)).toEqual(['share-button-desktop']);
    expect(variants[0].object_canonical_id).toBe('canonical:object:share-button');
    expect(variants[0].object_canonical_label).toBe('Share Button');
    expect(variants[0].selector).toBe('cluster-12');
  });

  it('keeps member_instances and sets empty projection_variants when no evidence overlap exists', () => {
    const capabilityRollup = baseCapabilityRollup();
    capabilityRollup.capabilities = [
      {
        canonical_id: 'capability:unmatched',
        presentations: [
          {
            surface: 'dom',
            member_instances: [
              {
                artifact_ref: 'orca_candidates.json',
                json_pointer: '/action_candidates/0',
                run_id: RUN,
              },
            ],
          },
        ],
      },
    ];
    const result = normalizeCapabilities({ capabilityRollup, objectRollup: baseObjectRollup() });
    expect(result[0].presentations[0].member_instances).toHaveLength(1);
    expect(result[0].presentations[0].projection_variants).toEqual([]);
  });

  it('preserves resolution_strategy and surfaces variants across multiple presentations', () => {
    const refDom = {
      artifact_ref: 'orca_candidates.json',
      json_pointer: '/action_candidates/1',
      run_id: RUN,
    };
    const refMobile = {
      artifact_ref: 'orca_candidates.json',
      json_pointer: '/action_candidates/2',
      run_id: RUN,
    };
    const capabilityRollup = baseCapabilityRollup();
    capabilityRollup.capabilities = [
      {
        canonical_id: 'capability:edit',
        resolution_strategy: 'identity_node',
        derived_from_runs: [RUN, 'other-run'],
        presentations: [
          { surface: 'mobile', label: 'Edit Mobile', member_instances: [refMobile] },
          { surface: 'dom', label: 'Edit', member_instances: [refDom] },
        ],
      },
    ];
    const objectRollup = baseObjectRollup();
    objectRollup.objects = [
      {
        canonical_id: 'canonical:object:edit-button',
        projection_variants: [
          { id: 'edit-button-desktop', surface: 'desktop', evidence_chain: [refDom] },
          { id: 'edit-button-mobile', surface: 'mobile', evidence_chain: [refMobile] },
        ],
      },
    ];
    const [normalized] = normalizeCapabilities({ capabilityRollup, objectRollup });
    expect(normalized.resolution_strategy).toBe('identity_node');
    expect(normalized.derived_from_runs).toEqual(['other-run', RUN]);
    expect(normalized.presentations.map((p) => p.surface)).toEqual(['dom', 'mobile']);
    expect(normalized.presentations[0].projection_variants[0].id).toBe('edit-button-desktop');
    expect(normalized.presentations[1].projection_variants[0].id).toBe('edit-button-mobile');
  });

  it('merges capability-level and object-level conflicts deterministically', () => {
    const ref = {
      artifact_ref: 'orca_candidates.json',
      json_pointer: '/action_candidates/3',
      run_id: RUN,
    };
    const capabilityRollup = baseCapabilityRollup();
    capabilityRollup.capabilities = [
      {
        canonical_id: 'capability:flaky',
        presentations: [{ surface: 'dom', member_instances: [ref] }],
        conflicts: [{ type: 'capability-level', severity: 'warning' }],
      },
    ];
    const objectRollup = baseObjectRollup();
    objectRollup.objects = [
      {
        canonical_id: 'canonical:object:flaky',
        projection_variants: [{ id: 'flaky-1', surface: 'desktop', evidence_chain: [ref] }],
        conflicts: [{ type: 'object-level', severity: 'error' }],
      },
    ];
    const [normalized] = normalizeCapabilities({ capabilityRollup, objectRollup });
    expect(normalized.conflicts).toEqual([
      { type: 'capability-level', severity: 'warning' },
      { type: 'object-level', severity: 'error' },
    ]);
  });

  it('attaches identity_node when the graph contains a matching canonical_id', () => {
    const capabilityRollup = baseCapabilityRollup();
    capabilityRollup.capabilities = [
      { canonical_id: 'capability:tagged', presentations: [] },
      { canonical_id: 'capability:untagged', presentations: [] },
    ];
    const identityGraph = baseIdentityGraph();
    identityGraph.nodes = [
      {
        canonical_id: 'capability:tagged',
        canonical_label: 'Tagged',
        identity_class: 'capability',
        candidate_mappings: [{ target: 'Tagged', confidence: 0.92 }],
      },
    ];
    const result = normalizeCapabilities({ capabilityRollup, identityGraph });
    const tagged = result.find((c) => c.canonical_id === 'capability:tagged');
    const untagged = result.find((c) => c.canonical_id === 'capability:untagged');
    expect(tagged?.identity_node?.canonical_label).toBe('Tagged');
    expect(untagged?.identity_node).toBeUndefined();
  });

  it('is pure — does not mutate inputs and produces byte-identical output across runs', () => {
    const ref = {
      artifact_ref: 'orca_candidates.json',
      json_pointer: '/action_candidates/1',
      run_id: RUN,
    };
    const capabilityRollup: Stage1CapabilityRollup = {
      ...baseCapabilityRollup(),
      capabilities: [
        {
          canonical_id: 'capability:alpha',
          presentations: [{ surface: 'dom', label: 'Alpha', member_instances: [ref] }],
          resolution_strategy: 'identity_node',
        },
      ],
    };
    const objectRollup: Stage1ObjectRollup = {
      ...baseObjectRollup(),
      objects: [
        {
          canonical_id: 'canonical:object:alpha',
          projection_variants: [{ id: 'alpha-desktop', surface: 'desktop', evidence_chain: [ref] }],
        },
      ],
    };

    const snapshotInputs = JSON.stringify({ capabilityRollup, objectRollup });
    const first = JSON.stringify(normalizeCapabilities({ capabilityRollup, objectRollup }));
    const second = JSON.stringify(normalizeCapabilities({ capabilityRollup, objectRollup }));

    expect(first).toBe(second);
    expect(JSON.stringify({ capabilityRollup, objectRollup })).toBe(snapshotInputs);
  });

  it('deduplicates projection_variants that appear under multiple member_instance refs', () => {
    const refA = {
      artifact_ref: 'orca_candidates.json',
      json_pointer: '/action_candidates/1',
      run_id: RUN,
    };
    const refB = {
      artifact_ref: 'orca_candidates.json',
      json_pointer: '/action_candidates/2',
      run_id: RUN,
    };
    const capabilityRollup = baseCapabilityRollup();
    capabilityRollup.capabilities = [
      {
        canonical_id: 'capability:dup',
        presentations: [{ surface: 'dom', member_instances: [refA, refB] }],
      },
    ];
    const objectRollup = baseObjectRollup();
    objectRollup.objects = [
      {
        canonical_id: 'canonical:object:dup',
        projection_variants: [
          { id: 'dup-desktop', surface: 'desktop', evidence_chain: [refA, refB] },
        ],
      },
    ];
    const [normalized] = normalizeCapabilities({ capabilityRollup, objectRollup });
    expect(normalized.presentations[0].projection_variants).toHaveLength(1);
    expect(normalized.presentations[0].projection_variants[0].id).toBe('dup-desktop');
  });
});
