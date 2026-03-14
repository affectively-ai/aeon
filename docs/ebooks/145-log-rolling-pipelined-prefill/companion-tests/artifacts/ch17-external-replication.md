# Chapter 17 External Replication

- Label: `ch17-external-replication-v1`
- Root command: `cd open-source/aeon/docs/ebooks/145-log-rolling-pipelined-prefill/companion-tests && bun run test:ch17-external-replication`
- Total duration ms: `129361`
- Approx runtime: `129.361 s`
- Slowest step: `Run Chapter 17 reproduction surface` (`58026 ms`)
- Manifest stable: `yes`
- All hashes match: `yes`
- Overall result: `pass`

## Steps

| Step | Result | Duration ms | Command |
| --- | --- | ---: | --- |
| Install workspace dependencies | `ok` | 28849 | `bun install --frozen-lockfile` |
| Build Gnosis | `ok` | 2581 | `bun run build` |
| Test Gnosis fold training | `ok` | 325 | `bun run test:fold-training` |
| Test Gnosis negative controls | `ok` | 149 | `bun run test:negative-controls` |
| Test Gnosis near-control sweep | `ok` | 3166 | `bun run test:near-control-sweep` |
| Test Gnosis regime sweep | `ok` | 1524 | `bun run test:regime-sweep` |
| Test Gnosis adversarial controls | `ok` | 238 | `bun run test:adversarial-controls` |
| Test Gnosis mini-MoE routing | `ok` | 3001 | `bun run test:mini-moe-routing` |
| Export formal witness catalog | `ok` | 6174 | `bun run test:formal:witnesses` |
| Export formal adaptive witness catalog | `ok` | 25294 | `bun run test:formal:adaptive-witnesses` |
| Run Chapter 17 reproduction surface | `ok` | 58026 | `bun run test:ch17-reproduction-surface` |
| Refresh replication manifest | `ok` | 34 | `bun run test:ch17-replication-pack` |

## Hash Checks

| Path | Matches | SHA-256 |
| --- | --- | --- |
| `open-source/aeon/docs/ebooks/145-log-rolling-pipelined-prefill/ch17-arxiv-manuscript.md` | `yes` | `016a316ff9dd690a2ba79db64ae1d984a13db3912824ce28a23bb24dc4b00418` |
| `open-source/aeon/docs/ebooks/145-log-rolling-pipelined-prefill/companion-tests/README.md` | `yes` | `98d1c31eaaf2e6319de02d200485c0fb1aad594bf9278f0f3bbd750368bbeaea` |
| `.github/workflows/ch17-evidence.yml` | `yes` | `737235df866defea29f4440f1cd5bcd6a065c776b51846472090ae21b653019f` |
| `open-source/aeon/docs/ebooks/145-log-rolling-pipelined-prefill/companion-tests/artifacts/quantum-recombination-ablation.json` | `yes` | `6920d51512b943fc9a5e1aa1292dcce92ef1a30f83be89392f929e2e8b336181` |
| `open-source/aeon/docs/ebooks/145-log-rolling-pipelined-prefill/companion-tests/artifacts/toy-attention-fold-ablation.json` | `yes` | `589310d63767500cc0cde8d707da02889173f9943b220c886d8ae40ab92ae8d3` |
| `open-source/aeon/docs/ebooks/145-log-rolling-pipelined-prefill/companion-tests/artifacts/gnosis-fold-training-benchmark.json` | `yes` | `b63ba10a3805b1f2cad3d632983a3b12124a48bc2ce9765abb7d259bc353fb29` |
| `open-source/aeon/docs/ebooks/145-log-rolling-pipelined-prefill/companion-tests/artifacts/gnosis-negative-controls.json` | `yes` | `1462b8d8588b534b4eac6fa655684a8aee903402f377f0f8aa6b1eaeef423071` |
| `open-source/aeon/docs/ebooks/145-log-rolling-pipelined-prefill/companion-tests/artifacts/gnosis-near-control-sweep.json` | `yes` | `8ddb8a42708867c0cab816e29cc9f3a1487abe8b6cd6721c3a83324ddcfe171e` |
| `open-source/aeon/docs/ebooks/145-log-rolling-pipelined-prefill/companion-tests/artifacts/gnosis-fold-boundary-regime-sweep.json` | `yes` | `9a65c3d14dcfa47381b2e8a395c2e7a3a89342d0ea88d3ba481884eb164b40ae` |
| `open-source/aeon/docs/ebooks/145-log-rolling-pipelined-prefill/companion-tests/artifacts/gnosis-adversarial-controls-benchmark.json` | `yes` | `1331f43bc78e2e20b2d2cc34b83342f81e1a780b69e4a2f6ab0f5946db68a227` |
| `open-source/aeon/docs/ebooks/145-log-rolling-pipelined-prefill/companion-tests/artifacts/gnosis-moe-routing-benchmark.json` | `yes` | `81887e82d84566e6792443a8dcda8c6d18e5c21ed396c15439750108502ba42e` |
| `open-source/aeon/docs/ebooks/145-log-rolling-pipelined-prefill/companion-tests/artifacts/formal-witness-catalog.json` | `yes` | `bed334cb6a13a0d27a9831f93b45a3d97299eee9d744bf4c9f0c5808fe093c2f` |
| `open-source/aeon/docs/ebooks/145-log-rolling-pipelined-prefill/companion-tests/artifacts/formal-adaptive-witness-catalog.json` | `yes` | `472dc476a483d9c5874fd4d7c428e819934726486d01c25ad6aed6a52e28349a` |
| `open-source/aeon/docs/ebooks/145-log-rolling-pipelined-prefill/companion-tests/artifacts/adaptive-supremum-witness.json` | `yes` | `99f474b8e51b06b2dda0334bf290198dd338c895f9fdaa491d41b70b6f514d49` |
| `open-source/aeon/docs/ebooks/145-log-rolling-pipelined-prefill/companion-tests/artifacts/adaptive-supremum-family-sweep.json` | `yes` | `d39d0c1e2199a12c84fc23a3c9a9742943f4a5958cbd569adb17300f2e80e961` |
| `open-source/aeon/docs/ebooks/145-log-rolling-pipelined-prefill/companion-tests/artifacts/ch17-correspondence-boundary-figure.svg` | `yes` | `360d4b9a0db0d9a6da13874703e0007f1412a984d90b248b679b42bfe1d4a679` |
| `open-source/aeon/docs/ebooks/145-log-rolling-pipelined-prefill/companion-tests/artifacts/ch17-boundary-expansion-figure.svg` | `yes` | `030f732ce53d1598c69b9228fd57145c1ad672f15892df68d44dd37a88ce67f2` |
| `open-source/aeon/docs/ebooks/145-log-rolling-pipelined-prefill/companion-tests/scripts/ch17-replication-pack.ts` | `yes` | `6f4a7adaa41f29430d08851aab7410fc63abe51502cc6b153734a45513030e58` |
| `open-source/aeon/docs/ebooks/145-log-rolling-pipelined-prefill/companion-tests/scripts/gnosis-negative-controls-benchmark.ts` | `yes` | `db7d2326aece58a6ddb0444d6551d02e64eb1e88a57a705cefdc48a34ea62fe8` |
| `open-source/aeon/docs/ebooks/145-log-rolling-pipelined-prefill/companion-tests/scripts/gnosis-near-control-sweep-benchmark.ts` | `yes` | `5dc3d08d061694a544d197c3a6e309f73105c5bb3052f2820571704268a759d0` |
| `open-source/aeon/docs/ebooks/145-log-rolling-pipelined-prefill/companion-tests/scripts/gnosis-regime-sweep-benchmark.ts` | `yes` | `bcc288289201aba15c407610c72da75337557752134a0167d620b0f4858e40e6` |
| `open-source/aeon/docs/ebooks/145-log-rolling-pipelined-prefill/companion-tests/scripts/gnosis-adversarial-controls-benchmark.ts` | `yes` | `019884b3ccf6a92e0daddec7fd2c5561bdf9feeee32cd42a3601b2f369902fac` |
| `open-source/aeon/docs/ebooks/145-log-rolling-pipelined-prefill/companion-tests/scripts/formal-witness-catalog.ts` | `yes` | `d323f121a5d082d8afc2c2193bea1ab5ff7283d52b8dc82b0fc821f075522b02` |
| `open-source/aeon/docs/ebooks/145-log-rolling-pipelined-prefill/companion-tests/scripts/formal-adaptive-witness-catalog.ts` | `yes` | `7131487d0e13d446cc8fd74875c3fcab64f7049852b837b76132543d9293cc45` |
| `open-source/aeon/docs/ebooks/145-log-rolling-pipelined-prefill/companion-tests/scripts/adaptive-supremum-witness.ts` | `yes` | `9f109f175040fca9eebb8495c4074e7d0d7050509b81b8985d5902ba41cab239` |
| `open-source/aeon/docs/ebooks/145-log-rolling-pipelined-prefill/companion-tests/scripts/adaptive-supremum-family-sweep.ts` | `yes` | `e5d04297716175f59321fca1ec9fa60c30bb3ab27180f3865a90ef31032bbd07` |
| `open-source/aeon/docs/ebooks/145-log-rolling-pipelined-prefill/companion-tests/scripts/ch17-boundary-expansion-figure.ts` | `yes` | `ff2e2671e2ad1cbc6b327b18dfca5cee52f5f08e929c0d798bef14dc4c3a932f` |
| `open-source/aeon/docs/ebooks/145-log-rolling-pipelined-prefill/companion-tests/scripts/ch17-external-replication.ts` | `yes` | `7bb8fb22fce5b3754a0021a356baec0416a81a240d1bc936d45e59dc81ebf690` |
| `open-source/aeon/docs/ebooks/145-log-rolling-pipelined-prefill/companion-tests/formal/lean/Lean/ForkRaceFoldTheorems/Claims.lean` | `yes` | `6c426f5736691e81f4d199321d7d86b04240f45b9391cfe447c06763b441f3b1` |
| `open-source/aeon/docs/ebooks/145-log-rolling-pipelined-prefill/companion-tests/formal/lean/Lean/ForkRaceFoldTheorems/Witnesses.lean` | `yes` | `3a10680a28eaab8ae9cba391848341bb1c167c41d9267a25ba65e26e9637f7d1` |
| `open-source/aeon/docs/ebooks/145-log-rolling-pipelined-prefill/companion-tests/formal/lean/Lean/ForkRaceFoldTheorems/AdaptiveWitnesses.lean` | `yes` | `6eafe2bb1078c82152b3c5010832eb20ba45de8522050c59a2eb586ad63668aa` |
| `open-source/aeon/docs/ebooks/145-log-rolling-pipelined-prefill/companion-tests/formal/THEOREM_LEDGER.md` | `yes` | `dfcea5330c993eb9bf595da040bdad9618f1b03f558af04ae1934f153bdb658d` |
| `open-source/gnosis/examples/benchmarks/fold-training.test.gg` | `yes` | `cd0734e4dc96534ed442a0a38456af68005aeb72c40f853438eda8d21d93e43b` |
| `open-source/gnosis/examples/benchmarks/moe-routing.test.gg` | `yes` | `282621a787b783cfde5dceaba5cad909de0824ac9f5989b51a50a13e88671a2d` |

Interpretation: this report is the outside-rerun summary for the checked Chapter 17 evidence bundle only. It executes the Gnosis and Chapter 17 artifact/witness/manuscript reproduction surface, does not rebuild the TeX/PDF layer, and then independently recomputes the replication-pack hashes to verify that the checked-in evidence bundle still matches the files on disk.

