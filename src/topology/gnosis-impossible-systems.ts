export type GnosisImpossibleSystemId =
  | 'edge-pipeline-parallelism'
  | 'audio-token-privacy'
  | 'crdt-split-brain-prevention'
  | 'webgpu-graph-flattening';

export interface GnosisImpossibleSystemTopology {
  readonly id: GnosisImpossibleSystemId;
  readonly title: string;
  readonly aeonSurface: 'flow' | 'topology' | 'federation';
  readonly gnosisExamplePath: string;
  readonly gnosisTestPath: string;
  readonly summary: string;
  readonly invariants: readonly string[];
}

export const GNOSIS_IMPOSSIBLE_SYSTEM_TOPOLOGIES = [
  {
    id: 'edge-pipeline-parallelism',
    title: 'Edge Pipeline Parallelism',
    aeonSurface: 'federation',
    gnosisExamplePath: 'open-source/gnosis/examples/edge-pipeline-parallelism.gg',
    gnosisTestPath: 'open-source/gnosis/examples/impossible-systems.test.gg',
    summary:
      'Models a 13B request folding across layer-sharded workers that relay quantized hidden state and race a warm standby for failover.',
    invariants: [
      'no single worker shard exceeds its annotated capacity',
      'the request still reaches a folded response under warm-standby failover',
    ],
  },
  {
    id: 'audio-token-privacy',
    title: 'Audio Token Privacy',
    aeonSurface: 'flow',
    gnosisExamplePath: 'open-source/gnosis/examples/audio-token-privacy.gg',
    gnosisTestPath: 'open-source/gnosis/examples/impossible-systems.test.gg',
    summary:
      'Models semantic, prosodic, and biometric token lanes, injecting noise into identity-bearing RVQ layers before anything is folded into the public mesh.',
    invariants: [
      'identity-bearing layers are noised before the public fold',
      'semantic and prosodic lanes remain part of the folded output',
    ],
  },
  {
    id: 'crdt-split-brain-prevention',
    title: 'CRDT Split-Brain Prevention',
    aeonSurface: 'topology',
    gnosisExamplePath: 'open-source/gnosis/examples/crdt-split-brain-prevention.gg',
    gnosisTestPath: 'open-source/gnosis/examples/impossible-systems.test.gg',
    summary:
      'Models geographically separated replicas, nonce-scoped replay guards, and deterministic CRDT observation collapsing to one canonical state.',
    invariants: [
      'replica writes carry distinct nonce identities',
      'deterministic CRDT observation collapses to one canonical state',
    ],
  },
  {
    id: 'webgpu-graph-flattening',
    title: 'WebGPU Graph Flattening',
    aeonSurface: 'topology',
    gnosisExamplePath: 'open-source/gnosis/examples/webgpu-graph-flattening.gg',
    gnosisTestPath: 'open-source/gnosis/examples/impossible-systems.test.gg',
    summary:
      'Models flattening a pointer-chasing object graph into a contiguous Float32Array path that races a scattered CPU walk.',
    invariants: [
      'the flattened buffer is contiguous Float32Array state',
      'the packed GPU path is explicit in the topology and races the scattered walk',
    ],
  },
] as const satisfies readonly GnosisImpossibleSystemTopology[];

export function getGnosisImpossibleSystemTopology(
  id: GnosisImpossibleSystemId
): GnosisImpossibleSystemTopology | undefined {
  return GNOSIS_IMPOSSIBLE_SYSTEM_TOPOLOGIES.find((topology) => topology.id === id);
}
