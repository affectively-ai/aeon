export interface ConfidenceInterval {
  readonly low: number;
  readonly high: number;
}

interface BootstrapOptions {
  readonly confidenceLevel?: number;
  readonly resampleCount?: number;
  readonly seed?: number;
}

export function mean(values: readonly number[]): number {
  if (values.length === 0) {
    return 0;
  }

  return values.reduce((sum, value) => sum + value, 0) / values.length;
}

function createDeterministicRandom(seed: number): () => number {
  let state = seed >>> 0;
  if (state === 0) {
    state = 0x6d2b79f5;
  }

  return () => {
    state = (1664525 * state + 1013904223) >>> 0;
    return state / 0x100000000;
  };
}

function percentile(sortedValues: readonly number[], fraction: number): number {
  if (sortedValues.length === 0) {
    return 0;
  }

  if (sortedValues.length === 1) {
    return sortedValues[0] ?? 0;
  }

  const clampedFraction = Math.min(1, Math.max(0, fraction));
  const scaledIndex = clampedFraction * (sortedValues.length - 1);
  const lowerIndex = Math.floor(scaledIndex);
  const upperIndex = Math.ceil(scaledIndex);
  const lowerValue = sortedValues[lowerIndex] ?? sortedValues[0] ?? 0;
  const upperValue = sortedValues[upperIndex] ?? sortedValues[sortedValues.length - 1] ?? 0;

  if (lowerIndex === upperIndex) {
    return lowerValue;
  }

  const weight = scaledIndex - lowerIndex;
  return lowerValue * (1 - weight) + upperValue * weight;
}

export function bootstrapMeanConfidenceInterval(
  values: readonly number[],
  options: BootstrapOptions = {},
): ConfidenceInterval {
  if (values.length === 0) {
    return { low: 0, high: 0 };
  }

  if (values.length === 1) {
    const onlyValue = values[0] ?? 0;
    return { low: onlyValue, high: onlyValue };
  }

  const confidenceLevel = options.confidenceLevel ?? 0.95;
  const resampleCount = options.resampleCount ?? 4096;
  const random = createDeterministicRandom(options.seed ?? 0x1234abcd);
  const sampleMeans = Array.from({ length: resampleCount }, () => {
    const resample = Array.from({ length: values.length }, () => {
      const index = Math.floor(random() * values.length);
      return values[index] ?? 0;
    });
    return mean(resample);
  }).sort((left, right) => left - right);

  const tailMass = (1 - confidenceLevel) / 2;
  return {
    low: percentile(sampleMeans, tailMass),
    high: percentile(sampleMeans, 1 - tailMass),
  };
}
