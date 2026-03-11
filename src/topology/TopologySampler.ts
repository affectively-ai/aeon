/**
 * TopologySampler — Runtime sampling of topological deficit
 *
 * Instruments a live system by recording fork/race/fold/vent events
 * and periodically computing the topological deficit. Produces a
 * time-series of Betti numbers and deficit measurements.
 *
 * Usage:
 *   const sampler = new TopologySampler({ intrinsicBeta1: 7 });
 *   sampler.fork('request-1', ['path-a', 'path-b', 'path-c']);
 *   sampler.race('request-1', 'path-a');  // path-a won
 *   sampler.vent('request-1', 'path-b');
 *   sampler.vent('request-1', 'path-c');
 *   sampler.fold('request-1');
 *   const report = sampler.report();
 *
 * Zero dependencies. Works everywhere.
 */

// ============================================================================
// Types
// ============================================================================

export interface SamplerConfig {
  /** The problem's intrinsic β₁* */
  intrinsicBeta1: number;
  /** Maximum number of samples to retain (ring buffer). Default: 1000 */
  maxSamples?: number;
}

/** A single point-in-time sample */
export interface Sample {
  /** Timestamp (ms since epoch) */
  timestamp: number;
  /** Number of active forks at this moment */
  activeForks: number;
  /** Total parallel paths across all active forks */
  activeParallelPaths: number;
  /** Instantaneous β₁ (sum of parallelPaths - 1 per active fork) */
  beta1: number;
  /** Instantaneous deficit: β₁* - β₁ */
  deficit: number;
  /** Instantaneous utilization: β₁ / β₁* */
  utilization: number;
  /** Cumulative forks emitted */
  totalForks: number;
  /** Cumulative folds completed */
  totalFolds: number;
  /** Cumulative vents */
  totalVents: number;
  /** Cumulative races won */
  totalRaces: number;
}

/** Aggregate report over all samples */
export interface SamplerReport {
  /** Problem's intrinsic β₁* */
  intrinsicBeta1: number;
  /** Number of samples collected */
  sampleCount: number;
  /** Time-weighted average β₁ */
  meanBeta1: number;
  /** Peak β₁ observed */
  peakBeta1: number;
  /** Time-weighted average deficit */
  meanDeficit: number;
  /** Time-weighted average utilization (0–1) */
  meanUtilization: number;
  /** Peak utilization observed */
  peakUtilization: number;
  /** Total forks / folds / vents / races */
  totals: { forks: number; folds: number; vents: number; races: number };
  /** Vent ratio: vents / (vents + races). Higher = more exploration, lower = more exploitation */
  ventRatio: number;
  /** Thermodynamic efficiency estimate: races / (races + vents) ≈ W / (W + Q) */
  efficiency: number;
  /** Human-readable assessment */
  assessment: string;
  /** All retained samples (for plotting) */
  samples: Sample[];
}

// ============================================================================
// Active fork tracking
// ============================================================================

interface ActiveFork {
  id: string;
  paths: Set<string>;
  startTime: number;
  raceWinner?: string;
}

// ============================================================================
// Implementation
// ============================================================================

export class TopologySampler {
  private readonly config: Required<SamplerConfig>;
  private readonly activeForks = new Map<string, ActiveFork>();
  private readonly samples: Sample[] = [];
  private totalForks = 0;
  private totalFolds = 0;
  private totalVents = 0;
  private totalRaces = 0;

  constructor(config: SamplerConfig) {
    this.config = {
      maxSamples: 1000,
      ...config,
    };
  }

  /**
   * Record a fork event: one computation splits into N parallel paths.
   */
  fork(id: string, paths: string[]): void {
    this.activeForks.set(id, {
      id,
      paths: new Set(paths),
      startTime: Date.now(),
    });
    this.totalForks++;
    this.recordSample();
  }

  /**
   * Record a race result: one path won.
   */
  race(id: string, winnerPath: string): void {
    const fork = this.activeForks.get(id);
    if (fork) {
      fork.raceWinner = winnerPath;
    }
    this.totalRaces++;
    this.recordSample();
  }

  /**
   * Record a vent: a path was released (didn't win, errored, timed out).
   */
  vent(id: string, path: string): void {
    const fork = this.activeForks.get(id);
    if (fork) {
      fork.paths.delete(path);
    }
    this.totalVents++;
    this.recordSample();
  }

  /**
   * Record a fold: computation merged to a single result.
   */
  fold(id: string): void {
    this.activeForks.delete(id);
    this.totalFolds++;
    this.recordSample();
  }

  /**
   * Take a snapshot without recording an event (for periodic sampling).
   */
  sample(): Sample {
    return this.recordSample();
  }

  /**
   * Get the current instantaneous deficit.
   */
  currentDeficit(): number {
    const beta1 = this.currentBeta1();
    return this.config.intrinsicBeta1 - beta1;
  }

  /**
   * Get the current instantaneous β₁.
   */
  currentBeta1(): number {
    let beta1 = 0;
    for (const fork of this.activeForks.values()) {
      beta1 += Math.max(0, fork.paths.size - 1);
    }
    return beta1;
  }

  /**
   * Generate the aggregate report.
   */
  report(): SamplerReport {
    const samples = this.samples;
    const n = samples.length;

    if (n === 0) {
      return {
        intrinsicBeta1: this.config.intrinsicBeta1,
        sampleCount: 0,
        meanBeta1: 0,
        peakBeta1: 0,
        meanDeficit: this.config.intrinsicBeta1,
        meanUtilization: 0,
        peakUtilization: 0,
        totals: { forks: 0, folds: 0, vents: 0, races: 0 },
        ventRatio: 0,
        efficiency: 0,
        assessment: 'No samples collected',
        samples: [],
      };
    }

    // Time-weighted averages
    let sumBeta1 = 0;
    let sumDeficit = 0;
    let sumUtilization = 0;
    let peakBeta1 = 0;
    let peakUtilization = 0;

    for (let i = 0; i < n; i++) {
      const s = samples[i];
      const weight = i < n - 1 ? samples[i + 1].timestamp - s.timestamp : 1;
      const w = Math.max(weight, 1); // avoid zero-weight for same-ms samples
      sumBeta1 += s.beta1 * w;
      sumDeficit += s.deficit * w;
      sumUtilization += s.utilization * w;
      if (s.beta1 > peakBeta1) peakBeta1 = s.beta1;
      if (s.utilization > peakUtilization) peakUtilization = s.utilization;
    }

    const totalWeight = n > 1
      ? samples[n - 1].timestamp - samples[0].timestamp + 1
      : 1;

    const meanBeta1 = sumBeta1 / totalWeight;
    const meanDeficit = sumDeficit / totalWeight;
    const meanUtilization = sumUtilization / totalWeight;

    const totalEvents = this.totalRaces + this.totalVents;
    const ventRatio = totalEvents > 0 ? this.totalVents / totalEvents : 0;
    const efficiency = totalEvents > 0 ? this.totalRaces / totalEvents : 0;

    let assessment: string;
    if (meanUtilization >= 0.95) {
      assessment = `Optimal topology: mean utilization ${(meanUtilization * 100).toFixed(1)}%, mean Δβ = ${meanDeficit.toFixed(1)}`;
    } else if (meanUtilization >= 0.7) {
      assessment = `Near-optimal: mean utilization ${(meanUtilization * 100).toFixed(1)}%, mean Δβ = ${meanDeficit.toFixed(1)}. Peak β₁ = ${peakBeta1} shows the system CAN reach higher parallelism`;
    } else if (meanUtilization >= 0.3) {
      assessment = `Underutilized: mean utilization ${(meanUtilization * 100).toFixed(1)}%, mean Δβ = ${meanDeficit.toFixed(1)}. The system is forcing a β₁* = ${this.config.intrinsicBeta1} problem through a β₁ ≈ ${meanBeta1.toFixed(1)} pipe`;
    } else {
      assessment = `Sequential bottleneck: mean utilization ${(meanUtilization * 100).toFixed(1)}%, mean Δβ = ${meanDeficit.toFixed(1)}. Almost all natural parallelism is wasted`;
    }

    return {
      intrinsicBeta1: this.config.intrinsicBeta1,
      sampleCount: n,
      meanBeta1,
      peakBeta1,
      meanDeficit,
      meanUtilization,
      peakUtilization,
      totals: {
        forks: this.totalForks,
        folds: this.totalFolds,
        vents: this.totalVents,
        races: this.totalRaces,
      },
      ventRatio,
      efficiency,
      assessment,
      samples: [...samples],
    };
  }

  /**
   * Reset all state.
   */
  reset(): void {
    this.activeForks.clear();
    this.samples.length = 0;
    this.totalForks = 0;
    this.totalFolds = 0;
    this.totalVents = 0;
    this.totalRaces = 0;
  }

  // ──────────────────────────────────────────────────────────────────────────
  // Internal
  // ──────────────────────────────────────────────────────────────────────────

  private recordSample(): Sample {
    let activeParallelPaths = 0;
    let beta1 = 0;
    for (const fork of this.activeForks.values()) {
      activeParallelPaths += fork.paths.size;
      beta1 += Math.max(0, fork.paths.size - 1);
    }

    const intrinsic = this.config.intrinsicBeta1;
    const deficit = intrinsic - beta1;
    const utilization = intrinsic === 0 ? 1.0 : Math.min(1.0, beta1 / intrinsic);

    const sample: Sample = {
      timestamp: Date.now(),
      activeForks: this.activeForks.size,
      activeParallelPaths,
      beta1,
      deficit,
      utilization,
      totalForks: this.totalForks,
      totalFolds: this.totalFolds,
      totalVents: this.totalVents,
      totalRaces: this.totalRaces,
    };

    this.samples.push(sample);

    // Ring buffer
    if (this.samples.length > this.config.maxSamples) {
      this.samples.shift();
    }

    return sample;
  }
}
