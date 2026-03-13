import {
  runAdaptiveSupremumWitness,
  type TwoNodeAdaptiveWitnessParameters,
} from './adaptive-supremum-witness';

export interface AdaptiveSupremumFamilySweepCase {
  readonly id: string;
  readonly description: string;
  readonly parameters: TwoNodeAdaptiveWitnessParameters;
}

export interface AdaptiveSupremumFamilySweepCaseReport {
  readonly id: string;
  readonly description: string;
  readonly parameters: TwoNodeAdaptiveWitnessParameters;
  readonly rawAssumptionsSatisfied: boolean;
  readonly allChecksPass: boolean;
  readonly candidateLeft: number;
  readonly candidateRight: number;
  readonly driftGap: number;
  readonly leftSlack: number;
  readonly rightSlack: number;
  readonly leftRowSum: number;
  readonly rightRowSum: number;
  readonly spectralRadius: number;
  readonly stateCount: number;
  readonly smallSetCount: number;
  readonly schedulesRecovered: boolean;
}

export interface AdaptiveSupremumFamilySweepReport {
  readonly label: 'adaptive-supremum-family-sweep-v1';
  readonly cases: readonly AdaptiveSupremumFamilySweepCaseReport[];
  readonly summary: {
    readonly caseCount: number;
    readonly familyClosureRecovered: boolean;
    readonly allRawAssumptionsSatisfied: boolean;
    readonly schedulesRecoveredInEveryCase: boolean;
    readonly allSpectralRadiusZero: boolean;
    readonly minDriftGap: number;
    readonly minLeftSlack: number;
    readonly minRightSlack: number;
    readonly maxLeftRowSum: number;
    readonly maxStateCount: number;
    readonly worstCaseId: string;
  };
}

const SWEEP_CASES = [
  {
    id: 'base-2x2',
    description:
      'The manuscript witness point: moderate reroute probability with comfortable slack on both nodes.',
    parameters: {
      maxLeftQueue: 2,
      maxRightQueue: 2,
      arrivalLeft: 0.25,
      arrivalRight: 0.15,
      rerouteProbability: 0.5,
      serviceLeft: 0.5,
      serviceRight: 0.4,
    },
  },
  {
    id: 'low-reroute-2x2',
    description:
      'Lower reroute mass shows the same closure when the ceiling stays sparse.',
    parameters: {
      maxLeftQueue: 2,
      maxRightQueue: 2,
      arrivalLeft: 0.2,
      arrivalRight: 0.1,
      rerouteProbability: 0.25,
      serviceLeft: 0.45,
      serviceRight: 0.32,
    },
  },
  {
    id: 'high-reroute-2x2',
    description:
      'Higher reroute mass remains stable as long as the right-node service ceiling stays above the closed-form candidate.',
    parameters: {
      maxLeftQueue: 2,
      maxRightQueue: 2,
      arrivalLeft: 0.2,
      arrivalRight: 0.05,
      rerouteProbability: 0.75,
      serviceLeft: 0.5,
      serviceRight: 0.45,
    },
  },
  {
    id: 'tight-right-slack-2x2',
    description:
      'A near-boundary case where the right-node service slack is intentionally small but still positive.',
    parameters: {
      maxLeftQueue: 2,
      maxRightQueue: 2,
      arrivalLeft: 0.24,
      arrivalRight: 0.09,
      rerouteProbability: 0.6,
      serviceLeft: 0.38,
      serviceRight: 0.26,
    },
  },
  {
    id: 'wide-slack-3x1',
    description:
      'A larger left queue bound with a narrow right queue bound keeps the same family-level ceiling geometry.',
    parameters: {
      maxLeftQueue: 3,
      maxRightQueue: 1,
      arrivalLeft: 0.15,
      arrivalRight: 0.05,
      rerouteProbability: 0.5,
      serviceLeft: 0.5,
      serviceRight: 0.35,
    },
  },
  {
    id: 'wide-right-1x3',
    description:
      'Swapping the bounded cube shape does not change the candidate or drift formulas, only the enumerated state count.',
    parameters: {
      maxLeftQueue: 1,
      maxRightQueue: 3,
      arrivalLeft: 0.18,
      arrivalRight: 0.08,
      rerouteProbability: 0.5,
      serviceLeft: 0.45,
      serviceRight: 0.32,
    },
  },
  {
    id: 'small-cube-1x1',
    description:
      'The smallest nontrivial bounded cube still recovers the full adaptive ceiling story.',
    parameters: {
      maxLeftQueue: 1,
      maxRightQueue: 1,
      arrivalLeft: 0.1,
      arrivalRight: 0.05,
      rerouteProbability: 0.5,
      serviceLeft: 0.3,
      serviceRight: 0.21,
    },
  },
  {
    id: 'large-cube-3x3',
    description:
      'A larger bounded cube confirms that the finite-state enumeration scales without changing the nilpotent ceiling argument.',
    parameters: {
      maxLeftQueue: 3,
      maxRightQueue: 3,
      arrivalLeft: 0.22,
      arrivalRight: 0.11,
      rerouteProbability: 0.4,
      serviceLeft: 0.5,
      serviceRight: 0.33,
    },
  },
  {
    id: 'balanced-mid-2x3',
    description:
      'A balanced mid-slack case verifies the family story away from both the default point and the near-boundary point.',
    parameters: {
      maxLeftQueue: 2,
      maxRightQueue: 3,
      arrivalLeft: 0.16,
      arrivalRight: 0.09,
      rerouteProbability: 0.5,
      serviceLeft: 0.36,
      serviceRight: 0.25,
    },
  },
] as const satisfies readonly AdaptiveSupremumFamilySweepCase[];

function buildCandidateRight(parameters: TwoNodeAdaptiveWitnessParameters): number {
  return parameters.arrivalRight + parameters.arrivalLeft * parameters.rerouteProbability;
}

function rawAssumptionsSatisfied(parameters: TwoNodeAdaptiveWitnessParameters): boolean {
  const candidateRight = buildCandidateRight(parameters);

  return (
    parameters.arrivalLeft >= 0 &&
    parameters.arrivalRight >= 0 &&
    parameters.rerouteProbability >= 0 &&
    parameters.rerouteProbability < 1 &&
    parameters.arrivalLeft < parameters.serviceLeft &&
    candidateRight < parameters.serviceRight
  );
}

export function runAdaptiveSupremumFamilySweep(): AdaptiveSupremumFamilySweepReport {
  const cases = SWEEP_CASES.map((entry) => {
    const report = runAdaptiveSupremumWitness(entry.parameters);

    return {
      id: entry.id,
      description: entry.description,
      parameters: entry.parameters,
      rawAssumptionsSatisfied: rawAssumptionsSatisfied(entry.parameters),
      allChecksPass: report.allChecksPass,
      candidateLeft: report.candidate.left,
      candidateRight: report.candidate.right,
      driftGap: report.drift.gap,
      leftSlack: report.candidate.serviceSlackLeft,
      rightSlack: report.candidate.serviceSlackRight,
      leftRowSum: report.ceiling.rowSums.left,
      rightRowSum: report.ceiling.rowSums.right,
      spectralRadius: report.ceiling.spectralRadius,
      stateCount: report.drift.stateCount,
      smallSetCount: report.drift.smallSetCount,
      schedulesRecovered: report.schedules.every(
        (schedule) =>
          schedule.allApproximantsBoundedByCandidate && schedule.recoveredExpectedSupremum,
      ),
    } satisfies AdaptiveSupremumFamilySweepCaseReport;
  });

  const worstCase = cases.reduce((currentWorst, entry) =>
    entry.driftGap < currentWorst.driftGap ? entry : currentWorst,
  );

  return {
    label: 'adaptive-supremum-family-sweep-v1',
    cases,
    summary: {
      caseCount: cases.length,
      familyClosureRecovered: cases.every(
        (entry) => entry.rawAssumptionsSatisfied && entry.allChecksPass,
      ),
      allRawAssumptionsSatisfied: cases.every(
        (entry) => entry.rawAssumptionsSatisfied,
      ),
      schedulesRecoveredInEveryCase: cases.every(
        (entry) => entry.schedulesRecovered,
      ),
      allSpectralRadiusZero: cases.every((entry) => entry.spectralRadius === 0),
      minDriftGap: Math.min(...cases.map((entry) => entry.driftGap)),
      minLeftSlack: Math.min(...cases.map((entry) => entry.leftSlack)),
      minRightSlack: Math.min(...cases.map((entry) => entry.rightSlack)),
      maxLeftRowSum: Math.max(...cases.map((entry) => entry.leftRowSum)),
      maxStateCount: Math.max(...cases.map((entry) => entry.stateCount)),
      worstCaseId: worstCase.id,
    },
  };
}

export function renderAdaptiveSupremumFamilySweepMarkdown(
  report: AdaptiveSupremumFamilySweepReport,
): string {
  const caseLines = report.cases
    .map(
      (entry) =>
        `| ${entry.id} | ${entry.parameters.maxLeftQueue}x${entry.parameters.maxRightQueue} | ${entry.candidateLeft.toFixed(3)} | ${entry.candidateRight.toFixed(3)} | ${entry.driftGap.toFixed(3)} | ${entry.rightSlack.toFixed(3)} | ${entry.stateCount} | ${entry.allChecksPass ? 'yes' : 'no'} |`,
    )
    .join('\n');

  return [
    '# Adaptive Supremum Family Sweep',
    '',
    'This artifact lifts the concrete adaptive-supremum witness from one tuple to a curated raw-parameter family of bounded two-node rerouting cases.',
    '',
    '## Summary',
    '',
    `- Cases: ${report.summary.caseCount}`,
    `- Family closure recovered: ${report.summary.familyClosureRecovered ? 'yes' : 'no'}`,
    `- Raw assumptions satisfied in every case: ${report.summary.allRawAssumptionsSatisfied ? 'yes' : 'no'}`,
    `- Schedules recovered in every case: ${report.summary.schedulesRecoveredInEveryCase ? 'yes' : 'no'}`,
    `- All spectral radii are zero: ${report.summary.allSpectralRadiusZero ? 'yes' : 'no'}`,
    `- Minimum drift gap: ${report.summary.minDriftGap.toFixed(3)}`,
    `- Minimum left-node service slack: ${report.summary.minLeftSlack.toFixed(3)}`,
    `- Minimum right-node service slack: ${report.summary.minRightSlack.toFixed(3)}`,
    `- Maximum left-row sum: ${report.summary.maxLeftRowSum.toFixed(3)}`,
    `- Maximum bounded state count: ${report.summary.maxStateCount}`,
    `- Tightest case: ${report.summary.worstCaseId}`,
    '',
    '## Cases',
    '',
    '| Case | Cube | Alpha left | Alpha right | Drift gap | Right slack | States | Checks pass |',
    '| --- | --- | ---: | ---: | ---: | ---: | ---: | --- |',
    caseLines,
    '',
  ].join('\n');
}
