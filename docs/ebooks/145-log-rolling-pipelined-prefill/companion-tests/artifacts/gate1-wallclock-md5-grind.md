# Gate 1 Wall-Clock Matrix

Distributed benchmark with live HTTP stage servers and impairment injection (RTT/jitter/loss).

## Execution

- Label: loopback-md5-grind
- Mode: embedded-stage-servers
- Listen host: 127.0.0.1
- Advertise host: 127.0.0.1

## Verdict

- Overall Gate 1: **PASS**
- Primary cells passed: 2/2

## Matrix Results

| Cell | Primary | Trials | Seq p50 / p95 (ms) | Chunked p50 / p95 (ms) | Median Speedup (95% CI) | Median Improvement (95% CI, ms) | Pass |
|---|---|---:|---:|---:|---:|---:|---|
| md5-grind-n4-b8__rtt3-loss0 | yes | 4/4 | 356.93 / 360.35 | 31.98 / 35.18 | 11.216 (10.037 to 12.391) | 323.48 (319.63 to 328.16) | yes |
| md5-grind-n4-b8__rtt7-loss0 | yes | 4/4 | 963.95 / 981.44 | 65.81 / 68.54 | 14.420 (14.197 to 16.406) | 896.08 (881.98 to 922.32) | yes |

## Gate Rule

- Cell pass requires zero failed trials plus 95% bootstrap CI lower bounds above no-improvement for both paired median speedup (>1.0) and paired median latency improvement (>0 ms).
- Gate 1 pass requires all primary cells to pass.
