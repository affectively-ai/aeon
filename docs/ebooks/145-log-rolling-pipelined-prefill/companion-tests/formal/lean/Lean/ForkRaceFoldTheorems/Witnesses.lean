import ForkRaceFoldTheorems.Claims

namespace ForkRaceFoldTheorems

structure RuntimeWitness where
  id : String
  theoremRef : String
  kind : String
  fold : String
  inputs : List Int
  observed : Int
  alternate : Option Int
  note : String

private def jsonEscape (value : String) : String :=
  value.foldl
    (fun acc ch =>
      acc ++
        match ch with
        | '"' => "\\\""
        | '\\' => "\\\\"
        | '\n' => "\\n"
        | '\r' => "\\r"
        | '\t' => "\\t"
        | c => String.singleton c)
    ""

private def jsonString (value : String) : String :=
  "\"" ++ jsonEscape value ++ "\""

private def jsonIntList (values : List Int) : String :=
  "[" ++ String.intercalate "," (values.map toString) ++ "]"

private def jsonOptionalInt : Option Int -> String
  | some value => toString value
  | none => "null"

private def runtimeWitnessToJson (witness : RuntimeWitness) : String :=
  "{" ++
    "\"id\":" ++ jsonString witness.id ++ "," ++
    "\"theoremRef\":" ++ jsonString witness.theoremRef ++ "," ++
    "\"kind\":" ++ jsonString witness.kind ++ "," ++
    "\"fold\":" ++ jsonString witness.fold ++ "," ++
    "\"inputs\":" ++ jsonIntList witness.inputs ++ "," ++
    "\"observed\":" ++ toString witness.observed ++ "," ++
    "\"alternate\":" ++ jsonOptionalInt witness.alternate ++ "," ++
    "\"note\":" ++ jsonString witness.note ++
  "}"

def linearCancellationWitness : RuntimeWitness :=
  {
    id := "linear-cancellation"
    theoremRef := "Claims.linear_fold_preserves_cancellation_target_family"
    kind := "cancellation"
    fold := "linear"
    inputs := [1, -1]
    observed := linearFoldInt 1 (-1)
    alternate := none
    note := "Linear fold realizes the cancellation witness exactly."
  }

def winnerCancellationWitness : RuntimeWitness :=
  {
    id := "winner-cancellation-counterexample"
    theoremRef := "Claims.winner_selection_misses_cancellation_target_family"
    kind := "cancellation"
    fold := "winner-by-magnitude"
    inputs := [1, -1]
    observed := winnerByMagnitudeFold 1 (-1)
    alternate := some 0
    note := "Winner selection misses the same x + (-x) witness that linear fold cancels."
  }

def earlyStopCancellationWitness : RuntimeWitness :=
  {
    id := "early-stop-cancellation-counterexample"
    theoremRef := "Claims.early_stop_misses_cancellation_target_family"
    kind := "cancellation"
    fold := "early-stop"
    inputs := [1, -1]
    observed := earlyStopFold 1 (-1)
    alternate := some 0
    note := "Early stop returns the first branch instead of cancelling the pair."
  }

def winnerPartitionWitness : RuntimeWitness :=
  {
    id := "winner-partition-counterexample"
    theoremRef := "Claims.winner_selection_not_partition_additive"
    kind := "partition"
    fold := "winner-by-magnitude"
    inputs := [2, 1, -2]
    observed := winnerByMagnitudeFold3 2 1 (-2)
    alternate := some (linearFoldInt (winnerByMagnitudeFold 2 1) (-2))
    note := "Winner selection is not partition additive on the (2,1,-2) witness."
  }

def earlyStopPartitionWitness : RuntimeWitness :=
  {
    id := "early-stop-partition-counterexample"
    theoremRef := "Claims.early_stop_not_partition_additive"
    kind := "partition"
    fold := "early-stop"
    inputs := [1, 0, -1]
    observed := earlyStopFold3 1 0 (-1)
    alternate := some (linearFoldInt (earlyStopFold 1 0) (-1))
    note := "Early stop is not partition additive on the (1,0,-1) witness."
  }

def winnerOrderWitness : RuntimeWitness :=
  {
    id := "winner-order-counterexample"
    theoremRef := "Claims.winner_selection_not_order_invariant"
    kind := "order"
    fold := "winner-by-magnitude"
    inputs := [1, -1]
    observed := winnerByMagnitudeFold 1 (-1)
    alternate := some (winnerByMagnitudeFold (-1) 1)
    note := "Winner selection depends on input order when magnitudes tie."
  }

def earlyStopOrderWitness : RuntimeWitness :=
  {
    id := "early-stop-order-counterexample"
    theoremRef := "Claims.early_stop_not_order_invariant"
    kind := "order"
    fold := "early-stop"
    inputs := [1, -1]
    observed := earlyStopFold 1 (-1)
    alternate := some (earlyStopFold (-1) 1)
    note := "Early stop depends on which branch arrives first."
  }

def runtimeWitnessCatalog : List RuntimeWitness :=
  [
    linearCancellationWitness,
    winnerCancellationWitness,
    earlyStopCancellationWitness,
    winnerPartitionWitness,
    earlyStopPartitionWitness,
    winnerOrderWitness,
    earlyStopOrderWitness
  ]

def runtimeWitnessCatalogJson : String :=
  "{" ++
    "\"label\":\"formal-fold-boundary-witness-catalog-v1\"," ++
    "\"witnesses\":[" ++
      String.intercalate "," (runtimeWitnessCatalog.map runtimeWitnessToJson) ++
    "]" ++
  "}"

end ForkRaceFoldTheorems
