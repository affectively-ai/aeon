import { describe, it, expect } from 'vitest';
import {
  TopologyAnalyzer,
  TopologySampler,
  type ComputationGraph,
} from '../../topology';

// ============================================================================
// TopologyAnalyzer — Static graph analysis
// ============================================================================

describe('TopologyAnalyzer', () => {
  describe('Betti numbers', () => {
    it('sequential pipeline has β₁ = 0', () => {
      const graph = TopologyAnalyzer.sequential(5);
      const report = TopologyAnalyzer.analyze(graph);

      expect(report.betti.beta0).toBe(1);
      expect(report.betti.beta1).toBe(0);
      expect(report.betti.beta2).toBe(0);
      expect(report.isDAG).toBe(true);
      expect(report.forkJoinPairs).toHaveLength(0);
    });

    it('single fork/join has β₁ = N-1', () => {
      const graph = TopologyAnalyzer.fromForkRaceFold({ forkWidth: 4 });
      const report = TopologyAnalyzer.analyze(graph);

      expect(report.betti.beta1).toBe(3); // 4 paths - 1
      expect(report.forkJoinPairs).toHaveLength(1);
      expect(report.forkJoinPairs[0].parallelPaths).toBe(4);
      expect(report.forkJoinPairs[0].beta1Contribution).toBe(3);
    });

    it('8-codec topological compressor has β₁ = 7', () => {
      const graph = TopologyAnalyzer.fromForkRaceFold({ forkWidth: 8 });
      const report = TopologyAnalyzer.analyze(graph);

      expect(report.betti.beta1).toBe(7);
    });

    it('single path has β₁ = 0', () => {
      const graph = TopologyAnalyzer.fromForkRaceFold({ forkWidth: 1 });
      const report = TopologyAnalyzer.analyze(graph);

      expect(report.betti.beta1).toBe(0);
    });

    it('disconnected components increase β₀', () => {
      const graph: ComputationGraph = {
        nodes: [
          { id: 'a1' }, { id: 'a2' },
          { id: 'b1' }, { id: 'b2' },
        ],
        edges: [
          { from: 'a1', to: 'a2' },
          { from: 'b1', to: 'b2' },
        ],
      };
      const report = TopologyAnalyzer.analyze(graph);

      expect(report.betti.beta0).toBe(2);
    });

    it('fork/join with staged paths', () => {
      const graph = TopologyAnalyzer.fromForkRaceFold({
        forkWidth: 3,
        stagesPerPath: 4,
      });
      const report = TopologyAnalyzer.analyze(graph);

      // Still 3 parallel paths regardless of depth
      expect(report.betti.beta1).toBe(2);
      expect(report.nodeCount).toBe(3 * 4 + 4); // 12 process + source/fork/join/sink
    });
  });

  describe('Topological deficit', () => {
    it('Δβ = 0 when topology matches problem', () => {
      const graph = TopologyAnalyzer.fromForkRaceFold({
        forkWidth: 4,
        intrinsicBeta1: 3,
      });
      const report = TopologyAnalyzer.analyze(graph);

      expect(report.deficit).toBeDefined();
      expect(report.deficit!.deficit).toBe(0);
      expect(report.deficit!.utilization).toBe(1.0);
      expect(report.deficit!.assessment).toContain('0 Buleys');
    });

    it('Δβ > 0 when implementation is too sequential', () => {
      const graph = TopologyAnalyzer.sequential(5, 3);
      const report = TopologyAnalyzer.analyze(graph);

      expect(report.deficit!.deficit).toBe(3);
      expect(report.deficit!.utilization).toBe(0);
      expect(report.deficit!.assessment).toContain('Buleys of waste');
    });

    it('Δβ < 0 when over-forked', () => {
      const graph = TopologyAnalyzer.fromForkRaceFold({
        forkWidth: 8,
        intrinsicBeta1: 3,
      });
      const report = TopologyAnalyzer.analyze(graph);

      expect(report.deficit!.deficit).toBe(-4);
      expect(report.deficit!.assessment).toContain('Over-forked');
    });

    it('quick deficit check', () => {
      const graph = TopologyAnalyzer.sequential(5);
      expect(TopologyAnalyzer.deficit(graph, 7)).toBe(7);
    });

    it('healthcare referral chain: Δβ ≥ 3', () => {
      // Sequential referral: GP → specialist → imaging → diagnosis
      const graph = TopologyAnalyzer.sequential(4, 3);
      const report = TopologyAnalyzer.analyze(graph);

      expect(report.deficit!.deficit).toBe(3);
      expect(report.deficit!.assessment).toContain('Buleys of waste');
    });

    it('healthcare with parallel tests: Δβ = 0', () => {
      // Fork: blood test, MRI, genetic screen, specialist — all parallel
      const graph = TopologyAnalyzer.fromForkRaceFold({
        forkWidth: 4,
        intrinsicBeta1: 3,
      });
      const report = TopologyAnalyzer.analyze(graph);

      expect(report.deficit!.deficit).toBe(0);
      expect(report.deficit!.assessment).toContain('0 Buleys');
    });
  });

  describe('β₂ (void detection)', () => {
    it('well-formed fork/join has β₂ = 0', () => {
      const graph = TopologyAnalyzer.fromForkRaceFold({ forkWidth: 4 });
      const report = TopologyAnalyzer.analyze(graph);

      expect(report.betti.beta2).toBe(0);
    });

    it('dead-end path has β₂ > 0', () => {
      const graph: ComputationGraph = {
        nodes: [
          { id: 'source' },
          { id: 'fork' },
          { id: 'path-a' },
          { id: 'path-b' },
          { id: 'dead-end' }, // reachable but can't reach sink
          { id: 'join' },
          { id: 'sink' },
        ],
        edges: [
          { from: 'source', to: 'fork' },
          { from: 'fork', to: 'path-a' },
          { from: 'fork', to: 'path-b' },
          { from: 'fork', to: 'dead-end' },
          { from: 'path-a', to: 'join' },
          { from: 'path-b', to: 'join' },
          // dead-end has no outgoing edge to join
          { from: 'join', to: 'sink' },
        ],
      };
      const report = TopologyAnalyzer.analyze(graph);

      expect(report.betti.beta2).toBe(1); // dead-end is a void
    });
  });

  describe('DAG detection', () => {
    it('detects DAGs', () => {
      const graph = TopologyAnalyzer.fromForkRaceFold({ forkWidth: 3 });
      expect(TopologyAnalyzer.analyze(graph).isDAG).toBe(true);
    });

    it('detects cycles', () => {
      const graph: ComputationGraph = {
        nodes: [{ id: 'a' }, { id: 'b' }, { id: 'c' }],
        edges: [
          { from: 'a', to: 'b' },
          { from: 'b', to: 'c' },
          { from: 'c', to: 'a' }, // cycle
        ],
      };
      expect(TopologyAnalyzer.analyze(graph).isDAG).toBe(false);
    });
  });

  describe('Real-world topologies from §6.12', () => {
    it('HTTP/2 over TCP: application β₁ > 0, transport β₁ = 0', () => {
      // HTTP/2 application layer wants 100 concurrent streams
      // TCP transport forces them through one ordered pipe
      const transport = TopologyAnalyzer.sequential(1, 99);
      const report = TopologyAnalyzer.analyze(transport);

      expect(report.deficit!.deficit).toBe(99);
      expect(report.deficit!.utilization).toBe(0);
    });

    it('Aeon Flow: β₁ matches problem', () => {
      // 100 streams, each independent
      const flow = TopologyAnalyzer.fromForkRaceFold({
        forkWidth: 100,
        intrinsicBeta1: 99,
      });
      const report = TopologyAnalyzer.analyze(flow);

      expect(report.deficit!.deficit).toBe(0);
      expect(report.deficit!.utilization).toBe(1.0);
    });
  });
});

// ============================================================================
// TopologySampler — Runtime sampling
// ============================================================================

describe('TopologySampler', () => {
  it('tracks fork/race/vent/fold lifecycle', () => {
    const sampler = new TopologySampler({ intrinsicBeta1: 7 });

    // Fork 8 codecs
    sampler.fork('chunk-1', ['raw', 'rle', 'delta', 'lz77', 'brotli', 'gzip', 'huffman', 'dict']);
    expect(sampler.currentBeta1()).toBe(7);
    expect(sampler.currentDeficit()).toBe(0);

    // Race: brotli wins
    sampler.race('chunk-1', 'brotli');

    // Vent losers
    sampler.vent('chunk-1', 'raw');
    sampler.vent('chunk-1', 'rle');
    sampler.vent('chunk-1', 'delta');
    sampler.vent('chunk-1', 'lz77');
    sampler.vent('chunk-1', 'gzip');
    sampler.vent('chunk-1', 'huffman');
    sampler.vent('chunk-1', 'dict');
    expect(sampler.currentBeta1()).toBe(0); // only brotli left

    // Fold
    sampler.fold('chunk-1');
    expect(sampler.currentBeta1()).toBe(0);

    const report = sampler.report();
    expect(report.totals.forks).toBe(1);
    expect(report.totals.folds).toBe(1);
    expect(report.totals.vents).toBe(7);
    expect(report.totals.races).toBe(1);
    expect(report.peakBeta1).toBe(7);
  });

  it('handles concurrent forks', () => {
    const sampler = new TopologySampler({ intrinsicBeta1: 5 });

    sampler.fork('req-1', ['a', 'b', 'c']);
    expect(sampler.currentBeta1()).toBe(2);

    sampler.fork('req-2', ['x', 'y', 'z', 'w']);
    expect(sampler.currentBeta1()).toBe(5); // 2 + 3

    sampler.fold('req-1');
    expect(sampler.currentBeta1()).toBe(3); // only req-2

    sampler.fold('req-2');
    expect(sampler.currentBeta1()).toBe(0);
  });

  it('reports vent ratio (Q / (Q + W))', () => {
    const sampler = new TopologySampler({ intrinsicBeta1: 3 });

    sampler.fork('r1', ['a', 'b', 'c', 'd']);
    sampler.race('r1', 'a');
    sampler.vent('r1', 'b');
    sampler.vent('r1', 'c');
    sampler.vent('r1', 'd');
    sampler.fold('r1');

    const report = sampler.report();
    expect(report.ventRatio).toBe(3 / 4); // 3 vents, 1 race
    expect(report.efficiency).toBe(1 / 4); // 1 race / 4 total
  });

  it('sequential system has zero utilization', () => {
    const sampler = new TopologySampler({ intrinsicBeta1: 7 });

    // Process sequentially — no forks at all
    // Just record a sample
    sampler.sample();

    const report = sampler.report();
    expect(report.meanBeta1).toBe(0);
    expect(report.meanUtilization).toBe(0);
    expect(report.meanDeficit).toBe(7);
  });

  it('reset clears all state', () => {
    const sampler = new TopologySampler({ intrinsicBeta1: 3 });
    sampler.fork('r1', ['a', 'b']);
    sampler.fold('r1');

    sampler.reset();

    expect(sampler.currentBeta1()).toBe(0);
    const report = sampler.report();
    expect(report.sampleCount).toBe(0);
    expect(report.totals.forks).toBe(0);
  });

  it('ring buffer caps sample count', () => {
    const sampler = new TopologySampler({
      intrinsicBeta1: 1,
      maxSamples: 5,
    });

    for (let i = 0; i < 20; i++) {
      sampler.sample();
    }

    const report = sampler.report();
    expect(report.samples.length).toBeLessThanOrEqual(5);
  });
});
