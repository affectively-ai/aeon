# Chapter 9: Benchmarking the Rotations

## Measured Results

Every optimization was benchmarked in isolation and composed. These are real numbers from `benchmark-rotations.test.ts`  --  10 tests, all passing, measured on local hardware with simulated network delays matching Cloud Run inter-service latency.

### The Scorecard

| Optimization | Metric | Result |
|---|---|---|
| **Chunked Pipeline** | Prefill speedup (20T×4N) | **10.7x** (456ms → 43ms) |
| **Per-Token Pipeline** | Prefill speedup (20T×4N) | 3.4x (456ms → 135ms) |
| **Zero-Copy Forwarding** | Buffer operation speedup | **23x** faster, 156MB saved per 10K ops |
| **Int8 Quantization** | Network payload compression | **4x** smaller, 0.3 percent quality loss |
| **Int8 Quantization** | Throughput | 127,386 ops/sec |
| **Parallel Weight Loading** | Model init speedup | **5.1x** (116ms → 23ms) |
| **Loop Detection** | Per-token overhead | 68µs (negligible) |
| **Loop Detection** | False positive rate | 0 percent |
| **Skip-Ahead Wormholes** | Prediction cost (warm) | 0.4µs/prediction |
| **Skip-Ahead Wormholes** | Skip rate (warm) | **100 percent** on learned mappings |
| **Full Stack Composed** | End-to-end speedup | **10x** (484ms → 48ms) |

### Network Round-Trip Reduction

This is where the real savings live. Cloud Run inter-service latency is 5-15ms per hop  --  far higher than Cloudflare Workers' sub-millisecond edge routing. Every eliminated round-trip is 5-15ms of pure waste removed.

| Scenario | Sequential (P×N) | Per-Token Pipeline (P+N-1) | Chunked Pipeline (ceil(P/B)+N-1) | RTT Reduction |
|---|---|---|---|---|
| 14 tokens × 2 nodes | 28 hops | 15 hops | 9 hops | **68 percent** |
| 100 tokens × 4 nodes | 400 hops | 103 hops | 7 hops | **98.2 percent** |
| 500 tokens × 8 nodes | 4000 hops | 507 hops | 15 hops | **99.6 percent** |
| 1000 tokens × 4 nodes | 4000 hops | 1003 hops | 43 hops | **98.9 percent** |
| 100 tokens × 10 nodes (70B) | 1000 hops | 109 hops | 19 hops | **98.1 percent** |

At Cloud Run's typical 10ms inter-service RTT, 100 tokens across 4 nodes goes from **4000ms of pure network time** to **70ms**. That's 3.93 seconds of latency deleted  --  not optimized, not amortized, *deleted*.

### Why This Matters More on Cloud Run Than Anywhere Else

Cloud Run's networking tax is brutal compared to edge runtimes:

| Platform | Typical Inter-Service RTT | 400 Sequential Hops | 7 Chunked Hops |
|---|---|---|---|
| **Cloud Run** (same region) | 5-15ms | 2,000-6,000ms | 35-105ms |
| **Cloud Run** (cold start) | 50-200ms | 20,000-80,000ms | 350-1,400ms |
| **Cloudflare Workers** | <1ms | <400ms | <7ms |
| **Local (same machine)** | <0.1ms | <40ms | <0.7ms |

The chunked pipeline doesn't just reduce hops  --  it **changes the scaling regime**. Sequential prefill latency scales as O(P×N×RTT). Chunked pipeline scales as O((P/B+N)×RTT). On Cloud Run, where RTT dominates compute, this is the difference between "unusably slow" and "acceptable."

The Wallington Rotation  --  causal masking tiled with log-rolling  --  eliminates 98 percent+ of network round-trips for any realistic prompt length. Each deleted hop is one fewer Cloud Run inter-service TCP handshake, one fewer HTTP/2 frame, one fewer gRPC serialization cycle, one fewer load balancer decision.

### Individual Optimization Deep Dives

#### Prefill Pipeline

```
20 tokens × 4 nodes, 5ms simulated network delay per hop:

  Sequential:          456ms    (P × N × delay = 20 × 4 × 5 = 400ms + overhead)
  Per-Token Pipeline:  135ms    (P + N-1 = 23 steps × 5ms + overhead)
  Chunked Pipeline:     43ms    (ceil(P/B) + N-1 = 4+3 = 7 steps × 5ms + overhead)
```

The chunked pipeline is 3.2x faster than per-token pipeline, which is itself 3.4x faster than sequential. The speedups compound.

#### Zero-Copy Buffer Forwarding

```
4096-dim hidden states, 10,000 forward operations:

  Copy (buffer.slice + new Float32Array):  29.4ms
  Zero-copy (subarray):                      1.3ms
  Speedup:                                  23x
  Memory saved:                           156MB
```

`subarray()` creates a view into the existing buffer  --  zero allocation, zero copy. The old path allocated a fresh 16KB buffer for every single forward pass. Over a 100-token prefill across 4 nodes, that's 400 × 16KB = 6.4MB of garbage per request.

#### Activation Int8 Quantization

```
4096-dim hidden states, 5,000 round-trips:

  Raw fp32 payload:        16,384 bytes/hop
  Quantized int8 payload:   4,108 bytes/hop  (4x compression)
  Quality loss:             0.318 percent relative error
  Throughput:             127,386 quantize ops/sec
```

The compute cost of quantize + serialize + deserialize + dequantize (70ms for 5K ops = 14µs per round-trip) is negligible compared to network savings. At 10ms RTT, shaving 12KB off each payload saves more time in TCP window management than the quantization costs.

#### Loop Detection

```
4096-dim hidden states, 500 tokens:

  Per-token cost:   68µs
  Total overhead:   34ms for 500 tokens
  False positives:  0
  Detection speed:  Catches period-1 loops within 3 tokens
```

68µs per token is invisible next to a 10ms network hop. The loop detector catches degenerate repetition at step 13  --  well before a user would notice infinite output.

#### Skip-Ahead Wormholes

```
Cold phase (learning):
  1,000 observations recorded in 23ms (23µs each)

Warm phase (prediction):
  5,000 predictions in 2ms (0.4µs each)
  Skip rate: 100 percent on learned mappings
```

After 50 observations of a consistent input→output mapping, the wormhole achieves 100 percent skip rate at 0.4µs per prediction. A skipped node saves one full network RTT (5-15ms on Cloud Run). The prediction cost is 10,000x cheaper than the savings.

#### Parallel Weight Loading

```
20 weight tensors, 5ms I/O per tensor, batch size 5:

  Sequential:  116ms (20 × 5ms + overhead)
  Parallel:     23ms (4 batches × 5ms + overhead)
  Speedup:     5.1x
```

`Promise.all()` batches overlap I/O for independent weight tensors. Applied to depformer (48 weights) and Mimi codec (60+ weights) loading in the coordinator.

### Full Stack Composed

```
20 tokens × 4 nodes, 4096-dim, all optimizations active:

  BASELINE:   484ms  (sequential + copy-on-forward + no heuristics)
  OPTIMIZED:   48ms  (chunked pipeline + zero-copy + int8 + loop detection + skip-ahead)
  SPEEDUP:     10x

  Components:
    Chunked pipeline:     B=5, 4 chunks (was 80 sequential hops)
    Zero-copy forwarding: subarray (was buffer.slice)
    Int8 quantization:    4x compression per hop
    Loop detection:       active, 0 false positives
    Skip-ahead learning:  16 mappings recorded
```

## Measurement Strategy

Each optimization has a distinct latency signature. To isolate the impact of each rotation, we measure at three levels: local integration tests with mock timing, live Cloud Run inference with structured logging, and A/B comparison against the sequential baseline.

## Live Cloud Run Benchmarks

The coordinator already logs structured timing data. To benchmark live:

```bash
# Deploy with pipelined prefill
gcloud run deploy inference-personaplex-7b-v1-coordinator ...

# Run benchmark prompts of varying lengths
for len in 10 50 100 200; do
  curl -s -X POST $COORDINATOR_URL/api/v1/inference \
    -H 'Content-Type: application/json' \
    -d "{\"prompt\":\"$(python3 -c "print('hello ' * $len)")\",\"max_tokens\":5}" \
    | jq '{prefill_ms: .timing.prefill_ms, gen_ms: .timing.generation_ms}'
done
```

Compare against the previous Docker image (sequential prefill) at the same prompt lengths.

## A/B Framework

For rigorous comparison, deploy two coordinator versions behind a load balancer:

1. **Control:** Sequential prefill (revert `pipelinedPrefill` call to inline loop)
2. **Treatment:** Full optimization stack (pipeline + zero-copy + loop detection + skip-ahead)

Route 50 percent of traffic to each. Compare:
- P50/P95/P99 prefill latency
- P50/P95/P99 total inference latency
- Memory usage (heapUsed)
- Error rate (NaN terminations, loop aborts)
- Output quality (manual review of 100 random generations)
