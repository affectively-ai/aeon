# Chapter 17 External Replication

- Label: `ch17-external-replication-v1`
- Root command: `cd open-source/aeon/docs/ebooks/145-log-rolling-pipelined-prefill/companion-tests && bun run test:ch17-external-replication`
- Total duration ms: `51695`
- Approx runtime: `51.695 s`
- Slowest step: `Install workspace dependencies` (`26367 ms`)
- Manifest stable: `yes`
- All hashes match: `yes`
- Overall result: `pass`

## Steps

| Step | Result | Duration ms | Command |
| --- | --- | ---: | --- |
| Install workspace dependencies | `ok` | 26367 | `bun install --frozen-lockfile` |
| Build Gnosis | `ok` | 2650 | `bun run build` |
| Test Gnosis fold training | `ok` | 323 | `bun run test:fold-training` |
| Test Gnosis negative controls | `ok` | 147 | `bun run test:negative-controls` |
| Test Gnosis regime sweep | `ok` | 1586 | `bun run test:regime-sweep` |
| Test Gnosis adversarial controls | `ok` | 256 | `bun run test:adversarial-controls` |
| Test Gnosis mini-MoE routing | `ok` | 3083 | `bun run test:mini-moe-routing` |
| Export formal witness catalog | `ok` | 5242 | `bun run test:formal:witnesses` |
| Run Chapter 17 reproduction surface | `ok` | 12010 | `bun run test:ch17-reproduction-surface` |
| Refresh replication manifest | `ok` | 31 | `bun run test:ch17-replication-pack` |

## Hash Checks

| Path | Matches | SHA-256 |
| --- | --- | --- |
| `open-source/aeon/docs/ebooks/145-log-rolling-pipelined-prefill/ch17-arxiv-manuscript.md` | `yes` | `aca5d15f58145c69cad9814f01afa0ce78b90153e3d0eb0c948041293689689d` |
| `open-source/aeon/docs/ebooks/145-log-rolling-pipelined-prefill/companion-tests/README.md` | `yes` | `3fa87bd319d9e1d2a0b559d47bbcc4b18c755ed8bdf5c82d64aa6e88b92b10b8` |
| `.github/workflows/ch17-evidence.yml` | `yes` | `703bafe452d44ee4678900b53f3e81c62011f904ab34e646e121aabad3bf22ff` |
| `open-source/aeon/docs/ebooks/145-log-rolling-pipelined-prefill/companion-tests/artifacts/quantum-recombination-ablation.json` | `yes` | `6920d51512b943fc9a5e1aa1292dcce92ef1a30f83be89392f929e2e8b336181` |
| `open-source/aeon/docs/ebooks/145-log-rolling-pipelined-prefill/companion-tests/artifacts/toy-attention-fold-ablation.json` | `yes` | `589310d63767500cc0cde8d707da02889173f9943b220c886d8ae40ab92ae8d3` |
| `open-source/aeon/docs/ebooks/145-log-rolling-pipelined-prefill/companion-tests/artifacts/gnosis-fold-training-benchmark.json` | `yes` | `b63ba10a3805b1f2cad3d632983a3b12124a48bc2ce9765abb7d259bc353fb29` |
| `open-source/aeon/docs/ebooks/145-log-rolling-pipelined-prefill/companion-tests/artifacts/gnosis-negative-controls.json` | `yes` | `1462b8d8588b534b4eac6fa655684a8aee903402f377f0f8aa6b1eaeef423071` |
| `open-source/aeon/docs/ebooks/145-log-rolling-pipelined-prefill/companion-tests/artifacts/gnosis-fold-boundary-regime-sweep.json` | `yes` | `9a65c3d14dcfa47381b2e8a395c2e7a3a89342d0ea88d3ba481884eb164b40ae` |
| `open-source/aeon/docs/ebooks/145-log-rolling-pipelined-prefill/companion-tests/artifacts/gnosis-adversarial-controls-benchmark.json` | `yes` | `1331f43bc78e2e20b2d2cc34b83342f81e1a780b69e4a2f6ab0f5946db68a227` |
| `open-source/aeon/docs/ebooks/145-log-rolling-pipelined-prefill/companion-tests/artifacts/gnosis-moe-routing-benchmark.json` | `yes` | `81887e82d84566e6792443a8dcda8c6d18e5c21ed396c15439750108502ba42e` |
| `open-source/aeon/docs/ebooks/145-log-rolling-pipelined-prefill/companion-tests/artifacts/formal-witness-catalog.json` | `yes` | `bed334cb6a13a0d27a9831f93b45a3d97299eee9d744bf4c9f0c5808fe093c2f` |
| `open-source/aeon/docs/ebooks/145-log-rolling-pipelined-prefill/companion-tests/artifacts/ch17-correspondence-boundary-figure.svg` | `yes` | `360d4b9a0db0d9a6da13874703e0007f1412a984d90b248b679b42bfe1d4a679` |
| `open-source/aeon/docs/ebooks/145-log-rolling-pipelined-prefill/companion-tests/artifacts/ch17-boundary-expansion-figure.svg` | `yes` | `7c3479085e73718621b2c12ae6d1b88f8367539631013bcb04dbb784a64940e7` |
| `open-source/aeon/docs/ebooks/145-log-rolling-pipelined-prefill/companion-tests/scripts/ch17-replication-pack.ts` | `yes` | `6f4a7adaa41f29430d08851aab7410fc63abe51502cc6b153734a45513030e58` |
| `open-source/aeon/docs/ebooks/145-log-rolling-pipelined-prefill/companion-tests/scripts/gnosis-negative-controls-benchmark.ts` | `yes` | `db7d2326aece58a6ddb0444d6551d02e64eb1e88a57a705cefdc48a34ea62fe8` |
| `open-source/aeon/docs/ebooks/145-log-rolling-pipelined-prefill/companion-tests/scripts/gnosis-regime-sweep-benchmark.ts` | `yes` | `bcc288289201aba15c407610c72da75337557752134a0167d620b0f4858e40e6` |
| `open-source/aeon/docs/ebooks/145-log-rolling-pipelined-prefill/companion-tests/scripts/gnosis-adversarial-controls-benchmark.ts` | `yes` | `019884b3ccf6a92e0daddec7fd2c5561bdf9feeee32cd42a3601b2f369902fac` |
| `open-source/aeon/docs/ebooks/145-log-rolling-pipelined-prefill/companion-tests/scripts/formal-witness-catalog.ts` | `yes` | `d323f121a5d082d8afc2c2193bea1ab5ff7283d52b8dc82b0fc821f075522b02` |
| `open-source/aeon/docs/ebooks/145-log-rolling-pipelined-prefill/companion-tests/scripts/ch17-boundary-expansion-figure.ts` | `yes` | `0906d94aed9ce0d4073cbf905b1513e8c70abf1279d67a77a0f3d9ac2316079c` |
| `open-source/aeon/docs/ebooks/145-log-rolling-pipelined-prefill/companion-tests/scripts/ch17-external-replication.ts` | `yes` | `7bb8fb22fce5b3754a0021a356baec0416a81a240d1bc936d45e59dc81ebf690` |
| `open-source/aeon/docs/ebooks/145-log-rolling-pipelined-prefill/companion-tests/formal/lean/Lean/ForkRaceFoldTheorems/Claims.lean` | `yes` | `6c426f5736691e81f4d199321d7d86b04240f45b9391cfe447c06763b441f3b1` |
| `open-source/aeon/docs/ebooks/145-log-rolling-pipelined-prefill/companion-tests/formal/lean/Lean/ForkRaceFoldTheorems/Witnesses.lean` | `yes` | `3a10680a28eaab8ae9cba391848341bb1c167c41d9267a25ba65e26e9637f7d1` |
| `open-source/aeon/docs/ebooks/145-log-rolling-pipelined-prefill/companion-tests/formal/THEOREM_LEDGER.md` | `yes` | `8350ab53c766fc7eaee75ca712734826cfd0c366f6ee0377ce51f44383288009` |
| `open-source/gnosis/examples/benchmarks/fold-training.test.gg` | `yes` | `cd0734e4dc96534ed442a0a38456af68005aeb72c40f853438eda8d21d93e43b` |
| `open-source/gnosis/examples/benchmarks/moe-routing.test.gg` | `yes` | `282621a787b783cfde5dceaba5cad909de0824ac9f5989b51a50a13e88671a2d` |

Interpretation: this report is the outside-rerun summary for the checked Chapter 17 evidence bundle only. It executes the Gnosis and Chapter 17 artifact/witness/manuscript reproduction surface, does not rebuild the TeX/PDF layer, and then independently recomputes the replication-pack hashes to verify that the checked-in evidence bundle still matches the files on disk.

