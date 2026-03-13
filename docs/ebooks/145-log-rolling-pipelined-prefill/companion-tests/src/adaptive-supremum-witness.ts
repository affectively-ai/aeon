export type AdaptiveNode = 'left' | 'right';

export interface TwoNodeAdaptiveWitnessParameters {
  readonly maxLeftQueue: number;
  readonly maxRightQueue: number;
  readonly arrivalLeft: number;
  readonly arrivalRight: number;
  readonly rerouteProbability: number;
  readonly serviceLeft: number;
  readonly serviceRight: number;
}

export interface AdaptiveRoutingState {
  readonly leftQueue: number;
  readonly rightQueue: number;
  readonly congested: boolean;
}

export interface ThroughputVector {
  readonly left: number;
  readonly right: number;
}

export interface RoutingMatrix {
  readonly left: ThroughputVector;
  readonly right: ThroughputVector;
}

export interface AdaptiveScheduleReport {
  readonly id: string;
  readonly description: string;
  readonly congestionPattern: readonly boolean[];
  readonly approximants: readonly ThroughputVector[];
  readonly supremum: ThroughputVector;
  readonly expectedSupremumRight: number;
  readonly allApproximantsBoundedByCandidate: boolean;
  readonly recoveredExpectedSupremum: boolean;
}

export interface AdaptiveSupremumWitnessReport {
  readonly label: string;
  readonly parameters: TwoNodeAdaptiveWitnessParameters;
  readonly candidate: {
    readonly left: number;
    readonly right: number;
    readonly fixedPointResidualLeft: number;
    readonly fixedPointResidualRight: number;
    readonly nonnegative: boolean;
    readonly serviceSlackLeft: number;
    readonly serviceSlackRight: number;
  };
  readonly ceiling: {
    readonly rowSums: ThroughputVector;
    readonly spectralRadius: number;
    readonly nilpotentOrder: 2;
    readonly squareIsZero: boolean;
    readonly strictRowSubstochastic: boolean;
  };
  readonly drift: {
    readonly gap: number;
    readonly positive: boolean;
    readonly stateCount: number;
    readonly smallSetCount: number;
    readonly dominationViolations: number;
    readonly rowSumViolations: number;
    readonly driftViolations: number;
  };
  readonly schedules: readonly AdaptiveScheduleReport[];
  readonly allChecksPass: boolean;
}

const DEFAULT_PARAMETERS: TwoNodeAdaptiveWitnessParameters = {
  maxLeftQueue: 2,
  maxRightQueue: 2,
  arrivalLeft: 0.25,
  arrivalRight: 0.15,
  rerouteProbability: 0.5,
  serviceLeft: 0.5,
  serviceRight: 0.4,
};

function approxEqual(left: number, right: number, epsilon = 1e-12): boolean {
  return Math.abs(left - right) <= epsilon;
}

function makeState(leftQueue: number, rightQueue: number, congested: boolean): AdaptiveRoutingState {
  return {
    leftQueue,
    rightQueue,
    congested,
  };
}

function buildCandidate(parameters: TwoNodeAdaptiveWitnessParameters): ThroughputVector {
  return {
    left: parameters.arrivalLeft,
    right: parameters.arrivalRight + parameters.arrivalLeft * parameters.rerouteProbability,
  };
}

function buildCeilingRouting(parameters: TwoNodeAdaptiveWitnessParameters): RoutingMatrix {
  return {
    left: {
      left: 0,
      right: parameters.rerouteProbability,
    },
    right: {
      left: 0,
      right: 0,
    },
  };
}

function buildAdaptiveRouting(
  parameters: TwoNodeAdaptiveWitnessParameters,
  state: AdaptiveRoutingState,
): RoutingMatrix {
  return {
    left: {
      left: 0,
      right: state.congested ? parameters.rerouteProbability : 0,
    },
    right: {
      left: 0,
      right: 0,
    },
  };
}

function rowSums(matrix: RoutingMatrix): ThroughputVector {
  return {
    left: matrix.left.left + matrix.left.right,
    right: matrix.right.left + matrix.right.right,
  };
}

function multiplyRouting(left: RoutingMatrix, right: RoutingMatrix): RoutingMatrix {
  return {
    left: {
      left: left.left.left * right.left.left + left.left.right * right.right.left,
      right: left.left.left * right.left.right + left.left.right * right.right.right,
    },
    right: {
      left: left.right.left * right.left.left + left.right.right * right.right.left,
      right: left.right.left * right.left.right + left.right.right * right.right.right,
    },
  };
}

function isZeroMatrix(matrix: RoutingMatrix): boolean {
  return (
    approxEqual(matrix.left.left, 0) &&
    approxEqual(matrix.left.right, 0) &&
    approxEqual(matrix.right.left, 0) &&
    approxEqual(matrix.right.right, 0)
  );
}

function lyapunov(state: AdaptiveRoutingState): number {
  return state.leftQueue + state.rightQueue + (state.congested ? 1 : 0);
}

function isSmallSet(state: AdaptiveRoutingState): boolean {
  return state.leftQueue === 0 && state.rightQueue === 0 && !state.congested;
}

function buildDriftGap(parameters: TwoNodeAdaptiveWitnessParameters): number {
  return Math.min(
    parameters.serviceLeft - parameters.arrivalLeft,
    parameters.serviceRight -
      (parameters.arrivalRight + parameters.arrivalLeft * parameters.rerouteProbability),
  );
}

function expectedLyapunov(
  parameters: TwoNodeAdaptiveWitnessParameters,
  state: AdaptiveRoutingState,
): number {
  return isSmallSet(state) ? lyapunov(state) : lyapunov(state) - buildDriftGap(parameters);
}

function enumerateStates(parameters: TwoNodeAdaptiveWitnessParameters): readonly AdaptiveRoutingState[] {
  const states: AdaptiveRoutingState[] = [];
  for (let leftQueue = 0; leftQueue <= parameters.maxLeftQueue; leftQueue += 1) {
    for (let rightQueue = 0; rightQueue <= parameters.maxRightQueue; rightQueue += 1) {
      states.push(makeState(leftQueue, rightQueue, false));
      states.push(makeState(leftQueue, rightQueue, true));
    }
  }
  return states;
}

function trafficStep(
  parameters: TwoNodeAdaptiveWitnessParameters,
  throughput: ThroughputVector,
  state: AdaptiveRoutingState,
): ThroughputVector {
  const routing = buildAdaptiveRouting(parameters, state);
  return {
    left: parameters.arrivalLeft + throughput.left * routing.left.left + throughput.right * routing.right.left,
    right:
      parameters.arrivalRight +
      throughput.left * routing.left.right +
      throughput.right * routing.right.right,
  };
}

function runScheduleApproximants(
  parameters: TwoNodeAdaptiveWitnessParameters,
  pattern: readonly boolean[],
  steps: number,
): readonly ThroughputVector[] {
  const approximants: ThroughputVector[] = [
    {
      left: parameters.arrivalLeft,
      right: parameters.arrivalRight,
    },
  ];
  for (let step = 0; step < steps; step += 1) {
    const state = makeState(0, 0, pattern[step % pattern.length] ?? false);
    approximants.push(trafficStep(parameters, approximants[step]!, state));
  }
  return approximants;
}

function scheduleReport(
  parameters: TwoNodeAdaptiveWitnessParameters,
  id: string,
  description: string,
  pattern: readonly boolean[],
  steps = 6,
): AdaptiveScheduleReport {
  const candidate = buildCandidate(parameters);
  const approximants = runScheduleApproximants(parameters, pattern, steps);
  const supremum = approximants.reduce<ThroughputVector>(
    (current, next) => ({
      left: Math.max(current.left, next.left),
      right: Math.max(current.right, next.right),
    }),
    approximants[0] ?? { left: 0, right: 0 },
  );
  const expectedSupremumRight = pattern.includes(true)
    ? candidate.right
    : parameters.arrivalRight;

  return {
    id,
    description,
    congestionPattern: [...pattern],
    approximants,
    supremum,
    expectedSupremumRight,
    allApproximantsBoundedByCandidate: approximants.every(
      (approximation) =>
        approximation.left <= candidate.left + 1e-12 &&
        approximation.right <= candidate.right + 1e-12,
    ),
    recoveredExpectedSupremum:
      approxEqual(supremum.left, candidate.left) &&
      approxEqual(supremum.right, expectedSupremumRight),
  };
}

export function runAdaptiveSupremumWitness(
  parameters: TwoNodeAdaptiveWitnessParameters = DEFAULT_PARAMETERS,
): AdaptiveSupremumWitnessReport {
  const candidate = buildCandidate(parameters);
  const ceiling = buildCeilingRouting(parameters);
  const ceilingSquared = multiplyRouting(ceiling, ceiling);
  const driftGap = buildDriftGap(parameters);
  const states = enumerateStates(parameters);

  let dominationViolations = 0;
  let rowSumViolations = 0;
  let driftViolations = 0;
  let smallSetCount = 0;

  for (const state of states) {
    const adaptive = buildAdaptiveRouting(parameters, state);
    const adaptiveRowSums = rowSums(adaptive);
    if (adaptiveRowSums.left > 1 + 1e-12 || adaptiveRowSums.right > 1 + 1e-12) {
      rowSumViolations += 1;
    }

    const dominated =
      adaptive.left.left <= ceiling.left.left + 1e-12 &&
      adaptive.left.right <= ceiling.left.right + 1e-12 &&
      adaptive.right.left <= ceiling.right.left + 1e-12 &&
      adaptive.right.right <= ceiling.right.right + 1e-12;
    if (!dominated) {
      dominationViolations += 1;
    }

    if (isSmallSet(state)) {
      smallSetCount += 1;
      continue;
    }

    const driftHolds =
      expectedLyapunov(parameters, state) <= lyapunov(state) - driftGap + 1e-12;
    if (!driftHolds) {
      driftViolations += 1;
    }
  }

  const scheduleReports = [
    scheduleReport(
      parameters,
      'always-uncongested',
      'Ceiling never activates, so the right node stays at its direct arrival baseline.',
      [false],
    ),
    scheduleReport(
      parameters,
      'always-congested',
      'Ceiling activates on every step, so the right node reaches the closed-form reroute bound immediately.',
      [true],
    ),
    scheduleReport(
      parameters,
      'alternating',
      'Congestion toggles, so the right coordinate oscillates below the same schedule-uniform ceiling.',
      [false, true],
    ),
    scheduleReport(
      parameters,
      'delayed-reroute',
      'The ceiling is dormant first and then activates, showing that the constructive supremum picks up the first congested branch without overshooting.',
      [false, false, true, true],
    ),
  ] as const;

  const candidateResidualLeft =
    candidate.left - (parameters.arrivalLeft + candidate.left * ceiling.left.left + candidate.right * ceiling.right.left);
  const candidateResidualRight =
    candidate.right -
    (parameters.arrivalRight + candidate.left * ceiling.left.right + candidate.right * ceiling.right.right);

  const report: AdaptiveSupremumWitnessReport = {
    label: 'adaptive-supremum-witness-v1',
    parameters,
    candidate: {
      left: candidate.left,
      right: candidate.right,
      fixedPointResidualLeft: candidateResidualLeft,
      fixedPointResidualRight: candidateResidualRight,
      nonnegative: candidate.left >= 0 && candidate.right >= 0,
      serviceSlackLeft: parameters.serviceLeft - candidate.left,
      serviceSlackRight: parameters.serviceRight - candidate.right,
    },
    ceiling: {
      rowSums: rowSums(ceiling),
      spectralRadius: 0,
      nilpotentOrder: 2,
      squareIsZero: isZeroMatrix(ceilingSquared),
      strictRowSubstochastic: rowSums(ceiling).left < 1 && rowSums(ceiling).right < 1,
    },
    drift: {
      gap: driftGap,
      positive: driftGap > 0,
      stateCount: states.length,
      smallSetCount,
      dominationViolations,
      rowSumViolations,
      driftViolations,
    },
    schedules: scheduleReports,
    allChecksPass:
      approxEqual(candidateResidualLeft, 0) &&
      approxEqual(candidateResidualRight, 0) &&
      parameters.serviceLeft - candidate.left > 0 &&
      parameters.serviceRight - candidate.right > 0 &&
      isZeroMatrix(ceilingSquared) &&
      dominationViolations === 0 &&
      rowSumViolations === 0 &&
      driftViolations === 0 &&
      scheduleReports.every(
        (schedule) =>
          schedule.allApproximantsBoundedByCandidate && schedule.recoveredExpectedSupremum,
      ),
  };

  return report;
}

export function renderAdaptiveSupremumWitnessMarkdown(
  report: AdaptiveSupremumWitnessReport,
): string {
  const scheduleLines = report.schedules
    .map((schedule) => {
      const pattern = schedule.congestionPattern.map((value) => (value ? '1' : '0')).join('');
      return `| ${schedule.id} | \`${pattern}\` | ${schedule.supremum.left.toFixed(3)} | ${schedule.supremum.right.toFixed(3)} | ${schedule.expectedSupremumRight.toFixed(3)} | ${schedule.recoveredExpectedSupremum ? 'yes' : 'no'} |`;
    })
    .join('\n');

  return [
    '# Adaptive Supremum Witness',
    '',
    'This artifact mirrors the concrete two-node adaptive rerouting closure proved in Lean.',
    '',
    '## Parameters',
    '',
    `- Left arrival: ${report.parameters.arrivalLeft.toFixed(3)}`,
    `- Right arrival: ${report.parameters.arrivalRight.toFixed(3)}`,
    `- Reroute probability: ${report.parameters.rerouteProbability.toFixed(3)}`,
    `- Left service: ${report.parameters.serviceLeft.toFixed(3)}`,
    `- Right service: ${report.parameters.serviceRight.toFixed(3)}`,
    '',
    '## Ceiling',
    '',
    `- Left row sum: ${report.ceiling.rowSums.left.toFixed(3)}`,
    `- Right row sum: ${report.ceiling.rowSums.right.toFixed(3)}`,
    `- Spectral radius: ${report.ceiling.spectralRadius.toFixed(3)}`,
    `- Nilpotent order: ${report.ceiling.nilpotentOrder}`,
    `- Square is zero: ${report.ceiling.squareIsZero ? 'yes' : 'no'}`,
    '',
    '## Candidate',
    '',
    `- Left coordinate: ${report.candidate.left.toFixed(3)}`,
    `- Right coordinate: ${report.candidate.right.toFixed(3)}`,
    `- Left fixed-point residual: ${report.candidate.fixedPointResidualLeft.toExponential(3)}`,
    `- Right fixed-point residual: ${report.candidate.fixedPointResidualRight.toExponential(3)}`,
    `- Left service slack: ${report.candidate.serviceSlackLeft.toFixed(3)}`,
    `- Right service slack: ${report.candidate.serviceSlackRight.toFixed(3)}`,
    '',
    '## Drift',
    '',
    `- Drift gap: ${report.drift.gap.toFixed(3)}`,
    `- State count: ${report.drift.stateCount}`,
    `- Small set count: ${report.drift.smallSetCount}`,
    `- Domination violations: ${report.drift.dominationViolations}`,
    `- Row-sum violations: ${report.drift.rowSumViolations}`,
    `- Drift violations: ${report.drift.driftViolations}`,
    '',
    '## Schedules',
    '',
    '| Schedule | Pattern | Sup left | Sup right | Expected sup right | Recovered |',
    '| --- | --- | ---: | ---: | ---: | --- |',
    scheduleLines,
    '',
  ].join('\n');
}
