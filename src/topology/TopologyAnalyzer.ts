/**
 * TopologyAnalyzer — Compute Betti numbers and topological deficit for DAGs
 *
 * Given a computation graph (nodes + edges), computes:
 *   β₀ = connected components (independent computations)
 *   β₁ = independent cycles / parallel paths (parallelism)
 *   β₂ = voids (unreachable states)
 *
 * Then compares actual β₁ to the problem's intrinsic β₁* to produce
 * the topological deficit Δβ — a quantitative measure of wasted parallelism.
 *
 * Zero dependencies. Works everywhere.
 */

// ============================================================================
// Types
// ============================================================================

/** A node in the computation graph */
export interface ComputationNode {
  /** Unique identifier */
  id: string;
  /** Optional label for diagnostics */
  label?: string;
  /** Node type for structural analysis */
  type?: 'source' | 'sink' | 'fork' | 'join' | 'process';
}

/** A directed edge in the computation graph */
export interface ComputationEdge {
  /** Source node ID */
  from: string;
  /** Target node ID */
  to: string;
  /** Optional label */
  label?: string;
}

/** The computation graph to analyze */
export interface ComputationGraph {
  nodes: ComputationNode[];
  edges: ComputationEdge[];
  /** The problem's intrinsic Betti number — how parallel the problem COULD be */
  intrinsicBeta1?: number;
}

/** Betti numbers of a computation graph */
export interface BettiNumbers {
  /** β₀: connected components (independent computations) */
  beta0: number;
  /** β₁: independent cycles (parallel paths through fork/join pairs) */
  beta1: number;
  /** β₂: voids (estimated from unreachable states in the DAG) */
  beta2: number;
}

/** A detected fork/join pair in the graph */
export interface ForkJoinPair {
  /** The fork node (where paths diverge) */
  forkNode: string;
  /** The join node (where paths converge) */
  joinNode: string;
  /** Number of parallel paths between fork and join */
  parallelPaths: number;
  /** Contribution to β₁ (parallelPaths - 1) */
  beta1Contribution: number;
}

/** Report on topological deficit */
export interface DeficitReport {
  /** The problem's intrinsic β₁* */
  intrinsicBeta1: number;
  /** The implementation's actual β₁ */
  actualBeta1: number;
  /** Δβ = β₁* - β₁ (0 = optimal, >0 = wasted parallelism). Measured in Buleys. */
  deficit: number;
  /** Utilization ratio: β₁ / β₁* (1.0 = fully utilizing natural parallelism) */
  utilization: number;
  /** Human-readable assessment */
  assessment: string;
}

/** Complete topology report */
export interface TopologyReport {
  /** Betti numbers */
  betti: BettiNumbers;
  /** Detected fork/join pairs */
  forkJoinPairs: ForkJoinPair[];
  /** Topological deficit (only if intrinsicBeta1 was provided) */
  deficit?: DeficitReport;
  /** Node count */
  nodeCount: number;
  /** Edge count */
  edgeCount: number;
  /** Is the graph a DAG? */
  isDAG: boolean;
  /** Pipeline Reynolds number estimate (stages / chunks) */
  reynoldsEstimate?: number;
}

// ============================================================================
// Implementation
// ============================================================================

export class TopologyAnalyzer {
  /**
   * Analyze a computation graph and produce a full topology report.
   */
  static analyze(graph: ComputationGraph): TopologyReport {
    const adjacency = buildAdjacency(graph);
    const reverseAdj = buildReverseAdjacency(graph);
    const nodeIds = graph.nodes.map(n => n.id);

    const beta0 = computeBeta0(nodeIds, adjacency);
    const isDAG = checkDAG(nodeIds, adjacency);
    const forkJoinPairs = detectForkJoinPairs(nodeIds, adjacency, reverseAdj);
    const beta1 = computeBeta1(graph.nodes.length, graph.edges.length, beta0, forkJoinPairs);
    const beta2 = estimateBeta2(nodeIds, adjacency, reverseAdj);

    const betti: BettiNumbers = { beta0, beta1, beta2 };

    const report: TopologyReport = {
      betti,
      forkJoinPairs,
      nodeCount: graph.nodes.length,
      edgeCount: graph.edges.length,
      isDAG,
    };

    if (graph.intrinsicBeta1 !== undefined) {
      report.deficit = computeDeficit(betti, graph.intrinsicBeta1);
    }

    return report;
  }

  /**
   * Quick deficit check — just the number, in Buleys.
   * Returns Δβ = intrinsicBeta1 - actualBeta1.
   * 0 Buleys = optimal. >0 Buleys = wasted parallelism.
   * Negative means the system has MORE parallelism than needed (over-forking).
   */
  static deficit(graph: ComputationGraph, intrinsicBeta1: number): number {
    const report = TopologyAnalyzer.analyze({ ...graph, intrinsicBeta1 });
    return report.deficit!.deficit;
  }

  /**
   * Build a computation graph from a fork/race/fold description.
   * Convenience for common patterns.
   */
  static fromForkRaceFold(config: {
    /** Number of forked paths */
    forkWidth: number;
    /** Number of pipeline stages per path */
    stagesPerPath?: number;
    /** The problem's intrinsic β₁* */
    intrinsicBeta1?: number;
  }): ComputationGraph {
    const { forkWidth, stagesPerPath = 1, intrinsicBeta1 } = config;
    const nodes: ComputationNode[] = [];
    const edges: ComputationEdge[] = [];

    // Source node (before fork)
    nodes.push({ id: 'source', type: 'source' });
    // Fork node
    nodes.push({ id: 'fork', type: 'fork' });
    edges.push({ from: 'source', to: 'fork' });

    // Parallel paths with stages
    for (let p = 0; p < forkWidth; p++) {
      const pathNodes: string[] = [];
      for (let s = 0; s < stagesPerPath; s++) {
        const id = `path-${p}-stage-${s}`;
        nodes.push({ id, type: 'process', label: `Path ${p} Stage ${s}` });
        pathNodes.push(id);
      }
      // Connect fork → first stage
      edges.push({ from: 'fork', to: pathNodes[0] });
      // Connect stages sequentially
      for (let s = 1; s < pathNodes.length; s++) {
        edges.push({ from: pathNodes[s - 1], to: pathNodes[s] });
      }
      // Connect last stage → join
      edges.push({ from: pathNodes[pathNodes.length - 1], to: 'join' });
    }

    // Join node (fold)
    nodes.push({ id: 'join', type: 'join' });
    // Sink node (after fold)
    nodes.push({ id: 'sink', type: 'sink' });
    edges.push({ from: 'join', to: 'sink' });

    return { nodes, edges, intrinsicBeta1 };
  }

  /**
   * Build a sequential pipeline graph (β₁ = 0).
   * The degenerate case — Ford's assembly line.
   */
  static sequential(stages: number, intrinsicBeta1?: number): ComputationGraph {
    const nodes: ComputationNode[] = [];
    const edges: ComputationEdge[] = [];

    for (let i = 0; i < stages; i++) {
      nodes.push({ id: `stage-${i}`, type: 'process', label: `Stage ${i}` });
      if (i > 0) {
        edges.push({ from: `stage-${i - 1}`, to: `stage-${i}` });
      }
    }

    return { nodes, edges, intrinsicBeta1 };
  }
}

// ============================================================================
// Graph Algorithms
// ============================================================================

function buildAdjacency(graph: ComputationGraph): Map<string, string[]> {
  const adj = new Map<string, string[]>();
  for (const node of graph.nodes) {
    adj.set(node.id, []);
  }
  for (const edge of graph.edges) {
    const list = adj.get(edge.from);
    if (list) list.push(edge.to);
  }
  return adj;
}

function buildReverseAdjacency(graph: ComputationGraph): Map<string, string[]> {
  const adj = new Map<string, string[]>();
  for (const node of graph.nodes) {
    adj.set(node.id, []);
  }
  for (const edge of graph.edges) {
    const list = adj.get(edge.to);
    if (list) list.push(edge.from);
  }
  return adj;
}

/** β₀: connected components via union-find */
function computeBeta0(nodeIds: string[], adjacency: Map<string, string[]>): number {
  const parent = new Map<string, string>();
  const rank = new Map<string, number>();

  for (const id of nodeIds) {
    parent.set(id, id);
    rank.set(id, 0);
  }

  function find(x: string): string {
    let root = x;
    while (parent.get(root) !== root) {
      root = parent.get(root)!;
    }
    // Path compression
    let current = x;
    while (current !== root) {
      const next = parent.get(current)!;
      parent.set(current, root);
      current = next;
    }
    return root;
  }

  function union(a: string, b: string): void {
    const ra = find(a);
    const rb = find(b);
    if (ra === rb) return;
    const rankA = rank.get(ra)!;
    const rankB = rank.get(rb)!;
    if (rankA < rankB) {
      parent.set(ra, rb);
    } else if (rankA > rankB) {
      parent.set(rb, ra);
    } else {
      parent.set(rb, ra);
      rank.set(ra, rankA + 1);
    }
  }

  // Union all edges (treating as undirected for connectivity)
  for (const [from, tos] of adjacency) {
    for (const to of tos) {
      union(from, to);
    }
  }

  const roots = new Set<string>();
  for (const id of nodeIds) {
    roots.add(find(id));
  }
  return roots.size;
}

/** Check if the graph is a DAG (no cycles) via topological sort */
function checkDAG(nodeIds: string[], adjacency: Map<string, string[]>): boolean {
  const inDegree = new Map<string, number>();
  for (const id of nodeIds) {
    inDegree.set(id, 0);
  }
  for (const [, tos] of adjacency) {
    for (const to of tos) {
      inDegree.set(to, (inDegree.get(to) || 0) + 1);
    }
  }

  const queue: string[] = [];
  for (const [id, deg] of inDegree) {
    if (deg === 0) queue.push(id);
  }

  let processed = 0;
  while (queue.length > 0) {
    const node = queue.shift()!;
    processed++;
    for (const neighbor of adjacency.get(node) || []) {
      const newDeg = inDegree.get(neighbor)! - 1;
      inDegree.set(neighbor, newDeg);
      if (newDeg === 0) queue.push(neighbor);
    }
  }

  return processed === nodeIds.length;
}

/**
 * Detect fork/join pairs.
 *
 * A fork is a node with out-degree > 1.
 * A join is a node with in-degree > 1.
 * We pair them by finding the nearest downstream join for each fork
 * (the immediate dominator in the reverse graph, approximated by
 * finding the first node reachable from ALL fork children).
 */
function detectForkJoinPairs(
  nodeIds: string[],
  adjacency: Map<string, string[]>,
  reverseAdj: Map<string, string[]>,
): ForkJoinPair[] {
  const pairs: ForkJoinPair[] = [];

  // Find fork nodes (out-degree > 1)
  for (const id of nodeIds) {
    const children = adjacency.get(id) || [];
    if (children.length <= 1) continue;

    // For each fork, find the nearest join: BFS from each child,
    // find the first node reachable from ALL children
    const reachSets: Set<string>[] = children.map(child => {
      const reachable = new Set<string>();
      const q = [child];
      while (q.length > 0) {
        const n = q.shift()!;
        if (reachable.has(n)) continue;
        reachable.add(n);
        for (const next of adjacency.get(n) || []) {
          q.push(next);
        }
      }
      return reachable;
    });

    // Intersection of all reach sets
    if (reachSets.length === 0) continue;
    const intersection = new Set<string>();
    for (const candidate of reachSets[0]) {
      if (reachSets.every(s => s.has(candidate))) {
        intersection.add(candidate);
      }
    }

    // Find the nearest join node (smallest BFS distance from fork)
    if (intersection.size > 0) {
      let nearest: string | null = null;
      let nearestDist = Infinity;
      const distQueue: [string, number][] = [[id, 0]];
      const visited = new Set<string>();
      while (distQueue.length > 0) {
        const [n, d] = distQueue.shift()!;
        if (visited.has(n)) continue;
        visited.add(n);
        if (intersection.has(n) && n !== id) {
          if (d < nearestDist) {
            nearest = n;
            nearestDist = d;
          }
          break; // BFS guarantees this is nearest
        }
        for (const next of adjacency.get(n) || []) {
          distQueue.push([next, d + 1]);
        }
      }

      if (nearest) {
        const parallelPaths = children.length;
        pairs.push({
          forkNode: id,
          joinNode: nearest,
          parallelPaths,
          beta1Contribution: parallelPaths - 1,
        });
      }
    }
  }

  return pairs;
}

/**
 * β₁: independent parallel paths.
 *
 * For DAGs with fork/join structure, β₁ is the sum of (parallelPaths - 1)
 * across all fork/join pairs. This counts independent cycles in the
 * undirected version of the graph.
 *
 * For general graphs: β₁ = E - V + β₀ (Euler characteristic).
 * We use the fork/join count when pairs are detected (more informative),
 * and fall back to Euler characteristic otherwise.
 */
function computeBeta1(
  V: number,
  E: number,
  beta0: number,
  forkJoinPairs: ForkJoinPair[],
): number {
  if (forkJoinPairs.length > 0) {
    return forkJoinPairs.reduce((sum, pair) => sum + pair.beta1Contribution, 0);
  }
  // Euler characteristic fallback
  return Math.max(0, E - V + beta0);
}

/**
 * β₂: estimate voids (unreachable states).
 *
 * In a fork/race/fold DAG, a void is a dead-end path — a node reachable
 * from the source that cannot reach the primary sink. These are paths
 * that were forked but lead nowhere (not even to a vent).
 *
 * We identify the primary sink as the sink with the largest backward
 * reachability set (the "real" output). Other sinks are dead ends.
 * β₂ counts nodes reachable from sources that cannot reach the primary sink.
 *
 * For well-formed fork/race/fold graphs, β₂ should be 0.
 */
function estimateBeta2(
  nodeIds: string[],
  adjacency: Map<string, string[]>,
  reverseAdj: Map<string, string[]>,
): number {
  // Find sources (in-degree 0) and sinks (out-degree 0)
  const sources = nodeIds.filter(id => (reverseAdj.get(id) || []).length === 0);
  const sinks = nodeIds.filter(id => (adjacency.get(id) || []).length === 0);

  if (sources.length === 0 || sinks.length <= 1) return 0;

  // Find the primary sink: the one with the largest backward reachability
  let primarySink = sinks[0];
  let primaryReachSize = 0;

  for (const sink of sinks) {
    const reachable = new Set<string>();
    const q = [sink];
    while (q.length > 0) {
      const n = q.shift()!;
      if (reachable.has(n)) continue;
      reachable.add(n);
      for (const prev of reverseAdj.get(n) || []) {
        q.push(prev);
      }
    }
    if (reachable.size > primaryReachSize) {
      primaryReachSize = reachable.size;
      primarySink = sink;
    }
  }

  // Forward reachability from sources
  const forwardReachable = new Set<string>();
  const fq = [...sources];
  while (fq.length > 0) {
    const n = fq.shift()!;
    if (forwardReachable.has(n)) continue;
    forwardReachable.add(n);
    for (const next of adjacency.get(n) || []) {
      fq.push(next);
    }
  }

  // Backward reachability from primary sink only
  const backwardReachable = new Set<string>();
  const bq = [primarySink];
  while (bq.length > 0) {
    const n = bq.shift()!;
    if (backwardReachable.has(n)) continue;
    backwardReachable.add(n);
    for (const prev of reverseAdj.get(n) || []) {
      bq.push(prev);
    }
  }

  // Void nodes: reachable from source but cannot reach the primary sink
  let voids = 0;
  for (const id of nodeIds) {
    if (forwardReachable.has(id) && !backwardReachable.has(id)) {
      voids++;
    }
  }

  return voids;
}

/** Compute the topological deficit */
function computeDeficit(betti: BettiNumbers, intrinsicBeta1: number): DeficitReport {
  const deficit = intrinsicBeta1 - betti.beta1;
  const utilization = intrinsicBeta1 === 0 ? 1.0 : Math.min(1.0, betti.beta1 / intrinsicBeta1);

  let assessment: string;
  if (deficit === 0) {
    assessment = 'Optimal: 0 Buleys — implementation topology matches problem topology';
  } else if (deficit < 0) {
    assessment = `Over-forked: ${-deficit} excess parallel paths beyond the problem's intrinsic β₁* = ${intrinsicBeta1}`;
  } else if (utilization >= 0.8) {
    assessment = `Near-optimal: ${deficit} Buley${deficit !== 1 ? 's' : ''} of waste — ${(utilization * 100).toFixed(0)}% of natural parallelism utilized`;
  } else if (utilization >= 0.5) {
    assessment = `Underutilized: ${deficit} Buley${deficit !== 1 ? 's' : ''} of waste — ${(utilization * 100).toFixed(0)}% of natural parallelism utilized`;
  } else if (betti.beta1 === 0) {
    assessment = `Sequential bottleneck: ${deficit} Buley${deficit !== 1 ? 's' : ''} of waste — β₁ = 0 on a problem with intrinsic β₁* = ${intrinsicBeta1}`;
  } else {
    assessment = `Severely underutilized: ${deficit} Buley${deficit !== 1 ? 's' : ''} of waste — ${(utilization * 100).toFixed(0)}% of natural parallelism utilized`;
  }

  return {
    intrinsicBeta1,
    actualBeta1: betti.beta1,
    deficit,
    utilization,
    assessment,
  };
}
