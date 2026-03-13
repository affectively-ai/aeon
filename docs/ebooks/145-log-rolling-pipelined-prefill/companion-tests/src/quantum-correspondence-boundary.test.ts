import { describe, expect, it } from 'vitest';

import { loadCheckedInFormalWitnessCatalog } from './formal-witness-catalog';

interface Complex {
  readonly re: number;
  readonly im: number;
}

function cAdd(a: Complex, b: Complex): Complex {
  return { re: a.re + b.re, im: a.im + b.im };
}

function cMul(a: Complex, b: Complex): Complex {
  return {
    re: a.re * b.re - a.im * b.im,
    im: a.re * b.im + a.im * b.re,
  };
}

function cMag2(value: Complex): number {
  return value.re * value.re + value.im * value.im;
}

function cApproxEqual(actual: Complex, expected: Complex, tolerance = 1e-10): void {
  expect(actual.re).toBeCloseTo(expected.re, Math.floor(-Math.log10(tolerance)));
  expect(actual.im).toBeCloseTo(expected.im, Math.floor(-Math.log10(tolerance)));
}

type Kernel2 = readonly [readonly [Complex, Complex], readonly [Complex, Complex]];

function kernelStep(kernel: Kernel2, state: readonly [Complex, Complex]): [Complex, Complex] {
  const next0 = cAdd(cMul(kernel[0][0], state[0]), cMul(kernel[0][1], state[1]));
  const next1 = cAdd(cMul(kernel[1][0], state[0]), cMul(kernel[1][1], state[1]));
  return [next0, next1];
}

function kernelPowerApply(
  kernel: Kernel2,
  startState: readonly [Complex, Complex],
  steps: number,
): [Complex, Complex] {
  let state: [Complex, Complex] = [startState[0], startState[1]];
  for (let i = 0; i < steps; i++) {
    state = kernelStep(kernel, state);
  }
  return state;
}

function enumeratePathSum(
  kernel: Kernel2,
  startNode: 0 | 1,
  endNode: 0 | 1,
  steps: number,
): Complex {
  const startAmplitude: Complex = { re: 1, im: 0 };

  function recurse(currentNode: 0 | 1, remaining: number, amplitude: Complex): Complex {
    if (remaining === 0) {
      return currentNode === endNode ? amplitude : { re: 0, im: 0 };
    }

    const through0 = recurse(
      0,
      remaining - 1,
      cMul(kernel[0][currentNode], amplitude),
    );
    const through1 = recurse(
      1,
      remaining - 1,
      cMul(kernel[1][currentNode], amplitude),
    );
    return cAdd(through0, through1);
  }

  return recurse(startNode, steps, startAmplitude);
}

function linearFold(amplitudes: readonly Complex[]): Complex {
  return amplitudes.reduce<Complex>((acc, next) => cAdd(acc, next), { re: 0, im: 0 });
}

function winnerTakeAllFold(amplitudes: readonly Complex[]): Complex {
  if (amplitudes.length === 0) {
    throw new Error('winnerTakeAllFold requires at least one amplitude');
  }

  let best = amplitudes[0];
  let bestMag2 = cMag2(best);

  for (let i = 1; i < amplitudes.length; i++) {
    const candidate = amplitudes[i];
    const candidateMag2 = cMag2(candidate);
    if (candidateMag2 > bestMag2) {
      best = candidate;
      bestMag2 = candidateMag2;
    }
  }

  return best;
}

function witnessInputs(id: string): readonly number[] {
  const report = loadCheckedInFormalWitnessCatalog();
  const witness = report.witnesses.find((entry) => entry.id === id);
  if (!witness) {
    throw new Error(`Missing formal witness ${id}`);
  }
  return witness.inputs;
}

function witnessObserved(id: string): number {
  const report = loadCheckedInFormalWitnessCatalog();
  const witness = report.witnesses.find((entry) => entry.id === id);
  if (!witness) {
    throw new Error(`Missing formal witness ${id}`);
  }
  return witness.observed;
}

function witnessAlternate(id: string): number {
  const report = loadCheckedInFormalWitnessCatalog();
  const witness = report.witnesses.find((entry) => entry.id === id);
  if (!witness || witness.alternate === null) {
    throw new Error(`Missing alternate witness value for ${id}`);
  }
  return witness.alternate;
}

describe('Quantum correspondence boundary (§6.12)', () => {
  it('discrete path sums are exactly recovered by linear fold in the finite kernel model', () => {
    const invSqrt2 = 1 / Math.sqrt(2);
    const kernel: Kernel2 = [
      [{ re: invSqrt2, im: 0 }, { re: invSqrt2, im: 0 }],
      [{ re: invSqrt2, im: 0 }, { re: -invSqrt2, im: 0 }],
    ];

    const startState: [Complex, Complex] = [{ re: 1, im: 0 }, { re: 0, im: 0 }];
    const steps = 3;
    const byKernel = kernelPowerApply(kernel, startState, steps);

    const byPathTo0 = enumeratePathSum(kernel, 0, 0, steps);
    const byPathTo1 = enumeratePathSum(kernel, 0, 1, steps);

    cApproxEqual(byKernel[0], byPathTo0);
    cApproxEqual(byKernel[1], byPathTo1);
  });

  it('linear fold is additive across path partitions; winner-take-all fold is not', () => {
    const partitionA: readonly Complex[] = [{ re: 1, im: 0 }, { re: -1, im: 0 }];
    const partitionB: readonly Complex[] = [{ re: 0, im: 1 }];
    const all = [...partitionA, ...partitionB];

    const linearAll = linearFold(all);
    const linearPartitioned = cAdd(linearFold(partitionA), linearFold(partitionB));
    cApproxEqual(linearAll, linearPartitioned);

    const nonlinearAll = winnerTakeAllFold(all);
    const nonlinearPartitioned = cAdd(
      winnerTakeAllFold(partitionA),
      winnerTakeAllFold(partitionB),
    );

    const nonlinearDistance = Math.hypot(
      nonlinearAll.re - nonlinearPartitioned.re,
      nonlinearAll.im - nonlinearPartitioned.im,
    );
    expect(nonlinearDistance).toBeGreaterThan(0.5);
  });

  it('cancellation requires full aggregation; early-stop race returns a different result', () => {
    const [firstInput, secondInput] = witnessInputs('linear-cancellation');
    const amplitudes: readonly Complex[] = [
      { re: firstInput ?? 0, im: 0 },
      { re: secondInput ?? 0, im: 0 },
    ];

    const quantumLikeFullFold = linearFold(amplitudes);
    expect(cMag2(quantumLikeFullFold)).toBeCloseTo(0, 12);

    const [earlyStopRaceResult] = amplitudes;
    expect(earlyStopRaceResult.re).toBe(witnessObserved('early-stop-cancellation-counterexample'));
    expect(cMag2(earlyStopRaceResult)).toBeCloseTo(1, 12);
    expect(cMag2(earlyStopRaceResult)).toBeGreaterThan(cMag2(quantumLikeFullFold));
  });

  it('linear fold is permutation invariant on the cancellation witness; early-stop race is not', () => {
    const [firstInput, secondInput] = witnessInputs('early-stop-order-counterexample');
    const forward: readonly Complex[] = [
      { re: firstInput ?? 0, im: 0 },
      { re: secondInput ?? 0, im: 0 },
    ];
    const reversed: readonly Complex[] = [
      { re: secondInput ?? 0, im: 0 },
      { re: firstInput ?? 0, im: 0 },
    ];

    const linearForward = linearFold(forward);
    const linearReversed = linearFold(reversed);

    cApproxEqual(linearForward, linearReversed);
    expect(cMag2(linearForward)).toBeCloseTo(0, 12);

    const [forwardEarlyStop] = forward;
    const [reversedEarlyStop] = reversed;

    expect(forwardEarlyStop.re).toBe(witnessObserved('early-stop-order-counterexample'));
    expect(reversedEarlyStop.re).toBe(witnessAlternate('early-stop-order-counterexample'));
    expect(forwardEarlyStop).not.toEqual(reversedEarlyStop);
  });

  it('formal witness export supplies the integer partition and order counterexamples used by runtime checks', () => {
    const winnerPartitionInputs = witnessInputs('winner-partition-counterexample');
    const earlyPartitionInputs = witnessInputs('early-stop-partition-counterexample');

    expect(winnerPartitionInputs).toEqual([2, 1, -2]);
    expect(witnessObserved('winner-partition-counterexample')).toBe(2);
    expect(witnessAlternate('winner-partition-counterexample')).toBe(0);

    expect(earlyPartitionInputs).toEqual([1, 0, -1]);
    expect(witnessObserved('early-stop-partition-counterexample')).toBe(1);
    expect(witnessAlternate('early-stop-partition-counterexample')).toBe(0);
  });
});
