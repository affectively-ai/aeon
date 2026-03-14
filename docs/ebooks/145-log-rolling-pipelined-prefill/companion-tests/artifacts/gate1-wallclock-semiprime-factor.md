# Gate 1 Wall-Clock Matrix

Distributed benchmark with live HTTP stage servers and impairment injection (RTT/jitter/loss).

## Execution

- Label: loopback-semiprime-factor
- Mode: embedded-stage-servers
- Listen host: 127.0.0.1
- Advertise host: 127.0.0.1

## Verdict

- Overall Gate 1: **PASS**
- Primary cells passed: 2/2

## Matrix Results

| Cell | Primary | Trials | Seq p50 / p95 (ms) | Chunked p50 / p95 (ms) | Median Speedup (95% CI) | Median Improvement (95% CI, ms) | Pass |
|---|---|---:|---:|---:|---:|---:|---|
| factor-semiprime-n4-b6__rtt3-loss0 | yes | 4/4 | 306.61 / 308.52 | 67.56 / 67.90 | 4.562 (4.497 to 4.641) | 239.10 (237.54 to 241.30) | yes |
| factor-semiprime-n4-b6__rtt7-loss0 | yes | 4/4 | 768.50 / 797.83 | 99.69 / 106.31 | 7.824 (7.222 to 8.070) | 667.66 (660.90 to 698.59) | yes |

## Gate Rule

- Cell pass requires zero failed trials plus 95% bootstrap CI lower bounds above no-improvement for both paired median speedup (>1.0) and paired median latency improvement (>0 ms).
- Gate 1 pass requires all primary cells to pass.
