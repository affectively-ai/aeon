import { once } from 'node:events';
import { createServer, type IncomingMessage, type ServerResponse } from 'node:http';
import { performance } from 'node:perf_hooks';
import { createHash } from 'node:crypto';

export interface Gate1CpuTask {
  readonly kind: 'md5-grind' | 'semiprime-factor';
  readonly unitsPerToken: number;
}

export interface Gate1Workload {
  readonly name: string;
  readonly tokens: number;
  readonly nodes: number;
  readonly chunkSize: number;
  readonly serviceMsPerToken: number;
  readonly payloadBytesPerToken: number;
  readonly cpuTask?: Gate1CpuTask;
}

export interface Gate1NetworkCondition {
  readonly name: string;
  readonly rttMs: number;
  readonly jitterMs: number;
  readonly lossRate: number;
  readonly primary: boolean;
}

export interface Gate1Config {
  readonly trialsPerCell: number;
  readonly maxAttemptsPerRequest: number;
  readonly requestTimeoutMs: number;
  readonly bootstrapResamples: number;
  readonly seed: number;
  readonly workloads: readonly Gate1Workload[];
  readonly networkConditions: readonly Gate1NetworkCondition[];
}

export interface Gate1ExecutionOptions {
  readonly label?: string;
  readonly listenHost?: string;
  readonly advertiseHost?: string;
  readonly endpointPool?: readonly string[];
}

export interface BootstrapInterval {
  readonly low: number;
  readonly high: number;
}

export interface DistributionSummary {
  readonly p50Ms: number;
  readonly p95Ms: number;
  readonly p50Ci: BootstrapInterval;
  readonly p95Ci: BootstrapInterval;
}

export interface CellResult {
  readonly cellId: string;
  readonly workload: Gate1Workload;
  readonly network: Gate1NetworkCondition;
  readonly pairedTrials: number;
  readonly failedTrials: number;
  readonly sequential: DistributionSummary;
  readonly chunked: DistributionSummary;
  readonly speedupMedian: number;
  readonly speedupMedianCi: BootstrapInterval;
  readonly improvementMedianMs: number;
  readonly improvementMedianMsCi: BootstrapInterval;
  readonly sequentialAvgRetriesPerTrial: number;
  readonly chunkedAvgRetriesPerTrial: number;
  readonly passed: boolean;
}

export interface Gate1Report {
  readonly config: Gate1Config;
  readonly execution: {
    readonly label: string;
    readonly mode: 'embedded-stage-servers' | 'external-endpoints';
    readonly listenHost: string;
    readonly advertiseHost: string;
    readonly endpointPoolSize: number;
    readonly endpointHosts: readonly string[];
    readonly distinctEndpointHostCount: number;
  };
  readonly cells: readonly CellResult[];
  readonly gate: {
    readonly primaryCells: readonly string[];
    readonly passedPrimaryCells: readonly string[];
    readonly failedPrimaryCells: readonly string[];
    readonly pass: boolean;
  };
}

function extractEndpointHosts(endpointPool: readonly string[] | undefined): readonly string[] {
  if (!endpointPool) {
    return [];
  }
  return endpointPool.map((endpoint) => {
    try {
      return new URL(endpoint).host;
    } catch {
      return endpoint;
    }
  });
}

interface StageRequest {
  readonly chunkId: number;
  readonly tokenCount: number;
  readonly payload: string;
  readonly cpuTask?: Gate1CpuTask;
}

interface StageResponse {
  readonly chunkId: number;
  readonly stage: number;
  readonly tokenCount: number;
  readonly checksum: number;
}

interface TrialResult {
  readonly elapsedMs: number;
  readonly attempts: number;
  readonly retries: number;
}

interface StageServer {
  readonly stageIndex: number;
  readonly endpoint: string;
  readonly close: () => Promise<void>;
}

interface InFlightResult {
  readonly stageIndex: number;
  readonly chunkId: number;
  readonly attempts: number;
  readonly response: StageResponse;
}

class Lcg {
  private state: number;

  constructor(seed: number) {
    this.state = seed >>> 0;
  }

  next(): number {
    this.state = (Math.imul(this.state, 1664525) + 1013904223) >>> 0;
    return this.state / 0x100000000;
  }
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, Math.max(0, ms)));
}

function mixSeed(...parts: number[]): number {
  let hash = 0x811c9dc5;
  for (const part of parts) {
    hash ^= part >>> 0;
    hash = Math.imul(hash, 0x01000193) >>> 0;
  }
  return hash >>> 0;
}

function asSorted(values: readonly number[]): number[] {
  const sorted = [...values];
  sorted.sort((a, b) => a - b);
  return sorted;
}

export function quantile(values: readonly number[], q: number): number {
  if (values.length === 0) {
    throw new Error('quantile requires non-empty values');
  }
  if (q < 0 || q > 1) {
    throw new Error(`quantile q must be in [0,1], received ${q}`);
  }

  const sorted = asSorted(values);
  const pos = (sorted.length - 1) * q;
  const lower = Math.floor(pos);
  const upper = Math.ceil(pos);
  if (lower === upper) {
    return sorted[lower];
  }
  const weight = pos - lower;
  return sorted[lower] * (1 - weight) + sorted[upper] * weight;
}

export function bootstrapCi(
  values: readonly number[],
  statistic: (sample: readonly number[]) => number,
  rngSeed: number,
  resamples: number,
): BootstrapInterval {
  if (values.length === 0) {
    return { low: Number.NaN, high: Number.NaN };
  }

  const rng = new Lcg(rngSeed);
  const stats: number[] = [];
  const sampled = new Array<number>(values.length);

  for (let i = 0; i < resamples; i++) {
    for (let j = 0; j < values.length; j++) {
      sampled[j] = values[Math.floor(rng.next() * values.length)];
    }
    stats.push(statistic(sampled));
  }

  return {
    low: quantile(stats, 0.025),
    high: quantile(stats, 0.975),
  };
}

function summarizeDistribution(
  values: readonly number[],
  seed: number,
  resamples: number,
): DistributionSummary {
  const p50 = quantile(values, 0.5);
  const p95 = quantile(values, 0.95);
  const p50Ci = bootstrapCi(values, (sample) => quantile(sample, 0.5), mixSeed(seed, 11), resamples);
  const p95Ci = bootstrapCi(values, (sample) => quantile(sample, 0.95), mixSeed(seed, 13), resamples);

  return {
    p50Ms: p50,
    p95Ms: p95,
    p50Ci,
    p95Ci,
  };
}

async function readBody(request: IncomingMessage): Promise<string> {
  const chunks: Uint8Array[] = [];
  for await (const chunk of request) {
    if (typeof chunk === 'string') {
      chunks.push(Buffer.from(chunk));
    } else {
      chunks.push(chunk);
    }
  }
  return Buffer.concat(chunks).toString('utf8');
}

function sendJson(response: ServerResponse, statusCode: number, body: unknown): void {
  response.statusCode = statusCode;
  response.setHeader('access-control-allow-origin', '*');
  response.setHeader('access-control-allow-methods', 'POST, OPTIONS');
  response.setHeader('access-control-allow-headers', 'content-type');
  response.setHeader('content-type', 'application/json');
  response.end(JSON.stringify(body));
}

const FACTOR_SEMIPRIMES: readonly number[] = [
  1000003 * 1000033,
  1000037 * 1000039,
  1000081 * 1000099,
];

function smallestFactor(n: number): number {
  if ((n & 1) === 0) {
    return 2;
  }
  const limit = Math.floor(Math.sqrt(n));
  for (let divisor = 3; divisor <= limit; divisor += 2) {
    if (n % divisor === 0) {
      return divisor;
    }
  }
  return n;
}

function runCpuTask(
  cpuTask: Gate1CpuTask,
  chunkId: number,
  tokenCount: number,
  payload: string,
  stageIndex: number,
): number {
  const units = Math.max(0, Math.floor(cpuTask.unitsPerToken * tokenCount));
  if (units === 0) {
    return 0;
  }

  if (cpuTask.kind === 'md5-grind') {
    let seed = `${chunkId}:${stageIndex}:${payload.length}:${tokenCount}`;
    let checksum = 0;
    for (let unit = 0; unit < units; unit++) {
      const digest = createHash('md5').update(seed).digest('hex');
      checksum ^= Number.parseInt(digest.slice(0, 8), 16);
      seed = digest;
    }
    return checksum >>> 0;
  }

  let checksum = 2166136261 >>> 0;
  for (let unit = 0; unit < units; unit++) {
    const semiprime = FACTOR_SEMIPRIMES[(chunkId + stageIndex + unit) % FACTOR_SEMIPRIMES.length];
    const factor = smallestFactor(semiprime);
    checksum = Math.imul(checksum ^ factor, 16777619) >>> 0;
  }
  return checksum;
}

async function startStageServers(
  nodeCount: number,
  serviceMsPerToken: number,
  listenHost: string,
  advertiseHost: string,
): Promise<readonly StageServer[]> {
  const servers: StageServer[] = [];

  for (let stageIndex = 0; stageIndex < nodeCount; stageIndex++) {
    const handler = async (request: IncomingMessage, response: ServerResponse): Promise<void> => {
      if (request.method === 'OPTIONS' && request.url === '/stage') {
        response.statusCode = 204;
        response.setHeader('access-control-allow-origin', '*');
        response.setHeader('access-control-allow-methods', 'POST, OPTIONS');
        response.setHeader('access-control-allow-headers', 'content-type');
        response.end();
        return;
      }

      if (request.method !== 'POST' || request.url !== '/stage') {
        sendJson(response, 404, { error: 'not-found' });
        return;
      }

      let parsed: StageRequest;
      try {
        parsed = JSON.parse(await readBody(request)) as StageRequest;
      } catch {
        sendJson(response, 400, { error: 'invalid-json' });
        return;
      }

      const computeDelayMs = parsed.tokenCount * serviceMsPerToken;
      if (computeDelayMs > 0) {
        await sleep(computeDelayMs);
      }

      let checksum = 2166136261 >>> 0;
      checksum = Math.imul(checksum ^ parsed.chunkId, 16777619) >>> 0;
      checksum = Math.imul(checksum ^ parsed.tokenCount, 16777619) >>> 0;
      checksum = Math.imul(checksum ^ parsed.payload.length, 16777619) >>> 0;
      checksum = Math.imul(checksum ^ stageIndex, 16777619) >>> 0;
      if (parsed.cpuTask) {
        checksum = Math.imul(
          checksum ^ runCpuTask(parsed.cpuTask, parsed.chunkId, parsed.tokenCount, parsed.payload, stageIndex),
          16777619,
        ) >>> 0;
      }

      const result: StageResponse = {
        chunkId: parsed.chunkId,
        stage: stageIndex,
        tokenCount: parsed.tokenCount,
        checksum,
      };

      sendJson(response, 200, result);
    };

    const server = createServer((request, response) => {
      void handler(request, response);
    });

    server.listen(0, listenHost);
    await once(server, 'listening');
    const address = server.address();

    if (!address || typeof address === 'string') {
      throw new Error(`Unable to resolve listen address for stage ${stageIndex}`);
    }

    servers.push({
      stageIndex,
      endpoint: `http://${advertiseHost}:${address.port}/stage`,
      close: async (): Promise<void> => {
        await new Promise<void>((resolve, reject) => {
          server.close((error) => {
            if (error) {
              reject(error);
            } else {
              resolve();
            }
          });
        });
      },
    });
  }

  return servers;
}

function buildExternalStageServers(
  nodeCount: number,
  endpointPool: readonly string[],
): readonly StageServer[] {
  if (endpointPool.length < nodeCount) {
    throw new Error(
      `External endpoint pool has ${endpointPool.length} endpoints, but workload requires ${nodeCount}`,
    );
  }

  return Array.from({ length: nodeCount }, (_, stageIndex) => ({
    stageIndex,
    endpoint: endpointPool[stageIndex],
    close: async (): Promise<void> => {
      // External workers are managed out-of-process by the caller.
    },
  }));
}

function oneWayDelayMs(network: Gate1NetworkCondition, rng: Lcg): number {
  const jitter = (rng.next() * 2 - 1) * network.jitterMs;
  return Math.max(0, network.rttMs / 2 + jitter);
}

async function sendWithImpairment(
  endpoint: string,
  payload: StageRequest,
  network: Gate1NetworkCondition,
  rng: Lcg,
  maxAttempts: number,
  requestTimeoutMs: number,
): Promise<{ response: StageResponse; attempts: number }> {
  const encoded = JSON.stringify(payload);

  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    await sleep(oneWayDelayMs(network, rng));

    if (rng.next() < network.lossRate) {
      await sleep(network.rttMs);
      continue;
    }

    let response: Response;
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), requestTimeoutMs);
    try {
      response = await fetch(endpoint, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: encoded,
        signal: controller.signal,
      });
    } catch {
      await sleep(network.rttMs);
      continue;
    } finally {
      clearTimeout(timeoutId);
    }

    await sleep(oneWayDelayMs(network, rng));

    if (!response.ok) {
      await sleep(network.rttMs);
      continue;
    }

    const parsed = (await response.json()) as StageResponse;
    return { response: parsed, attempts: attempt };
  }

  throw new Error(`Request failed after ${maxAttempts} attempts`);
}

function buildChunks(tokens: number, chunkSize: number): number[] {
  const chunkTokenCounts: number[] = [];
  let remaining = tokens;

  while (remaining > 0) {
    const take = Math.min(chunkSize, remaining);
    chunkTokenCounts.push(take);
    remaining -= take;
  }

  return chunkTokenCounts;
}

async function runSequentialTrial(
  workload: Gate1Workload,
  network: Gate1NetworkCondition,
  servers: readonly StageServer[],
  seed: number,
  maxAttempts: number,
  requestTimeoutMs: number,
): Promise<TrialResult> {
  const rng = new Lcg(seed);
  const payloadUnit = 'x'.repeat(workload.payloadBytesPerToken);
  let attempts = 0;
  const started = performance.now();

  for (let token = 0; token < workload.tokens; token++) {
    const payload = payloadUnit;

    for (let stageIndex = 0; stageIndex < servers.length; stageIndex++) {
      const { response, attempts: requestAttempts } = await sendWithImpairment(
        servers[stageIndex].endpoint,
        {
          chunkId: token,
          tokenCount: 1,
          payload,
          cpuTask: workload.cpuTask,
        },
        network,
        rng,
        maxAttempts,
        requestTimeoutMs,
      );

      attempts += requestAttempts;

      if (
        response.stage !== stageIndex ||
        response.chunkId !== token ||
        response.tokenCount !== 1
      ) {
        throw new Error(`Sequential response mismatch at token=${token}, stage=${stageIndex}`);
      }
    }
  }

  const elapsedMs = performance.now() - started;
  return {
    elapsedMs,
    attempts,
    retries: attempts - workload.tokens * workload.nodes,
  };
}

async function runChunkedTrial(
  workload: Gate1Workload,
  network: Gate1NetworkCondition,
  servers: readonly StageServer[],
  seed: number,
  maxAttempts: number,
  requestTimeoutMs: number,
): Promise<TrialResult> {
  const rng = new Lcg(seed);
  const chunkTokenCounts = buildChunks(workload.tokens, workload.chunkSize);
  const stageCount = workload.nodes;
  const stageQueues: number[][] = Array.from({ length: stageCount }, () => []);
  const inFlight: Array<Promise<InFlightResult> | null> = new Array(stageCount).fill(null);
  const completed = new Set<number>();
  const payloadUnit = 'x'.repeat(workload.payloadBytesPerToken);
  let attempts = 0;

  for (let i = 0; i < chunkTokenCounts.length; i++) {
    stageQueues[0].push(i);
  }

  const dispatch = (stageIndex: number): void => {
    if (inFlight[stageIndex] !== null) {
      return;
    }

    const chunkId = stageQueues[stageIndex].shift();
    if (chunkId === undefined) {
      return;
    }

    const tokenCount = chunkTokenCounts[chunkId];
    const payload = payloadUnit.repeat(tokenCount);

    inFlight[stageIndex] = sendWithImpairment(
      servers[stageIndex].endpoint,
      {
        chunkId,
        tokenCount,
        payload,
        cpuTask: workload.cpuTask,
      },
      network,
      rng,
      maxAttempts,
      requestTimeoutMs,
    ).then(({ response, attempts: requestAttempts }) => ({
      stageIndex,
      chunkId,
      attempts: requestAttempts,
      response,
    }));
  };

  const started = performance.now();

  for (let stageIndex = 0; stageIndex < stageCount; stageIndex++) {
    dispatch(stageIndex);
  }

  while (completed.size < chunkTokenCounts.length) {
    const active = inFlight.filter((entry): entry is Promise<InFlightResult> => entry !== null);
    if (active.length === 0) {
      throw new Error('Chunked pipeline deadlock: no in-flight work and incomplete chunks');
    }

    const done = await Promise.race(active);
    inFlight[done.stageIndex] = null;
    attempts += done.attempts;

    if (
      done.response.stage !== done.stageIndex ||
      done.response.chunkId !== done.chunkId ||
      done.response.tokenCount !== chunkTokenCounts[done.chunkId]
    ) {
      throw new Error(
        `Chunked response mismatch at chunk=${done.chunkId}, stage=${done.stageIndex}`,
      );
    }

    if (done.stageIndex === stageCount - 1) {
      completed.add(done.chunkId);
    } else {
      stageQueues[done.stageIndex + 1].push(done.chunkId);
    }

    for (let stageIndex = 0; stageIndex < stageCount; stageIndex++) {
      dispatch(stageIndex);
    }
  }

  const elapsedMs = performance.now() - started;
  const baselineRequests = chunkTokenCounts.length * workload.nodes;
  return {
    elapsedMs,
    attempts,
    retries: attempts - baselineRequests,
  };
}

async function closeStageServers(servers: readonly StageServer[]): Promise<void> {
  await Promise.all(servers.map((server) => server.close()));
}

function average(values: readonly number[]): number {
  if (values.length === 0) {
    return Number.NaN;
  }
  return values.reduce((sum, value) => sum + value, 0) / values.length;
}

function buildCellId(workload: Gate1Workload, network: Gate1NetworkCondition): string {
  return `${workload.name}__${network.name}`;
}

function assessCellPass(
  pairedTrials: number,
  failedTrials: number,
  speedupMedianCi: BootstrapInterval,
  improvementMedianMsCi: BootstrapInterval,
): boolean {
  if (pairedTrials === 0 || failedTrials > 0) {
    return false;
  }
  return speedupMedianCi.low > 1 && improvementMedianMsCi.low > 0;
}

async function runCell(
  workload: Gate1Workload,
  network: Gate1NetworkCondition,
  config: Gate1Config,
  cellSeed: number,
  execution: Required<Omit<Gate1ExecutionOptions, 'endpointPool'>> & {
    readonly endpointPool?: readonly string[];
  },
): Promise<CellResult> {
  const servers = execution.endpointPool
    ? buildExternalStageServers(workload.nodes, execution.endpointPool)
    : await startStageServers(
        workload.nodes,
        workload.serviceMsPerToken,
        execution.listenHost,
        execution.advertiseHost,
      );
  const sequentialTimes: number[] = [];
  const chunkedTimes: number[] = [];
  const speedups: number[] = [];
  const improvements: number[] = [];
  const sequentialRetries: number[] = [];
  const chunkedRetries: number[] = [];
  let failedTrials = 0;

  try {
    await runSequentialTrial(
      workload,
      network,
      servers,
      mixSeed(cellSeed, 0xAAAA),
      config.maxAttemptsPerRequest,
      config.requestTimeoutMs,
    );
    await runChunkedTrial(
      workload,
      network,
      servers,
      mixSeed(cellSeed, 0xBBBB),
      config.maxAttemptsPerRequest,
      config.requestTimeoutMs,
    );

    for (let trial = 0; trial < config.trialsPerCell; trial++) {
      const sequentialSeed = mixSeed(cellSeed, trial, 0x101);
      const chunkedSeed = mixSeed(cellSeed, trial, 0x202);
      const runChunkedFirst = (mixSeed(cellSeed, trial, 0x303) & 1) === 1;

      try {
        let sequential: TrialResult;
        let chunked: TrialResult;

        if (runChunkedFirst) {
          chunked = await runChunkedTrial(
            workload,
            network,
            servers,
            chunkedSeed,
            config.maxAttemptsPerRequest,
            config.requestTimeoutMs,
          );
          sequential = await runSequentialTrial(
            workload,
            network,
            servers,
            sequentialSeed,
            config.maxAttemptsPerRequest,
            config.requestTimeoutMs,
          );
        } else {
          sequential = await runSequentialTrial(
            workload,
            network,
            servers,
            sequentialSeed,
            config.maxAttemptsPerRequest,
            config.requestTimeoutMs,
          );
          chunked = await runChunkedTrial(
            workload,
            network,
            servers,
            chunkedSeed,
            config.maxAttemptsPerRequest,
            config.requestTimeoutMs,
          );
        }

        sequentialTimes.push(sequential.elapsedMs);
        chunkedTimes.push(chunked.elapsedMs);
        speedups.push(sequential.elapsedMs / chunked.elapsedMs);
        improvements.push(sequential.elapsedMs - chunked.elapsedMs);
        sequentialRetries.push(sequential.retries);
        chunkedRetries.push(chunked.retries);
      } catch {
        failedTrials++;
      }
    }
  } finally {
    await closeStageServers(servers);
  }

  if (sequentialTimes.length === 0 || chunkedTimes.length === 0) {
    const nanInterval: BootstrapInterval = { low: Number.NaN, high: Number.NaN };
    return {
      cellId: buildCellId(workload, network),
      workload,
      network,
      pairedTrials: 0,
      failedTrials: config.trialsPerCell,
      sequential: {
        p50Ms: Number.NaN,
        p95Ms: Number.NaN,
        p50Ci: nanInterval,
        p95Ci: nanInterval,
      },
      chunked: {
        p50Ms: Number.NaN,
        p95Ms: Number.NaN,
        p50Ci: nanInterval,
        p95Ci: nanInterval,
      },
      speedupMedian: Number.NaN,
      speedupMedianCi: nanInterval,
      improvementMedianMs: Number.NaN,
      improvementMedianMsCi: nanInterval,
      sequentialAvgRetriesPerTrial: Number.NaN,
      chunkedAvgRetriesPerTrial: Number.NaN,
      passed: false,
    };
  }

  const sequentialSummary = summarizeDistribution(
    sequentialTimes,
    mixSeed(cellSeed, 0x401),
    config.bootstrapResamples,
  );
  const chunkedSummary = summarizeDistribution(
    chunkedTimes,
    mixSeed(cellSeed, 0x402),
    config.bootstrapResamples,
  );

  const speedupMedian = quantile(speedups, 0.5);
  const speedupMedianCi = bootstrapCi(
    speedups,
    (sample) => quantile(sample, 0.5),
    mixSeed(cellSeed, 0x501),
    config.bootstrapResamples,
  );

  const improvementMedianMs = quantile(improvements, 0.5);
  const improvementMedianMsCi = bootstrapCi(
    improvements,
    (sample) => quantile(sample, 0.5),
    mixSeed(cellSeed, 0x502),
    config.bootstrapResamples,
  );

  const pairedTrials = sequentialTimes.length;
  const passed = assessCellPass(pairedTrials, failedTrials, speedupMedianCi, improvementMedianMsCi);

  return {
    cellId: buildCellId(workload, network),
    workload,
    network,
    pairedTrials,
    failedTrials,
    sequential: sequentialSummary,
    chunked: chunkedSummary,
    speedupMedian,
    speedupMedianCi,
    improvementMedianMs,
    improvementMedianMsCi,
    sequentialAvgRetriesPerTrial: average(sequentialRetries),
    chunkedAvgRetriesPerTrial: average(chunkedRetries),
    passed,
  };
}

export function makeDefaultGate1Config(): Gate1Config {
  return {
    trialsPerCell: 8,
    maxAttemptsPerRequest: 5,
    requestTimeoutMs: 10_000,
    bootstrapResamples: 2000,
    seed: 0xC0FFEE,
    workloads: [
      {
        name: 'prompt24-n4-b6',
        tokens: 24,
        nodes: 4,
        chunkSize: 6,
        serviceMsPerToken: 0.15,
        payloadBytesPerToken: 96,
      },
      {
        name: 'prompt36-n6-b9',
        tokens: 36,
        nodes: 6,
        chunkSize: 9,
        serviceMsPerToken: 0.15,
        payloadBytesPerToken: 96,
      },
    ],
    networkConditions: [
      {
        name: 'rtt1-loss0',
        rttMs: 1,
        jitterMs: 0.2,
        lossRate: 0,
        primary: false,
      },
      {
        name: 'rtt3-loss0',
        rttMs: 3,
        jitterMs: 0.3,
        lossRate: 0,
        primary: true,
      },
      {
        name: 'rtt3-loss2pct',
        rttMs: 3,
        jitterMs: 0.3,
        lossRate: 0.02,
        primary: true,
      },
      {
        name: 'rtt7-loss0',
        rttMs: 7,
        jitterMs: 0.6,
        lossRate: 0,
        primary: true,
      },
      {
        name: 'rtt7-loss2pct',
        rttMs: 7,
        jitterMs: 0.6,
        lossRate: 0.02,
        primary: true,
      },
    ],
  };
}

export function makeHardSearchGate1Config(): Gate1Config {
  return {
    trialsPerCell: 4,
    maxAttemptsPerRequest: 4,
    requestTimeoutMs: 20_000,
    bootstrapResamples: 1200,
    seed: 0x5EA7C001,
    workloads: [
      {
        name: 'md5-grind-n4-b8',
        tokens: 32,
        nodes: 4,
        chunkSize: 8,
        serviceMsPerToken: 0,
        payloadBytesPerToken: 64,
        cpuTask: {
          kind: 'md5-grind',
          unitsPerToken: 180,
        },
      },
      {
        name: 'factor-semiprime-n4-b6',
        tokens: 24,
        nodes: 4,
        chunkSize: 6,
        serviceMsPerToken: 0,
        payloadBytesPerToken: 64,
        cpuTask: {
          kind: 'semiprime-factor',
          unitsPerToken: 1,
        },
      },
    ],
    networkConditions: [
      {
        name: 'rtt3-loss0',
        rttMs: 3,
        jitterMs: 0.3,
        lossRate: 0,
        primary: true,
      },
      {
        name: 'rtt7-loss0',
        rttMs: 7,
        jitterMs: 0.6,
        lossRate: 0,
        primary: true,
      },
    ],
  };
}

export function makeSemiprimeFactorGate1Config(): Gate1Config {
  return {
    trialsPerCell: 4,
    maxAttemptsPerRequest: 4,
    requestTimeoutMs: 20_000,
    bootstrapResamples: 1200,
    seed: 0x5EA7C001,
    workloads: [
      {
        name: 'factor-semiprime-n4-b6',
        tokens: 24,
        nodes: 4,
        chunkSize: 6,
        serviceMsPerToken: 0,
        payloadBytesPerToken: 64,
        cpuTask: {
          kind: 'semiprime-factor',
          unitsPerToken: 1,
        },
      },
    ],
    networkConditions: [
      {
        name: 'rtt3-loss0',
        rttMs: 3,
        jitterMs: 0.3,
        lossRate: 0,
        primary: true,
      },
      {
        name: 'rtt7-loss0',
        rttMs: 7,
        jitterMs: 0.6,
        lossRate: 0,
        primary: true,
      },
    ],
  };
}

export function makeMd5GrindGate1Config(): Gate1Config {
  return {
    trialsPerCell: 4,
    maxAttemptsPerRequest: 4,
    requestTimeoutMs: 20_000,
    bootstrapResamples: 1200,
    seed: 0x5EA7C001,
    workloads: [
      {
        name: 'md5-grind-n4-b8',
        tokens: 32,
        nodes: 4,
        chunkSize: 8,
        serviceMsPerToken: 0,
        payloadBytesPerToken: 64,
        cpuTask: {
          kind: 'md5-grind',
          unitsPerToken: 180,
        },
      },
    ],
    networkConditions: [
      {
        name: 'rtt3-loss0',
        rttMs: 3,
        jitterMs: 0.3,
        lossRate: 0,
        primary: true,
      },
      {
        name: 'rtt7-loss0',
        rttMs: 7,
        jitterMs: 0.6,
        lossRate: 0,
        primary: true,
      },
    ],
  };
}

export async function runGate1Matrix(
  config: Gate1Config,
  executionOptions: Gate1ExecutionOptions = {},
): Promise<Gate1Report> {
  const execution: Required<Omit<Gate1ExecutionOptions, 'endpointPool'>> & {
    readonly endpointPool?: readonly string[];
  } = {
    label: executionOptions.label ?? 'loopback-default',
    listenHost: executionOptions.listenHost ?? '127.0.0.1',
    advertiseHost: executionOptions.advertiseHost ?? executionOptions.listenHost ?? '127.0.0.1',
    endpointPool: executionOptions.endpointPool,
  };

  const cells: CellResult[] = [];
  let cellIndex = 0;

  for (const workload of config.workloads) {
    for (const network of config.networkConditions) {
      const cellSeed = mixSeed(config.seed, cellIndex, workload.tokens, workload.nodes, network.rttMs);
      const result = await runCell(workload, network, config, cellSeed, execution);
      cells.push(result);
      cellIndex++;
    }
  }

  const primaryCells = cells.filter((cell) => cell.network.primary).map((cell) => cell.cellId);
  const passedPrimaryCells = cells
    .filter((cell) => cell.network.primary && cell.passed)
    .map((cell) => cell.cellId);
  const failedPrimaryCells = primaryCells.filter((cellId) => !passedPrimaryCells.includes(cellId));
  const endpointHosts = extractEndpointHosts(execution.endpointPool);
  const distinctEndpointHostCount = new Set(endpointHosts).size;

  return {
    config,
    execution: {
      label: execution.label,
      mode: execution.endpointPool ? 'external-endpoints' : 'embedded-stage-servers',
      listenHost: execution.listenHost,
      advertiseHost: execution.advertiseHost,
      endpointPoolSize: execution.endpointPool?.length ?? 0,
      endpointHosts,
      distinctEndpointHostCount,
    },
    cells,
    gate: {
      primaryCells,
      passedPrimaryCells,
      failedPrimaryCells,
      pass: failedPrimaryCells.length === 0,
    },
  };
}

function fmtMs(value: number): string {
  return Number.isFinite(value) ? value.toFixed(2) : 'NaN';
}

function fmtRatio(value: number): string {
  return Number.isFinite(value) ? value.toFixed(3) : 'NaN';
}

export function renderGate1Markdown(report: Gate1Report): string {
  const lines: string[] = [];
  lines.push('# Gate 1 Wall-Clock Matrix');
  lines.push('');
  lines.push('Distributed benchmark with live HTTP stage servers and impairment injection (RTT/jitter/loss).');
  lines.push('');
  lines.push('## Execution');
  lines.push('');
  lines.push(`- Label: ${report.execution.label}`);
  lines.push(`- Mode: ${report.execution.mode}`);
  lines.push(`- Listen host: ${report.execution.listenHost}`);
  lines.push(`- Advertise host: ${report.execution.advertiseHost}`);
  if (report.execution.mode === 'external-endpoints') {
    lines.push(`- External endpoints provided: ${report.execution.endpointPoolSize}`);
    lines.push(`- Distinct endpoint hosts: ${report.execution.distinctEndpointHostCount}`);
    if (report.execution.endpointHosts.length > 0) {
      lines.push(`- Endpoint hosts: ${report.execution.endpointHosts.join(', ')}`);
    }
  }
  lines.push('');
  lines.push('## Verdict');
  lines.push('');
  lines.push(`- Overall Gate 1: **${report.gate.pass ? 'PASS' : 'DENY'}**`);
  lines.push(`- Primary cells passed: ${report.gate.passedPrimaryCells.length}/${report.gate.primaryCells.length}`);
  if (report.gate.failedPrimaryCells.length > 0) {
    lines.push(`- Failed primary cells: ${report.gate.failedPrimaryCells.join(', ')}`);
  }
  lines.push('');
  lines.push('## Matrix Results');
  lines.push('');
  lines.push(
    '| Cell | Primary | Trials | Seq p50 / p95 (ms) | Chunked p50 / p95 (ms) | Median Speedup (95% CI) | Median Improvement (95% CI, ms) | Pass |',
  );
  lines.push(
    '|---|---|---:|---:|---:|---:|---:|---|',
  );

  for (const cell of report.cells) {
    lines.push(
      `| ${cell.cellId} | ${cell.network.primary ? 'yes' : 'no'} | ${cell.pairedTrials}/${cell.pairedTrials + cell.failedTrials} | ${fmtMs(cell.sequential.p50Ms)} / ${fmtMs(cell.sequential.p95Ms)} | ${fmtMs(cell.chunked.p50Ms)} / ${fmtMs(cell.chunked.p95Ms)} | ${fmtRatio(cell.speedupMedian)} (${fmtRatio(cell.speedupMedianCi.low)} to ${fmtRatio(cell.speedupMedianCi.high)}) | ${fmtMs(cell.improvementMedianMs)} (${fmtMs(cell.improvementMedianMsCi.low)} to ${fmtMs(cell.improvementMedianMsCi.high)}) | ${cell.passed ? 'yes' : 'no'} |`,
    );
  }

  lines.push('');
  lines.push('## Gate Rule');
  lines.push('');
  lines.push('- Cell pass requires zero failed trials plus 95% bootstrap CI lower bounds above no-improvement for both paired median speedup (>1.0) and paired median latency improvement (>0 ms).');
  lines.push('- Gate 1 pass requires all primary cells to pass.');

  return `${lines.join('\n')}\n`;
}
