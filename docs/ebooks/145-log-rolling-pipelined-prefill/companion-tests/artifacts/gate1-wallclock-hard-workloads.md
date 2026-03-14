# Gate 1 Wall-Clock Matrix

Distributed benchmark with live HTTP stage servers and impairment injection (RTT/jitter/loss).

## Execution

- Label: loopback-hard-workloads
- Mode: embedded-stage-servers
- Listen host: 127.0.0.1
- Advertise host: 127.0.0.1

## Verdict

- Overall Gate 1: **PASS**
- Primary cells passed: 4/4

## Matrix Results

| Cell | Primary | Trials | Seq p50 / p95 (ms) | Chunked p50 / p95 (ms) | Median Speedup (95% CI) | Median Improvement (95% CI, ms) | Pass |
|---|---|---:|---:|---:|---:|---:|---|
| md5-grind-n4-b8__rtt3-loss0 | yes | 4/4 | 353.05 / 360.08 | 33.16 / 34.86 | 10.781 (10.057 to 11.310) | 319.29 (316.90 to 327.37) | yes |
| md5-grind-n4-b8__rtt7-loss0 | yes | 4/4 | 963.92 / 983.08 | 65.25 / 67.97 | 14.662 (14.126 to 16.499) | 896.53 (882.65 to 924.35) | yes |
| factor-semiprime-n4-b6__rtt3-loss0 | yes | 4/4 | 308.07 / 335.03 | 62.91 / 63.58 | 4.884 (4.707 to 5.540) | 244.99 (234.63 to 278.17) | yes |
| factor-semiprime-n4-b6__rtt7-loss0 | yes | 4/4 | 801.53 / 806.69 | 100.75 / 104.00 | 7.899 (7.718 to 8.480) | 700.39 (687.58 to 707.39) | yes |

## Gate Rule

- Cell pass requires zero failed trials plus 95% bootstrap CI lower bounds above no-improvement for both paired median speedup (>1.0) and paired median latency improvement (>0 ms).
- Gate 1 pass requires all primary cells to pass.
