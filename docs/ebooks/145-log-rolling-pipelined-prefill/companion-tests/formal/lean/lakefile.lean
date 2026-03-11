import Lake
open Lake DSL

package «fork_race_fold_theorems» where
  version := v!"0.1.0"

@[default_target]
lean_lib ForkRaceFoldTheorems where
  srcDir := "Lean"
