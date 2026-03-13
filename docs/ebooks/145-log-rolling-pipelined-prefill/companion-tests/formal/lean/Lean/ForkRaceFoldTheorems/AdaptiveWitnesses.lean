import ForkRaceFoldTheorems.StateDependentQueueFamilies

namespace ForkRaceFoldTheorems

structure AdaptiveWitnessDescriptor where
  id : String
  theoremRef : String
  ceilingTheoremRef : String
  driftTheoremRef : String
  stationaryBalanceRef : String
  terminalBalanceRef : String
  maxLeftQueue : Nat
  maxRightQueue : Nat
  arrivalLeft : String
  arrivalRight : String
  rerouteProbability : String
  serviceLeft : String
  serviceRight : String
  alphaLeft : String
  alphaRight : String
  driftGap : String
  spectralRadius : String
  stateCount : Nat
  smallSetCount : Nat
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

private def jsonNat (value : Nat) : String :=
  toString value

private def adaptiveWitnessToJson (witness : AdaptiveWitnessDescriptor) : String :=
  "{" ++
    "\"id\":" ++ jsonString witness.id ++ "," ++
    "\"theoremRef\":" ++ jsonString witness.theoremRef ++ "," ++
    "\"ceilingTheoremRef\":" ++ jsonString witness.ceilingTheoremRef ++ "," ++
    "\"driftTheoremRef\":" ++ jsonString witness.driftTheoremRef ++ "," ++
    "\"stationaryBalanceRef\":" ++ jsonString witness.stationaryBalanceRef ++ "," ++
    "\"terminalBalanceRef\":" ++ jsonString witness.terminalBalanceRef ++ "," ++
    "\"maxLeftQueue\":" ++ jsonNat witness.maxLeftQueue ++ "," ++
    "\"maxRightQueue\":" ++ jsonNat witness.maxRightQueue ++ "," ++
    "\"arrivalLeft\":" ++ jsonString witness.arrivalLeft ++ "," ++
    "\"arrivalRight\":" ++ jsonString witness.arrivalRight ++ "," ++
    "\"rerouteProbability\":" ++ jsonString witness.rerouteProbability ++ "," ++
    "\"serviceLeft\":" ++ jsonString witness.serviceLeft ++ "," ++
    "\"serviceRight\":" ++ jsonString witness.serviceRight ++ "," ++
    "\"alphaLeft\":" ++ jsonString witness.alphaLeft ++ "," ++
    "\"alphaRight\":" ++ jsonString witness.alphaRight ++ "," ++
    "\"driftGap\":" ++ jsonString witness.driftGap ++ "," ++
    "\"spectralRadius\":" ++ jsonString witness.spectralRadius ++ "," ++
    "\"stateCount\":" ++ jsonNat witness.stateCount ++ "," ++
    "\"smallSetCount\":" ++ jsonNat witness.smallSetCount ++ "," ++
    "\"note\":" ++ jsonString witness.note ++
  "}"

def twoNodeAdaptiveWitness : AdaptiveWitnessDescriptor :=
  {
    id := "two-node-adaptive-raw-ceiling"
    theoremRef :=
      "StateDependentQueueFamilies.TwoNodeAdaptiveRoutingParameters.constructiveThroughput_stable"
    ceilingTheoremRef :=
      "StateDependentQueueFamilies.TwoNodeAdaptiveRoutingParameters.ceiling_spectralRadius_lt_one"
    driftTheoremRef :=
      "StateDependentQueueFamilies.TwoNodeAdaptiveRoutingParameters.expectedLyapunov_drift"
    stationaryBalanceRef :=
      "StateDependentQueueFamilies.TwoNodeAdaptiveRoutingParameters.kernelFamily_stationary_balance_from_supremum_schema"
    terminalBalanceRef :=
      "StateDependentQueueFamilies.TwoNodeAdaptiveRoutingParameters.kernelFamily_terminal_balance_from_supremum_schema"
    maxLeftQueue := 2
    maxRightQueue := 2
    arrivalLeft := "1/4"
    arrivalRight := "3/20"
    rerouteProbability := "1/2"
    serviceLeft := "1/2"
    serviceRight := "2/5"
    alphaLeft := "1/4"
    alphaRight := "11/40"
    driftGap := "1/8"
    spectralRadius := "0"
    stateCount := 18
    smallSetCount := 1
    note :=
      "Concrete two-node adaptive rerouting witness: explicit ceiling kernel, closed-form alpha, bounded constructive throughput, and linear drift on the bounded state cube."
  }

def adaptiveWitnessCatalog : List AdaptiveWitnessDescriptor :=
  [twoNodeAdaptiveWitness]

def adaptiveWitnessCatalogJson : String :=
  "{" ++
    "\"label\":\"formal-adaptive-supremum-witness-catalog-v1\"," ++
    "\"witnesses\":[" ++
      String.intercalate "," (adaptiveWitnessCatalog.map adaptiveWitnessToJson) ++
    "]" ++
  "}"

end ForkRaceFoldTheorems
