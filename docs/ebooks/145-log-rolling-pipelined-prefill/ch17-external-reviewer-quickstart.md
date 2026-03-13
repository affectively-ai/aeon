# Chapter 17 External Reviewer Quickstart

- Parent volume README: [README.md](./README.md)
- Companion test suite: [companion-tests/README.md](./companion-tests/README.md)
- Replication manifest: [companion-tests/artifacts/ch17-replication-pack.md](./companion-tests/artifacts/ch17-replication-pack.md)
- Outside rerun report: [companion-tests/artifacts/ch17-external-replication.md](./companion-tests/artifacts/ch17-external-replication.md)

Use this path when you want to verify the Chapter 17 evidence bundle from a checkout of the repo without rebuilding the TeX or PDF surface.

## Preconditions

- Run from the repository root: `/Users/buley/Documents/Code/emotions`
- Bun `1.3.x` must be available on `PATH`
- Network access is required for `bun install --frozen-lockfile`
- No paid AI services, cloud deployments, or manuscript/PDF build steps are part of this rerun

## One Command

```bash
cd open-source/aeon/docs/ebooks/145-log-rolling-pipelined-prefill/companion-tests
bun run test:ch17-external-replication
```

## What The Command Does

1. Installs workspace dependencies with the locked Bun workspace.
2. Builds the local Gnosis package.
3. Runs the seeded Gnosis fold-training, negative-control, regime-sweep, adversarial-control, and mini-MoE routing benchmarks.
4. Exports the Lean-originated witness catalog consumed by the runtime boundary tests.
5. Regenerates the Chapter 17 reproduction surface and refreshes the replication manifest.
6. Verifies that the refreshed manifest still matches the checked-in evidence files by SHA-256.

## Success Criteria

- `Overall result` is `pass` in [companion-tests/artifacts/ch17-external-replication.md](./companion-tests/artifacts/ch17-external-replication.md)
- `Manifest stable` is `yes`
- `All hashes match` is `yes`
- The rerun finishes without touching `arxiv-manuscript.tex` or rebuilding the PDF layer

## Runtime Notes

- The last recorded run on March 13, 2026 completed in about `82.669 s`
- The cold-cache install step took `42.846 s`
- The longest evidence step after install was `Run Chapter 17 reproduction surface` at `20.069 s`
- For current timings, trust the generated JSON report rather than this prose snapshot: [companion-tests/artifacts/ch17-external-replication.json](./companion-tests/artifacts/ch17-external-replication.json)

## Output Files

- Machine-readable rerun report: [companion-tests/artifacts/ch17-external-replication.json](./companion-tests/artifacts/ch17-external-replication.json)
- Human-readable rerun report: [companion-tests/artifacts/ch17-external-replication.md](./companion-tests/artifacts/ch17-external-replication.md)
- Manifest and hashes for the evidence bundle: [companion-tests/artifacts/ch17-replication-pack.md](./companion-tests/artifacts/ch17-replication-pack.md)

## Failure Triage

- If the build or benchmark steps fail, rerun the failing command from the step table in the external-replication report.
- If the hash check fails, compare the changed file against the path listed in the replication manifest before trusting any manuscript claim based on that artifact.
- If you need to inspect the formal boundary itself, start with [companion-tests/formal/THEOREM_LEDGER.md](./companion-tests/formal/THEOREM_LEDGER.md) and [companion-tests/formal/README.md](./companion-tests/formal/README.md).
