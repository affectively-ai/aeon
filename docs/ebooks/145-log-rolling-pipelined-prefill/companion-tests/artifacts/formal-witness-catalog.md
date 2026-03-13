# Formal Witness Catalog

- Label: `formal-fold-boundary-witness-catalog-v1`
- Witness count: `7`

| Witness | Kind | Fold | Inputs | Observed | Alternate | Theorem |
| --- | --- | --- | --- | ---: | ---: | --- |
| `linear-cancellation` | `cancellation` | `linear` | `1, -1` | 0 | null | `Claims.linear_fold_preserves_cancellation_target_family` |
| `winner-cancellation-counterexample` | `cancellation` | `winner-by-magnitude` | `1, -1` | 1 | 0 | `Claims.winner_selection_misses_cancellation_target_family` |
| `early-stop-cancellation-counterexample` | `cancellation` | `early-stop` | `1, -1` | 1 | 0 | `Claims.early_stop_misses_cancellation_target_family` |
| `winner-partition-counterexample` | `partition` | `winner-by-magnitude` | `2, 1, -2` | 2 | 0 | `Claims.winner_selection_not_partition_additive` |
| `early-stop-partition-counterexample` | `partition` | `early-stop` | `1, 0, -1` | 1 | 0 | `Claims.early_stop_not_partition_additive` |
| `winner-order-counterexample` | `order` | `winner-by-magnitude` | `1, -1` | 1 | -1 | `Claims.winner_selection_not_order_invariant` |
| `early-stop-order-counterexample` | `order` | `early-stop` | `1, -1` | 1 | -1 | `Claims.early_stop_not_order_invariant` |

Interpretation: these witnesses are emitted directly from the Lean theorem package and consumed by the runtime boundary tests, so the formal layer now supplies concrete executable counterexamples instead of merely describing them.

