/**
 * DAG Completeness — executable coverage for THM-COMPLETENESS-DAG
 *
 * Validates the finite-DAG decomposition claim constructively:
 * 1) every node in a finite DAG falls into exactly one local class
 * 2) every edge is covered exactly once by a junction-chain segment
 * 3) decomposition preserves full source->sink path semantics
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

interface DagTopology {
  readonly inDegree: readonly number[];
  readonly outDegree: readonly number[];
  readonly outgoing: ReadonlyArray<ReadonlyArray<number>>;
  readonly sources: ReadonlySet<number>;
  readonly sinks: ReadonlySet<number>;
}

interface Segment {
  readonly from: number;
  readonly to: number;
  readonly via: ReadonlyArray<number>;
  readonly edges: ReadonlyArray<readonly [from: number, to: number]>;
}

interface JunctionChainDecomposition {
  readonly junctions: ReadonlySet<number>;
  readonly segments: ReadonlyArray<Segment>;
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

function buildTopology(dag: Dag): DagTopology {
  const inDegree = new Array<number>(dag.nodeCount).fill(0);
  const outDegree = new Array<number>(dag.nodeCount).fill(0);
  const outgoing: Array<number[]> = Array.from({ length: dag.nodeCount }, () => []);

  for (const [from, to] of dag.edges) {
    outDegree[from] += 1;
    inDegree[to] += 1;
    outgoing[from].push(to);
  }

  const sources = new Set<number>();
  const sinks = new Set<number>();
  for (let node = 0; node < dag.nodeCount; node++) {
    if (inDegree[node] === 0) sources.add(node);
    if (outDegree[node] === 0) sinks.add(node);
  }

  return { inDegree, outDegree, outgoing, sources, sinks };
}

function classifyNode(inDegree: number, outDegree: number): NodeClass {
  if (outDegree > 1) return 'fork';
  if (inDegree > 1) return 'join';
  return 'chain';
}

function decomposeDag(dag: Dag): Decomposition {
  const topology = buildTopology(dag);

  const forks = new Set<number>();
  const joins = new Set<number>();
  const chains = new Set<number>();

  for (let node = 0; node < dag.nodeCount; node++) {
    const nodeClass = classifyNode(topology.inDegree[node], topology.outDegree[node]);
    if (nodeClass === 'fork') forks.add(node);
    else if (nodeClass === 'join') joins.add(node);
    else chains.add(node);
  }

  return { forks, joins, chains };
}

function isJunctionNode(
  node: number,
  decomposition: Decomposition,
  topology: DagTopology,
): boolean {
  return (
    decomposition.forks.has(node) ||
    decomposition.joins.has(node) ||
    topology.sources.has(node) ||
    topology.sinks.has(node)
  );
}

function toJunctionChainDecomposition(dag: Dag): JunctionChainDecomposition {
  const topology = buildTopology(dag);
  const decomposition = decomposeDag(dag);
  const junctions = new Set<number>();
  for (let node = 0; node < dag.nodeCount; node++) {
    if (isJunctionNode(node, decomposition, topology)) {
      junctions.add(node);
    }
  }

  const segments: Segment[] = [];
  for (const junction of junctions) {
    for (const next of topology.outgoing[junction]) {
      const via: number[] = [];
      const segmentEdges: Array<readonly [number, number]> = [[junction, next]];
      let cursor = next;

      while (!isJunctionNode(cursor, decomposition, topology)) {
        via.push(cursor);
        const cursorOutgoing = topology.outgoing[cursor];
        if (cursorOutgoing.length !== 1) {
          throw new Error(
            `Expected chain node ${cursor} to have exactly one outgoing edge`,
          );
        }
        const successor = cursorOutgoing[0];
        if (successor === undefined) {
          throw new Error(`Missing successor for node ${cursor}`);
        }
        segmentEdges.push([cursor, successor]);
        cursor = successor;
      }

      segments.push({
        from: junction,
        to: cursor,
        via,
        edges: segmentEdges,
      });
    }
  }

  return { junctions, segments };
}

function enumerateSourceSinkPaths(dag: Dag): number[][] {
  const topology = buildTopology(dag);
  const paths: number[][] = [];
  const orderedSources = [...topology.sources].sort((a, b) => a - b);

  const walk = (node: number, currentPath: readonly number[]): void => {
    const nextPath = [...currentPath, node];
    if (topology.sinks.has(node)) {
      paths.push(nextPath);
      return;
    }
    for (const next of topology.outgoing[node]) {
      walk(next, nextPath);
    }
  };

  for (const source of orderedSources) {
    walk(source, []);
  }

  return paths;
}

function enumerateExpandedPathsFromSegments(dag: Dag): number[][] {
  const topology = buildTopology(dag);
  const junctionChain = toJunctionChainDecomposition(dag);
  const segmentsByFrom = new Map<number, Segment[]>();
  for (const segment of junctionChain.segments) {
    const existing = segmentsByFrom.get(segment.from);
    if (existing === undefined) {
      segmentsByFrom.set(segment.from, [segment]);
    } else {
      existing.push(segment);
    }
  }

  const paths: number[][] = [];
  const orderedSources = [...topology.sources].sort((a, b) => a - b);

  const walk = (node: number, currentPath: readonly number[]): void => {
    if (topology.sinks.has(node)) {
      paths.push([...currentPath]);
      return;
    }

    const outgoingSegments = segmentsByFrom.get(node);
    if (outgoingSegments === undefined || outgoingSegments.length === 0) {
      throw new Error(`Node ${node} is not a sink but has no decomposition segments`);
    }

    for (const segment of outgoingSegments) {
      walk(segment.to, [...currentPath, ...segment.via, segment.to]);
    }
  };

  for (const source of orderedSources) {
    walk(source, [source]);
  }

  return paths;
}

function canonicalizePaths(paths: readonly (readonly number[])[]): string[] {
  return [...new Set(paths.map((path) => path.join('->')))].sort();
}

function edgeKey(from: number, to: number): string {
  return `${from}->${to}`;
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

  it('covers each original edge exactly once in the junction-chain decomposition', () => {
    for (let seed = 301; seed < 333; seed++) {
      const dag = randomDag(11, 0.33, seed);
      const decomposition = toJunctionChainDecomposition(dag);

      const originalEdgeKeys = dag.edges
        .map(([from, to]) => edgeKey(from, to))
        .sort();
      const coveredEdgeKeys = decomposition.segments
        .flatMap((segment) =>
          segment.edges.map(([from, to]) => edgeKey(from, to)),
        )
        .sort();

      expect(coveredEdgeKeys.length).toBe(dag.edges.length);
      expect(new Set(coveredEdgeKeys).size).toBe(coveredEdgeKeys.length);
      expect(coveredEdgeKeys).toEqual(originalEdgeKeys);
    }
  });

  it('preserves full source-to-sink path semantics under decomposition', () => {
    for (let seed = 401; seed < 425; seed++) {
      const dag = randomDag(10, 0.35, seed);
      const originalPaths = canonicalizePaths(enumerateSourceSinkPaths(dag));
      const decomposedPaths = canonicalizePaths(
        enumerateExpandedPathsFromSegments(dag),
      );

      expect(decomposedPaths).toEqual(originalPaths);
    }
  });
});
