import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

import { describe, expect, it } from 'vitest';

interface Interval {
  readonly low: number;
  readonly high: number;
}

interface Gate1Cell {
  readonly speedupMedian: number;
  readonly speedupMedianCi: Interval;
  readonly improvementMedianMsCi: Interval;
}

interface Gate1Report {
  readonly cells: readonly Gate1Cell[];
  readonly gate: {
    readonly primaryCells: readonly string[];
    readonly passedPrimaryCells: readonly string[];
  };
}

interface Gate2Cell {
  readonly cellId: string;
  readonly framingMedianGainPct: number;
  readonly framingMedianGainPctCi: Interval;
  readonly completionMedianGainMsCi: Interval;
  readonly completionP95GainMsCi: Interval;
}

interface Gate2Report {
  readonly corpus: {
    readonly siteCount: number;
    readonly totalResources: number;
  };
  readonly cells: readonly Gate2Cell[];
  readonly gate: {
    readonly primaryCells: readonly string[];
    readonly passedPrimaryCells: readonly string[];
  };
}

interface Gate3Cell {
  readonly cellId: string;
  readonly medianGainVsBestFixedPctCi: Interval;
  readonly medianGainVsHeuristicPctCi: Interval;
  readonly medianGainVsHeuristicPct: number;
}

interface Gate3Report {
  readonly corpus: {
    readonly sampleCount: number;
    readonly totalBytes: number;
  };
  readonly cells: readonly Gate3Cell[];
  readonly gate: {
    readonly primaryCells: readonly string[];
    readonly passedPrimaryCells: readonly string[];
  };
}

interface Gate4Criterion {
  readonly id: string;
  readonly ci95?: Interval;
}

interface Gate4Report {
  readonly gate: {
    readonly criteria: readonly Gate4Criterion[];
  };
  readonly holdout: {
    readonly monotonicViolations: number;
  };
  readonly config: {
    readonly thresholds: {
      readonly maxDecileMonotonicViolations: number;
    };
  };
}

interface Gate5Report {
  readonly aggregate: {
    readonly minPrimaryPairRatioCiLow: number;
    readonly medianPairRatio: number;
    readonly pooledLogRatio: number;
    readonly pooledLogRatioCi95: Interval;
  };
}

interface QuantumRecombinationAblationReport {
  readonly strategies: {
    readonly linear: {
      readonly profile: {
        readonly preservesKernelAgreement: boolean;
      };
    };
    readonly 'winner-take-all': {
      readonly distances: {
        readonly kernelAgreementDistance: number;
        readonly partitionAdditivityDistance: number;
        readonly cancellationMagnitude2: number;
      };
    };
  };
}

interface ToyAttentionFoldAblationReport {
  readonly label: string;
  readonly strategies: {
    readonly linear: {
      readonly meanSquaredError: number;
      readonly meanSquaredErrorCi95: Interval;
    };
    readonly 'winner-take-all': {
      readonly meanSquaredError: number;
      readonly meanSquaredErrorCi95: Interval;
      readonly exactWithinToleranceFraction: number;
    };
    readonly 'early-stop': {
      readonly meanSquaredError: number;
      readonly meanSquaredErrorCi95: Interval;
      readonly exactWithinToleranceFraction: number;
    };
  };
}

interface GnosisFoldTrainingBenchmarkReport {
  readonly label: string;
  readonly strategies: {
    readonly linear: {
      readonly meanEvalMeanSquaredError: number;
      readonly evalMeanSquaredErrorCi95: Interval;
      readonly meanExactWithinToleranceFraction: number;
      readonly meanCancellationLineMeanAbsoluteError: number;
    };
    readonly 'winner-take-all': {
      readonly meanEvalMeanSquaredError: number;
      readonly evalMeanSquaredErrorCi95: Interval;
      readonly meanExactWithinToleranceFraction: number;
      readonly meanCancellationLineMeanAbsoluteError: number;
    };
    readonly 'early-stop': {
      readonly meanEvalMeanSquaredError: number;
      readonly evalMeanSquaredErrorCi95: Interval;
      readonly meanExactWithinToleranceFraction: number;
      readonly meanCancellationLineMeanAbsoluteError: number;
    };
  };
}

interface GnosisMiniMoeRoutingBenchmarkReport {
  readonly label: string;
  readonly strategies: {
    readonly linear: {
      readonly meanEvalMeanSquaredError: number;
      readonly evalMeanSquaredErrorCi95: Interval;
      readonly meanDualActiveRegionMeanAbsoluteError: number;
    };
    readonly 'winner-take-all': {
      readonly meanEvalMeanSquaredError: number;
      readonly evalMeanSquaredErrorCi95: Interval;
      readonly meanDualActiveRegionMeanAbsoluteError: number;
    };
    readonly 'early-stop': {
      readonly meanEvalMeanSquaredError: number;
      readonly evalMeanSquaredErrorCi95: Interval;
      readonly meanDualActiveRegionMeanAbsoluteError: number;
    };
  };
}

interface GnosisNegativeControlsTaskReport {
  readonly maxEvalMeanSquaredErrorGap: number;
  readonly minExactWithinToleranceFraction: number;
  readonly parityRecovered: boolean;
}

interface GnosisNegativeControlsBenchmarkReport {
  readonly label: string;
  readonly tasks: Record<string, GnosisNegativeControlsTaskReport>;
  readonly allControlsPass: boolean;
}

interface GnosisNearControlSweepReport {
  readonly label: string;
  readonly affine: {
    readonly lastParityRegimeValue: number | null;
    readonly firstSeparatedRegimeValue: number | null;
  };
  readonly routed: {
    readonly lastParityRegimeValue: number | null;
    readonly firstSeparatedRegimeValue: number | null;
  };
}

interface RegimeSweepPointReport {
  readonly linearAdvantageEvalMeanSquaredError: number;
}

interface GnosisFoldBoundaryRegimeSweepReport {
  readonly label: string;
  readonly affine: {
    readonly firstSeparatedRegimeValue: number | null;
    readonly points: readonly RegimeSweepPointReport[];
  };
  readonly routed: {
    readonly firstSeparatedRegimeValue: number | null;
    readonly points: readonly RegimeSweepPointReport[];
  };
}

interface AdversarialStrategySummary {
  readonly meanFinalEvalMeanSquaredError: number;
  readonly meanLearningCurveArea: number;
}

interface GnosisAdversarialControlsBenchmarkReport {
  readonly label: string;
  readonly tasks: Record<
    string,
    {
      readonly strategies: Record<string, AdversarialStrategySummary>;
    }
  >;
}

interface FormalWitnessCatalogReport {
  readonly label: string;
  readonly witnesses: readonly {
    readonly id: string;
  }[];
}

interface FormalAdaptiveWitnessCatalogReport {
  readonly label: string;
  readonly witnesses: readonly {
    readonly id: string;
    readonly alphaLeft: string;
    readonly alphaRight: string;
    readonly driftGap: string;
    readonly spectralRadius: string;
  }[];
}

interface Ch17ReplicationPackReport {
  readonly label: string;
  readonly rootCommand: string;
  readonly entryCount: number;
  readonly artifactCount: number;
  readonly complete: boolean;
}

interface GnosisMoaTransformerEvidenceFamilySummary {
  readonly meanEvalMeanSquaredError: number;
  readonly meanExactWithinToleranceFraction: number;
  readonly meanActiveHeadCount: number;
  readonly meanFrameCount: number;
  readonly computeAdjustedExactFraction: number;
}

interface GnosisMoaTransformerEvidenceScaleReport {
  readonly id: string;
  readonly moaEvalWallTimeSpeedupVsRegular: number;
  readonly families: {
    readonly regular: GnosisMoaTransformerEvidenceFamilySummary;
    readonly moa: GnosisMoaTransformerEvidenceFamilySummary;
  };
}

interface GnosisMoaTransformerEvidenceAblationReport {
  readonly id: string;
  readonly families: {
    readonly regular: GnosisMoaTransformerEvidenceFamilySummary;
    readonly moa: GnosisMoaTransformerEvidenceFamilySummary;
  };
}

interface GnosisMoaTransformerEvidenceReport {
  readonly label: string;
  readonly topologySurface: {
    readonly moaStructuredPrimitive: string;
  };
  readonly scales: readonly GnosisMoaTransformerEvidenceScaleReport[];
  readonly ablations: readonly GnosisMoaTransformerEvidenceAblationReport[];
}

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = join(__dirname, '..', '..');
const MANUSCRIPT_PATH = join(ROOT, 'ch17-arxiv-manuscript.md');
const ARTIFACTS_DIR = join(ROOT, 'companion-tests', 'artifacts');

function loadJson<T>(path: string): T {
  return JSON.parse(readFileSync(path, 'utf8')) as T;
}

function min(values: readonly number[]): number {
  return values.reduce(
    (acc, value) => (value < acc ? value : acc),
    Number.POSITIVE_INFINITY
  );
}

function max(values: readonly number[]): number {
  return values.reduce(
    (acc, value) => (value > acc ? value : acc),
    Number.NEGATIVE_INFINITY
  );
}

function formatInteger(value: number): string {
  return value.toLocaleString('en-US');
}

function formatFixedWithCommas(value: number, digits: number): string {
  const fixed = value.toFixed(digits);
  const [whole, fractional] = fixed.split('.');
  const withCommas = whole.replace(/\B(?=(\d{3})+(?!\d))/g, ',');
  return fractional === undefined ? withCommas : `${withCommas}.${fractional}`;
}

function mustContain(manuscript: string, token: string): void {
  expect(manuscript.includes(token)).toBe(true);
}

describe('Manuscript artifact consistency', () => {
  it('keeps manuscript quantitative claim text synchronized with artifact values', () => {
    const manuscript = readFileSync(MANUSCRIPT_PATH, 'utf8');

    const gate1 = loadJson<Gate1Report>(
      join(ARTIFACTS_DIR, 'gate1-wallclock-external-multihost.json')
    );
    const gate2 = loadJson<Gate2Report>(
      join(ARTIFACTS_DIR, 'gate2-protocol-corpus.json')
    );
    const gate3 = loadJson<Gate3Report>(
      join(ARTIFACTS_DIR, 'gate3-compression-corpus.json')
    );
    const gate4 = loadJson<Gate4Report>(
      join(ARTIFACTS_DIR, 'gate4-rqr-holdout.json')
    );
    const gate5 = loadJson<Gate5Report>(
      join(ARTIFACTS_DIR, 'gate5-bio-effect-size.json')
    );
    const quantumAblation = loadJson<QuantumRecombinationAblationReport>(
      join(ARTIFACTS_DIR, 'quantum-recombination-ablation.json')
    );
    const toyAttentionAblation = loadJson<ToyAttentionFoldAblationReport>(
      join(ARTIFACTS_DIR, 'toy-attention-fold-ablation.json')
    );
    const gnosisTrainingBenchmark = loadJson<GnosisFoldTrainingBenchmarkReport>(
      join(ARTIFACTS_DIR, 'gnosis-fold-training-benchmark.json')
    );
    const gnosisNegativeControls =
      loadJson<GnosisNegativeControlsBenchmarkReport>(
        join(ARTIFACTS_DIR, 'gnosis-negative-controls.json')
      );
    const gnosisNearControl = loadJson<GnosisNearControlSweepReport>(
      join(ARTIFACTS_DIR, 'gnosis-near-control-sweep.json')
    );
    const gnosisRegimeSweep = loadJson<GnosisFoldBoundaryRegimeSweepReport>(
      join(ARTIFACTS_DIR, 'gnosis-fold-boundary-regime-sweep.json')
    );
    const gnosisAdversarialControls =
      loadJson<GnosisAdversarialControlsBenchmarkReport>(
        join(ARTIFACTS_DIR, 'gnosis-adversarial-controls-benchmark.json')
      );
    const gnosisMiniMoeBenchmark =
      loadJson<GnosisMiniMoeRoutingBenchmarkReport>(
        join(ARTIFACTS_DIR, 'gnosis-moe-routing-benchmark.json')
      );
    const gnosisMoaTransformerEvidence =
      loadJson<GnosisMoaTransformerEvidenceReport>(
        join(ARTIFACTS_DIR, 'gnosis-moa-transformer-evidence-benchmark.json')
      );
    const formalWitnessCatalog = loadJson<FormalWitnessCatalogReport>(
      join(ARTIFACTS_DIR, 'formal-witness-catalog.json')
    );
    const formalAdaptiveWitnessCatalog =
      loadJson<FormalAdaptiveWitnessCatalogReport>(
        join(ARTIFACTS_DIR, 'formal-adaptive-witness-catalog.json')
      );
    const replicationPack = loadJson<Ch17ReplicationPackReport>(
      join(ARTIFACTS_DIR, 'ch17-replication-pack.json')
    );
    const compactMoaScale = gnosisMoaTransformerEvidence.scales.find(
      (scale) => scale.id === 'compact'
    );
    const wideMoaScale = gnosisMoaTransformerEvidence.scales.find(
      (scale) => scale.id === 'wide'
    );
    const fullMoa = gnosisMoaTransformerEvidence.ablations.find(
      (ablation) => ablation.id === 'full-moa'
    );
    const noOuterSparsity = gnosisMoaTransformerEvidence.ablations.find(
      (ablation) => ablation.id === 'no-outer-sparsity'
    );
    const noInnerSparsity = gnosisMoaTransformerEvidence.ablations.find(
      (ablation) => ablation.id === 'no-inner-sparsity'
    );
    const underRouted = gnosisMoaTransformerEvidence.ablations.find(
      (ablation) => ablation.id === 'under-routed'
    );

    expect(compactMoaScale).toBeDefined();
    expect(wideMoaScale).toBeDefined();
    expect(fullMoa).toBeDefined();
    expect(noOuterSparsity).toBeDefined();
    expect(noInnerSparsity).toBeDefined();
    expect(underRouted).toBeDefined();

    const gate1SpeedupRange = `${min(
      gate1.cells.map((cell) => cell.speedupMedian)
    ).toFixed(3)}x-${max(gate1.cells.map((cell) => cell.speedupMedian)).toFixed(
      3
    )}x`;
    const gate1MinSpeedupCiLow = `${min(
      gate1.cells.map((cell) => cell.speedupMedianCi.low)
    ).toFixed(3)}x`;
    const gate1MinImprovementCiLow = `${formatFixedWithCommas(
      min(gate1.cells.map((cell) => cell.improvementMedianMsCi.low)),
      2
    )} ms`;

    mustContain(
      manuscript,
      `${gate1.gate.passedPrimaryCells.length}/${gate1.gate.primaryCells.length}`
    );
    mustContain(manuscript, gate1SpeedupRange);
    mustContain(manuscript, gate1MinSpeedupCiLow);
    mustContain(manuscript, gate1MinImprovementCiLow);

    const gate2PrimaryCells = gate2.cells.filter((cell) =>
      gate2.gate.primaryCells.includes(cell.cellId)
    );
    const gate2MedianFraming = `${gate2PrimaryCells[0].framingMedianGainPct.toFixed(
      3
    )}%`;
    const gate2MinFramingCiLow = `${min(
      gate2PrimaryCells.map((cell) => cell.framingMedianGainPctCi.low)
    ).toFixed(2)}%`;
    const gate2MedianCiLowRange = `${min(
      gate2PrimaryCells.map((cell) => cell.completionMedianGainMsCi.low)
    ).toFixed(2)}-${max(
      gate2PrimaryCells.map((cell) => cell.completionMedianGainMsCi.low)
    ).toFixed(2)} ms`;
    const gate2P95CiLowRange = `${min(
      gate2PrimaryCells.map((cell) => cell.completionP95GainMsCi.low)
    ).toFixed(2)}-${max(
      gate2PrimaryCells.map((cell) => cell.completionP95GainMsCi.low)
    ).toFixed(2)} ms`;

    mustContain(
      manuscript,
      `${formatInteger(gate2.corpus.siteCount)} sites and ${formatInteger(
        gate2.corpus.totalResources
      )} resources`
    );
    mustContain(
      manuscript,
      `${gate2.gate.passedPrimaryCells.length}/${gate2.gate.primaryCells.length}`
    );
    mustContain(manuscript, gate2MedianFraming);
    mustContain(manuscript, gate2MinFramingCiLow);
    mustContain(manuscript, gate2MedianCiLowRange);
    mustContain(manuscript, gate2P95CiLowRange);

    const gate3PrimaryCells = gate3.cells.filter((cell) =>
      gate3.gate.primaryCells.includes(cell.cellId)
    );
    const gate3BestFixedCiLowRange = `${min(
      gate3PrimaryCells.map((cell) => cell.medianGainVsBestFixedPctCi.low)
    ).toFixed(4)}%-${max(
      gate3PrimaryCells.map((cell) => cell.medianGainVsBestFixedPctCi.low)
    ).toFixed(4)}%`;
    const gate3HeuristicMedianRange = `${min(
      gate3PrimaryCells.map((cell) => cell.medianGainVsHeuristicPct)
    ).toFixed(3)}%-${max(
      gate3PrimaryCells.map((cell) => cell.medianGainVsHeuristicPct)
    ).toFixed(3)}%`;
    const gate3HeuristicCiLowRange = `${min(
      gate3PrimaryCells.map((cell) => cell.medianGainVsHeuristicPctCi.low)
    ).toFixed(3)}%-${max(
      gate3PrimaryCells.map((cell) => cell.medianGainVsHeuristicPctCi.low)
    ).toFixed(3)}%`;

    mustContain(
      manuscript,
      `${formatInteger(gate3.corpus.sampleCount)} samples and ${formatInteger(
        gate3.corpus.totalBytes
      )} bytes`
    );
    mustContain(
      manuscript,
      `${gate3.gate.passedPrimaryCells.length}/${gate3.gate.primaryCells.length}`
    );
    mustContain(manuscript, gate3BestFixedCiLowRange);
    mustContain(manuscript, gate3HeuristicMedianRange);
    mustContain(manuscript, gate3HeuristicCiLowRange);

    const criterionMap = new Map(
      gate4.gate.criteria.map((criterion) => [criterion.id, criterion])
    );
    const spearmanCiLow = criterionMap.get('spearman_ci_low')?.ci95?.low;
    const slopeCiLow = criterionMap.get('slope_ci_low')?.ci95?.low;
    const quartileCiLow = criterionMap.get('quartile_delta_ci_low')?.ci95?.low;
    const predictorCiLow = criterionMap.get('predicted_pearson_ci_low')?.ci95
      ?.low;

    expect(spearmanCiLow).toBeDefined();
    expect(slopeCiLow).toBeDefined();
    expect(quartileCiLow).toBeDefined();
    expect(predictorCiLow).toBeDefined();

    mustContain(manuscript, spearmanCiLow!.toFixed(3));
    mustContain(manuscript, slopeCiLow!.toFixed(3));
    mustContain(manuscript, quartileCiLow!.toFixed(3));
    mustContain(manuscript, predictorCiLow!.toFixed(3));
    mustContain(
      manuscript,
      `${gate4.holdout.monotonicViolations} <= ${gate4.config.thresholds.maxDecileMonotonicViolations}`
    );

    mustContain(
      manuscript,
      gate5.aggregate.minPrimaryPairRatioCiLow.toFixed(3)
    );
    mustContain(manuscript, gate5.aggregate.medianPairRatio.toFixed(3));
    mustContain(manuscript, gate5.aggregate.pooledLogRatio.toFixed(3));
    mustContain(
      manuscript,
      `${gate5.aggregate.pooledLogRatioCi95.low.toFixed(
        3
      )}-${gate5.aggregate.pooledLogRatioCi95.high.toFixed(3)}`
    );

    mustContain(
      manuscript,
      quantumAblation.strategies.linear.profile.preservesKernelAgreement
        ? 'preserving kernel agreement, partition additivity, order invariance and cancellation'
        : 'breaking kernel agreement, partition additivity, order invariance and cancellation'
    );
    mustContain(
      manuscript,
      quantumAblation.strategies[
        'winner-take-all'
      ].distances.kernelAgreementDistance.toFixed(3)
    );
    mustContain(
      manuscript,
      quantumAblation.strategies[
        'winner-take-all'
      ].distances.partitionAdditivityDistance.toFixed(3)
    );
    mustContain(
      manuscript,
      quantumAblation.strategies[
        'winner-take-all'
      ].distances.cancellationMagnitude2.toFixed(3)
    );
    mustContain(manuscript, 'winner-take-all and early-stop each show');

    mustContain(
      manuscript,
      toyAttentionAblation.strategies.linear.meanSquaredError.toFixed(3)
    );
    mustContain(
      manuscript,
      toyAttentionAblation.strategies[
        'winner-take-all'
      ].meanSquaredError.toFixed(3)
    );
    mustContain(
      manuscript,
      toyAttentionAblation.strategies[
        'winner-take-all'
      ].meanSquaredErrorCi95.low.toFixed(3)
    );
    mustContain(
      manuscript,
      toyAttentionAblation.strategies[
        'winner-take-all'
      ].meanSquaredErrorCi95.high.toFixed(3)
    );
    mustContain(
      manuscript,
      toyAttentionAblation.strategies['early-stop'].meanSquaredError.toFixed(3)
    );
    mustContain(
      manuscript,
      toyAttentionAblation.strategies[
        'early-stop'
      ].meanSquaredErrorCi95.low.toFixed(3)
    );
    mustContain(
      manuscript,
      toyAttentionAblation.strategies[
        'early-stop'
      ].meanSquaredErrorCi95.high.toFixed(3)
    );
    mustContain(
      manuscript,
      toyAttentionAblation.strategies[
        'winner-take-all'
      ].exactWithinToleranceFraction.toFixed(3)
    );
    mustContain(
      manuscript,
      toyAttentionAblation.strategies[
        'early-stop'
      ].exactWithinToleranceFraction.toFixed(3)
    );
    mustContain(
      manuscript,
      gnosisTrainingBenchmark.strategies.linear.meanEvalMeanSquaredError.toFixed(
        3
      )
    );
    mustContain(
      manuscript,
      gnosisTrainingBenchmark.strategies[
        'winner-take-all'
      ].meanEvalMeanSquaredError.toFixed(3)
    );
    mustContain(
      manuscript,
      gnosisTrainingBenchmark.strategies[
        'winner-take-all'
      ].evalMeanSquaredErrorCi95.low.toFixed(3)
    );
    mustContain(
      manuscript,
      gnosisTrainingBenchmark.strategies[
        'winner-take-all'
      ].evalMeanSquaredErrorCi95.high.toFixed(3)
    );
    mustContain(
      manuscript,
      gnosisTrainingBenchmark.strategies[
        'early-stop'
      ].meanEvalMeanSquaredError.toFixed(3)
    );
    mustContain(
      manuscript,
      gnosisTrainingBenchmark.strategies[
        'early-stop'
      ].evalMeanSquaredErrorCi95.low.toFixed(3)
    );
    mustContain(
      manuscript,
      gnosisTrainingBenchmark.strategies[
        'early-stop'
      ].evalMeanSquaredErrorCi95.high.toFixed(3)
    );
    mustContain(
      manuscript,
      gnosisTrainingBenchmark.strategies[
        'winner-take-all'
      ].meanExactWithinToleranceFraction.toFixed(3)
    );
    mustContain(
      manuscript,
      gnosisTrainingBenchmark.strategies[
        'early-stop'
      ].meanExactWithinToleranceFraction.toFixed(3)
    );
    mustContain(
      manuscript,
      gnosisTrainingBenchmark.strategies[
        'winner-take-all'
      ].meanCancellationLineMeanAbsoluteError.toFixed(3)
    );
    mustContain(
      manuscript,
      gnosisTrainingBenchmark.strategies[
        'early-stop'
      ].meanCancellationLineMeanAbsoluteError.toFixed(3)
    );
    const negativeControlTasks = Object.values(gnosisNegativeControls.tasks);
    mustContain(
      manuscript,
      gnosisNegativeControls.allControlsPass
        ? 'all three fold rules'
        : 'some fold rules'
    );
    mustContain(
      manuscript,
      max(
        negativeControlTasks.map((task) => task.maxEvalMeanSquaredErrorGap)
      ).toFixed(3)
    );
    mustContain(
      manuscript,
      min(
        negativeControlTasks.map((task) => task.minExactWithinToleranceFraction)
      ).toFixed(3)
    );
    mustContain(manuscript, 'affine-left-only');
    mustContain(manuscript, 'positive-x single-expert');
    mustContain(manuscript, 'gnosis-near-control-sweep.{json,md}');
    mustContain(
      manuscript,
      gnosisNearControl.affine.lastParityRegimeValue?.toFixed(3) ?? 'none'
    );
    mustContain(
      manuscript,
      gnosisNearControl.affine.firstSeparatedRegimeValue?.toFixed(3) ?? 'none'
    );
    mustContain(
      manuscript,
      gnosisNearControl.routed.lastParityRegimeValue?.toFixed(3) ?? 'none'
    );
    mustContain(
      manuscript,
      gnosisNearControl.routed.firstSeparatedRegimeValue?.toFixed(3) ?? 'none'
    );
    mustContain(
      manuscript,
      gnosisRegimeSweep.affine.firstSeparatedRegimeValue?.toFixed(3) ?? 'none'
    );
    mustContain(
      manuscript,
      (
        gnosisRegimeSweep.affine.points.at(-1)
          ?.linearAdvantageEvalMeanSquaredError ?? 0
      ).toFixed(3)
    );
    mustContain(
      manuscript,
      gnosisRegimeSweep.routed.firstSeparatedRegimeValue?.toFixed(3) ?? 'none'
    );
    mustContain(
      manuscript,
      (
        gnosisRegimeSweep.routed.points.at(-1)
          ?.linearAdvantageEvalMeanSquaredError ?? 0
      ).toFixed(3)
    );
    const winnerAffine =
      gnosisAdversarialControls.tasks['winner-affine-maxabs'];
    const earlyStopRouted =
      gnosisAdversarialControls.tasks[
        'early-stop-routing-first-expert-short-budget'
      ];
    const earlyStopAffine =
      gnosisAdversarialControls.tasks['early-stop-left-priority-short-budget'];
    expect(winnerAffine).toBeDefined();
    expect(earlyStopRouted).toBeDefined();
    expect(earlyStopAffine).toBeDefined();
    mustContain(
      manuscript,
      winnerAffine!.strategies[
        'winner-take-all'
      ].meanFinalEvalMeanSquaredError.toFixed(3)
    );
    mustContain(
      manuscript,
      winnerAffine!.strategies.linear.meanFinalEvalMeanSquaredError.toFixed(3)
    );
    mustContain(
      manuscript,
      winnerAffine!.strategies[
        'early-stop'
      ].meanFinalEvalMeanSquaredError.toFixed(3)
    );
    mustContain(
      manuscript,
      winnerAffine!.strategies['winner-take-all'].meanLearningCurveArea.toFixed(
        3
      )
    );
    mustContain(
      manuscript,
      winnerAffine!.strategies.linear.meanLearningCurveArea.toFixed(3)
    );
    mustContain(
      manuscript,
      winnerAffine!.strategies['early-stop'].meanLearningCurveArea.toFixed(3)
    );
    mustContain(
      manuscript,
      earlyStopRouted!.strategies['early-stop'].meanLearningCurveArea.toFixed(3)
    );
    mustContain(
      manuscript,
      earlyStopRouted!.strategies.linear.meanLearningCurveArea.toFixed(3)
    );
    mustContain(
      manuscript,
      earlyStopRouted!.strategies[
        'winner-take-all'
      ].meanLearningCurveArea.toFixed(3)
    );
    mustContain(
      manuscript,
      earlyStopAffine!.strategies['early-stop'].meanLearningCurveArea.toFixed(3)
    );
    mustContain(
      manuscript,
      earlyStopAffine!.strategies.linear.meanLearningCurveArea.toFixed(3)
    );
    mustContain(
      manuscript,
      earlyStopAffine!.strategies[
        'winner-take-all'
      ].meanLearningCurveArea.toFixed(3)
    );
    mustContain(
      manuscript,
      gnosisMiniMoeBenchmark.strategies.linear.meanEvalMeanSquaredError.toFixed(
        3
      )
    );
    mustContain(
      manuscript,
      gnosisMiniMoeBenchmark.strategies[
        'winner-take-all'
      ].meanEvalMeanSquaredError.toFixed(3)
    );
    mustContain(
      manuscript,
      gnosisMiniMoeBenchmark.strategies[
        'winner-take-all'
      ].evalMeanSquaredErrorCi95.low.toFixed(3)
    );
    mustContain(
      manuscript,
      gnosisMiniMoeBenchmark.strategies[
        'winner-take-all'
      ].evalMeanSquaredErrorCi95.high.toFixed(3)
    );
    mustContain(
      manuscript,
      gnosisMiniMoeBenchmark.strategies[
        'early-stop'
      ].meanEvalMeanSquaredError.toFixed(3)
    );
    mustContain(
      manuscript,
      gnosisMiniMoeBenchmark.strategies[
        'early-stop'
      ].evalMeanSquaredErrorCi95.low.toFixed(3)
    );
    mustContain(
      manuscript,
      gnosisMiniMoeBenchmark.strategies[
        'early-stop'
      ].evalMeanSquaredErrorCi95.high.toFixed(3)
    );
    mustContain(
      manuscript,
      gnosisMiniMoeBenchmark.strategies[
        'winner-take-all'
      ].meanDualActiveRegionMeanAbsoluteError.toFixed(3)
    );
    mustContain(
      manuscript,
      gnosisMiniMoeBenchmark.strategies[
        'early-stop'
      ].meanDualActiveRegionMeanAbsoluteError.toFixed(3)
    );
    mustContain(
      manuscript,
      'ch17-correspondence-boundary-figure.{json,md,svg}'
    );
    mustContain(manuscript, 'ch17-boundary-expansion-figure.{json,md,svg}');
    mustContain(
      manuscript,
      'gnosis-moa-transformer-evidence-benchmark.{json,md}'
    );
    mustContain(manuscript, 'ch17-moa-transformer-figure.{json,md,svg}');
    mustContain(manuscript, 'near-control zoom');
    mustContain(manuscript, String(formalWitnessCatalog.witnesses.length));
    mustContain(manuscript, 'formal-witness-catalog.{json,md}');
    mustContain(manuscript, 'formal-adaptive-witness-catalog.{json,md}');
    mustContain(
      manuscript,
      `α = (${formalAdaptiveWitnessCatalog.witnesses[0]!.alphaLeft}, ${
        formalAdaptiveWitnessCatalog.witnesses[0]!.alphaRight
      })`
    );
    mustContain(
      manuscript,
      formalAdaptiveWitnessCatalog.witnesses[0]!.driftGap
    );
    mustContain(
      manuscript,
      formalAdaptiveWitnessCatalog.witnesses[0]!.spectralRadius
    );
    mustContain(manuscript, 'ch17-replication-pack.{json,md}');
    mustContain(manuscript, 'bun run test:ch17-external-replication');
    mustContain(
      manuscript,
      `\`${String(replicationPack.entryCount)}\` manifest entries`
    );
    mustContain(
      manuscript,
      `\`${String(replicationPack.artifactCount)}\` generated artifacts`
    );
    mustContain(
      manuscript,
      replicationPack.complete ? 'generated artifacts' : 'missing artifacts'
    );
    mustContain(
      manuscript,
      gnosisMoaTransformerEvidence.topologySurface.moaStructuredPrimitive
    );
    mustContain(
      manuscript,
      compactMoaScale!.moaEvalWallTimeSpeedupVsRegular.toFixed(2)
    );
    mustContain(
      manuscript,
      wideMoaScale!.moaEvalWallTimeSpeedupVsRegular.toFixed(2)
    );
    mustContain(
      manuscript,
      (
        compactMoaScale!.families.moa.meanEvalMeanSquaredError -
        compactMoaScale!.families.regular.meanEvalMeanSquaredError
      ).toFixed(4)
    );
    mustContain(
      manuscript,
      compactMoaScale!.families.moa.meanEvalMeanSquaredError.toFixed(4)
    );
    mustContain(
      manuscript,
      compactMoaScale!.families.regular.meanEvalMeanSquaredError.toFixed(4)
    );
    mustContain(
      manuscript,
      (
        wideMoaScale!.families.moa.meanEvalMeanSquaredError -
        wideMoaScale!.families.regular.meanEvalMeanSquaredError
      ).toFixed(4)
    );
    mustContain(
      manuscript,
      wideMoaScale!.families.moa.meanEvalMeanSquaredError.toFixed(4)
    );
    mustContain(
      manuscript,
      wideMoaScale!.families.regular.meanEvalMeanSquaredError.toFixed(4)
    );
    mustContain(
      manuscript,
      formatInteger(wideMoaScale!.families.moa.meanActiveHeadCount)
    );
    mustContain(
      manuscript,
      formatInteger(wideMoaScale!.families.regular.meanActiveHeadCount)
    );
    mustContain(
      manuscript,
      formatInteger(wideMoaScale!.families.moa.meanFrameCount)
    );
    mustContain(
      manuscript,
      formatInteger(wideMoaScale!.families.regular.meanFrameCount)
    );
    mustContain(
      manuscript,
      fullMoa!.families.moa.computeAdjustedExactFraction.toFixed(4)
    );
    mustContain(
      manuscript,
      noOuterSparsity!.families.moa.computeAdjustedExactFraction.toFixed(4)
    );
    mustContain(
      manuscript,
      noInnerSparsity!.families.moa.computeAdjustedExactFraction.toFixed(4)
    );
    mustContain(
      manuscript,
      underRouted!.families.moa.meanEvalMeanSquaredError.toFixed(4)
    );
    mustContain(
      manuscript,
      underRouted!.families.moa.meanExactWithinToleranceFraction.toFixed(4)
    );

    // Guardrail text for §7 step-count claims: keep A1/A2 assumptions explicit.
    mustContain(
      manuscript,
      'per-chunk stage service times are homogeneous across stages'
    );
    mustContain(
      manuscript,
      'inter-stage communication/synchronization cost is zero'
    );
    mustContain(manuscript, 'uniform stage service time');
    mustContain(manuscript, 'zero inter-node communication cost');
  });
});
