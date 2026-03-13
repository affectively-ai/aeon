import { describe, expect, it } from 'vitest';

import {
  GNOSIS_IMPOSSIBLE_SYSTEM_TOPOLOGIES,
  getGnosisImpossibleSystemTopology,
} from '../../topology';

describe('Gnosis impossible system topology registry', () => {
  it('exports the four integrated Gnosis example modules with stable paths', () => {
    expect(GNOSIS_IMPOSSIBLE_SYSTEM_TOPOLOGIES).toHaveLength(4);

    const ids = new Set(
      GNOSIS_IMPOSSIBLE_SYSTEM_TOPOLOGIES.map((topology) => topology.id)
    );
    expect(ids.size).toBe(GNOSIS_IMPOSSIBLE_SYSTEM_TOPOLOGIES.length);

    for (const topology of GNOSIS_IMPOSSIBLE_SYSTEM_TOPOLOGIES) {
      expect(topology.gnosisExamplePath.startsWith('open-source/gnosis/examples/')).toBe(
        true
      );
      expect(topology.gnosisTestPath).toBe(
        'open-source/gnosis/examples/impossible-systems.test.gg'
      );
      expect(topology.invariants.length).toBeGreaterThanOrEqual(2);
    }
  });

  it('resolves entries by id for Aeon consumers', () => {
    expect(getGnosisImpossibleSystemTopology('edge-pipeline-parallelism')?.aeonSurface).toBe(
      'federation'
    );
    expect(getGnosisImpossibleSystemTopology('audio-token-privacy')?.aeonSurface).toBe(
      'flow'
    );
    expect(
      getGnosisImpossibleSystemTopology('crdt-split-brain-prevention')?.summary
    ).toContain('deterministic CRDT');
    expect(getGnosisImpossibleSystemTopology('webgpu-graph-flattening')?.title).toBe(
      'WebGPU Graph Flattening'
    );
  });
});
