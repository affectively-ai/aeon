/**
 * DAG Completeness — executable coverage for THM-COMPLETENESS-DAG
 *
 * Validates the finite-DAG decomposition claim operationally:
 * every node in a finite DAG falls into exactly one local class:
 * fork (out-degree > 1), join (in-degree > 1), or chain (otherwise).
 */

import { describe, expect, it } from 'vitest';

type NodeClass = 'fork' | 'join' | 'chain';

interface Dag {
  readonly nodeCount: number;
  readonly edges: ReadonlyArray<readonly [from: number, to: number]>;
}

interface Decomposition {
  readonly forks: Set<number>;
  readonly joins: Set<number>;
  readonly chains: Set<number>;
}

function lcg(seed: number): () => number {
  let state = seed >>> 0;
  return () => {
    state = (1664525 * state + 1013904223) >>> 0;
    return state / 0xffffffff;
  };
}

function randomDag(nodeCount: number, density: number, seed: number): Dag {
  const next = lcg(seed);
  const edges: Array<readonly [number, number]> = [];
  for (let from = 0; from < nodeCount; from++) {
    for (let to = from + 1; to < nodeCount; to++) {
      if (next() < density) edges.push([from, to]);
    }
  }
  return { nodeCount, edges };
}

function classifyNode(inDegree: number, outDegree: number): NodeClass {
  if (outDegree > 1) return 'fork';
  if (inDegree > 1) return 'join';
  return 'chain';
}

function decomposeDag(dag: Dag): Decomposition {
  const inDegree = new Array<number>(dag.nodeCount).fill(0);
  const outDegree = new Array<number>(dag.nodeCount).fill(0);

  for (const [from, to] of dag.edges) {
    outDegree[from] += 1;
    inDegree[to] += 1;
  }

  const forks = new Set<number>();
  const joins = new Set<number>();
  const chains = new Set<number>();

  for (let node = 0; node < dag.nodeCount; node++) {
    const nodeClass = classifyNode(inDegree[node], outDegree[node]);
    if (nodeClass === 'fork') forks.add(node);
    else if (nodeClass === 'join') joins.add(node);
    else chains.add(node);
  }

  return { forks, joins, chains };
}

describe('THM-COMPLETENESS-DAG (executable finite-DAG decomposition)', () => {
  it('classifies every node into exactly one local class', () => {
    for (let seed = 1; seed <= 64; seed++) {
      const dag = randomDag(12, 0.35, seed);
      const decomposition = decomposeDag(dag);

      const seen = new Set<number>();
      for (const node of decomposition.forks) seen.add(node);
      for (const node of decomposition.joins) seen.add(node);
      for (const node of decomposition.chains) seen.add(node);

      expect(seen.size).toBe(dag.nodeCount);

      for (let node = 0; node < dag.nodeCount; node++) {
        const memberships =
          Number(decomposition.forks.has(node)) +
          Number(decomposition.joins.has(node)) +
          Number(decomposition.chains.has(node));
        expect(memberships).toBe(1);
      }
    }
  });

  it('preserves DAG acyclicity precondition in generated samples', () => {
    for (let seed = 100; seed < 132; seed++) {
      const dag = randomDag(10, 0.45, seed);
      for (const [from, to] of dag.edges) {
        expect(from).toBeLessThan(to);
      }
    }
  });

  it('maps canonical motifs to expected classes', () => {
    const dag: Dag = {
      nodeCount: 7,
      edges: [
        [0, 1],
        [0, 2],
        [0, 3],
        [1, 4],
        [2, 4],
        [3, 5],
        [5, 6],
      ],
    };

    const decomposition = decomposeDag(dag);
    expect(decomposition.forks.has(0)).toBe(true); // 0 -> 1,2,3
    expect(decomposition.joins.has(4)).toBe(true); // 1,2 -> 4
    expect(decomposition.chains.has(6)).toBe(true); // sink
  });

  it('is total on sparse and dense finite DAG regimes', () => {
    const sparse = randomDag(14, 0.08, 7);
    const dense = randomDag(14, 0.75, 7);
    const sparseDecomp = decomposeDag(sparse);
    const denseDecomp = decomposeDag(dense);

    expect(
      sparseDecomp.forks.size + sparseDecomp.joins.size + sparseDecomp.chains.size,
    ).toBe(sparse.nodeCount);
    expect(
      denseDecomp.forks.size + denseDecomp.joins.size + denseDecomp.chains.size,
    ).toBe(dense.nodeCount);
  });

  it('keeps decomposition stable under edge-list permutation', () => {
    const dag = randomDag(11, 0.32, 2026);
    const reversed: Dag = {
      nodeCount: dag.nodeCount,
      edges: [...dag.edges].reverse(),
    };

    const a = decomposeDag(dag);
    const b = decomposeDag(reversed);

    expect(a.forks).toEqual(b.forks);
    expect(a.joins).toEqual(b.joins);
    expect(a.chains).toEqual(b.chains);
  });
});

