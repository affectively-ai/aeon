# Companion Scripts

- Parent README: [../README.md](../README.md)

Utility scripts used by the companion suite.

## Files

- `run-formal-verification.sh`: runs TLC against every `formal/*.cfg` + matching `formal/*.tla` pair, downloading `tla2tools.jar` if needed.
- `run-lean-theorems.sh`: runs `lake build` for the Lean theorem package in `formal/lean`.
- `validate-formal-artifacts.ts`: preflights all formal artifacts via `@affectively/aeon-logic` (`.tla`/`.cfg` parse + round-trip checks).
- `formal-parser-shootoff.ts`: benchmark helper that compares `aeon-logic` parser throughput against a Java SANY parse baseline.
- `formal-parser-equivalence.ts`: differential semantic-equivalence harness (accept/reject agreement + round-trip stability + invalid-corpus rejection) against Java SANY parse outcomes.
