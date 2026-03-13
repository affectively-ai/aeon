import Mathlib
import ForkRaceFoldTheorems.FailureTrilemma

namespace ForkRaceFoldTheorems

def pipelineTerminal (current : List BranchSnapshot) : List (List BranchSnapshot) -> List BranchSnapshot
  | [] => current
  | next :: rest => pipelineTerminal next rest

def PipelineAligned (current : List BranchSnapshot) : List (List BranchSnapshot) -> Prop
  | [] => True
  | next :: rest => alignedSnapshots current next /\ PipelineAligned next rest

def PipelineZeroVent (current : List BranchSnapshot) : List (List BranchSnapshot) -> Prop
  | [] => True
  | next :: rest => ventedCount current next = 0 /\ PipelineZeroVent next rest

def PipelineZeroDebt (current : List BranchSnapshot) : List (List BranchSnapshot) -> Prop
  | [] => True
  | next :: rest => repairDebt current next = 0 /\ PipelineZeroDebt next rest

def PipelineNoWaste (current : List BranchSnapshot) (stages : List (List BranchSnapshot)) : Prop :=
  PipelineAligned current stages /\ PipelineZeroVent current stages /\ PipelineZeroDebt current stages

def pipelineTotalVented (current : List BranchSnapshot) : List (List BranchSnapshot) -> Nat
  | [] => 0
  | next :: rest => ventedCount current next + pipelineTotalVented next rest

def pipelineTotalRepairDebt (current : List BranchSnapshot) : List (List BranchSnapshot) -> Nat
  | [] => 0
  | next :: rest => repairDebt current next + pipelineTotalRepairDebt next rest

def PipelineHasWasteStage (current : List BranchSnapshot) : List (List BranchSnapshot) -> Prop
  | [] => False
  | next :: rest =>
      0 < ventedCount current next \/ 0 < repairDebt current next \/ PipelineHasWasteStage next rest

theorem live_branch_count_le_after_plus_vented :
    ∀ before after,
      alignedSnapshots before after ->
      liveBranchCount before <= liveBranchCount after + ventedCount before after
  | [], [], _ => by
      simp [liveBranchCount, ventedCount]
  | [], _ :: _, hAligned => by
      cases hAligned
  | _ :: _, [], hAligned => by
      cases hAligned
  | beforeHead :: beforeRest, afterHead :: afterRest, hAligned => by
      have hTailAligned : alignedSnapshots beforeRest afterRest := by
        simpa [alignedSnapshots] using Nat.succ.inj hAligned
      have hTail :=
        live_branch_count_le_after_plus_vented beforeRest afterRest hTailAligned
      by_cases hBeforeSurv : beforeHead.survives = true
      · by_cases hAfterSurv : afterHead.survives = true
        · simp [liveBranchCount, ventedCount, hBeforeSurv, hAfterSurv]
          omega
        · have hAfterFalse : afterHead.survives = false := by
            cases hValue : afterHead.survives <;> simp_all
          simp [liveBranchCount, ventedCount, hBeforeSurv, hAfterFalse]
          omega
      · have hBeforeFalse : beforeHead.survives = false := by
          cases hValue : beforeHead.survives <;> simp_all
        by_cases hAfterSurv : afterHead.survives = true
        · simp [liveBranchCount, ventedCount, hBeforeFalse, hAfterSurv]
          omega
        · have hAfterFalse : afterHead.survives = false := by
            cases hValue : afterHead.survives <;> simp_all
          simp [liveBranchCount, ventedCount, hBeforeFalse, hAfterFalse]
          omega

theorem pipeline_zero_vent_preserves_live_branch_lower_bound :
    ∀ current stages,
      PipelineAligned current stages ->
      PipelineZeroVent current stages ->
      liveBranchCount current <= liveBranchCount (pipelineTerminal current stages)
  | current, [], _, _ => by
      simp [pipelineTerminal]
  | current, next :: rest, hAligned, hZeroVent => by
      rcases hAligned with ⟨hAlignedStep, hAlignedRest⟩
      rcases hZeroVent with ⟨hZeroStep, hZeroVentRest⟩
      have hStepLower :=
        zero_vent_preserves_live_branch_lower_bound current next hAlignedStep hZeroStep
      have hTailLower :=
        pipeline_zero_vent_preserves_live_branch_lower_bound next rest hAlignedRest hZeroVentRest
      exact Nat.le_trans hStepLower hTailLower

theorem pipeline_total_vent_zero_implies_zero_vent :
    ∀ current stages,
      pipelineTotalVented current stages = 0 ->
      PipelineZeroVent current stages
  | current, [], _ => by
      simp [PipelineZeroVent]
  | current, next :: rest, hTotal => by
      have hExpanded : ventedCount current next + pipelineTotalVented next rest = 0 := by
        simpa [pipelineTotalVented] using hTotal
      have hStep : ventedCount current next = 0 := by
        omega
      have hTail : pipelineTotalVented next rest = 0 := by
        omega
      exact ⟨hStep, pipeline_total_vent_zero_implies_zero_vent next rest hTail⟩

theorem pipeline_total_repair_debt_zero_implies_zero_debt :
    ∀ current stages,
      pipelineTotalRepairDebt current stages = 0 ->
      PipelineZeroDebt current stages
  | current, [], _ => by
      simp [PipelineZeroDebt]
  | current, next :: rest, hTotal => by
      have hExpanded : repairDebt current next + pipelineTotalRepairDebt next rest = 0 := by
        simpa [pipelineTotalRepairDebt] using hTotal
      have hStep : repairDebt current next = 0 := by
        omega
      have hTail : pipelineTotalRepairDebt next rest = 0 := by
        omega
      exact ⟨hStep, pipeline_total_repair_debt_zero_implies_zero_debt next rest hTail⟩

theorem pipeline_zero_vent_precludes_single_survivor_collapse
    {start : List BranchSnapshot}
    {stages : List (List BranchSnapshot)}
    (hAligned : PipelineAligned start stages)
    (hForked : 1 < liveBranchCount start)
    (hZeroVent : PipelineZeroVent start stages) :
    ¬ singleSurvivor (pipelineTerminal start stages) := by
  intro hSingle
  have hLower :=
    pipeline_zero_vent_preserves_live_branch_lower_bound start stages hAligned hZeroVent
  unfold singleSurvivor at hSingle
  rw [hSingle] at hLower
  omega

theorem pipeline_no_waste_precludes_deterministic_collapse
    {start : List BranchSnapshot}
    {stages : List (List BranchSnapshot)}
    (hNoWaste : PipelineNoWaste start stages)
    (hForked : 1 < liveBranchCount start) :
    ¬ deterministicCollapse start (pipelineTerminal start stages) := by
  intro hCollapse
  exact
    pipeline_zero_vent_precludes_single_survivor_collapse
      hNoWaste.1 hForked hNoWaste.2.1 hCollapse.2

theorem pipeline_deterministic_collapse_requires_waste
    {start : List BranchSnapshot}
    {stages : List (List BranchSnapshot)}
    (hAligned : PipelineAligned start stages)
    (hForked : 1 < liveBranchCount start)
    (hCollapse : deterministicCollapse start (pipelineTerminal start stages)) :
    0 < pipelineTotalVented start stages \/ 0 < pipelineTotalRepairDebt start stages := by
  by_cases hZeroVent : pipelineTotalVented start stages = 0
  · right
    by_cases hZeroDebt : pipelineTotalRepairDebt start stages = 0
    · have hImpossible :=
        pipeline_no_waste_precludes_deterministic_collapse
          (start := start)
          (stages := stages)
          ⟨ hAligned
          , pipeline_total_vent_zero_implies_zero_vent start stages hZeroVent
          , pipeline_total_repair_debt_zero_implies_zero_debt start stages hZeroDebt
          ⟩
          hForked
      exact False.elim (hImpossible hCollapse)
    · exact Nat.pos_of_ne_zero hZeroDebt
  · left
    exact Nat.pos_of_ne_zero hZeroVent

theorem pipeline_total_vent_positive_implies_waste_stage :
    ∀ current stages,
      0 < pipelineTotalVented current stages ->
      PipelineHasWasteStage current stages
  | current, [], hPositive => by
      have : False := by
        simp [pipelineTotalVented] at hPositive
      exact False.elim this
  | current, next :: rest, hPositive => by
      by_cases hStep : 0 < ventedCount current next
      · exact Or.inl hStep
      · have hStepZero : ventedCount current next = 0 := by
          omega
        have hTailPositive : 0 < pipelineTotalVented next rest := by
          have hExpanded : 0 < ventedCount current next + pipelineTotalVented next rest := by
            simpa [pipelineTotalVented] using hPositive
          rw [hStepZero, zero_add] at hExpanded
          exact hExpanded
        exact Or.inr (Or.inr (pipeline_total_vent_positive_implies_waste_stage next rest hTailPositive))

theorem pipeline_total_repair_debt_positive_implies_waste_stage :
    ∀ current stages,
      0 < pipelineTotalRepairDebt current stages ->
      PipelineHasWasteStage current stages
  | current, [], hPositive => by
      have : False := by
        simp [pipelineTotalRepairDebt] at hPositive
      exact False.elim this
  | current, next :: rest, hPositive => by
      by_cases hStep : 0 < repairDebt current next
      · exact Or.inr (Or.inl hStep)
      · have hStepZero : repairDebt current next = 0 := by
          omega
        have hTailPositive : 0 < pipelineTotalRepairDebt next rest := by
          have hExpanded : 0 < repairDebt current next + pipelineTotalRepairDebt next rest := by
            simpa [pipelineTotalRepairDebt] using hPositive
          rw [hStepZero, zero_add] at hExpanded
          exact hExpanded
        exact Or.inr (Or.inr (pipeline_total_repair_debt_positive_implies_waste_stage next rest hTailPositive))

theorem pipeline_deterministic_collapse_requires_waste_stage
    {start : List BranchSnapshot}
    {stages : List (List BranchSnapshot)}
    (hAligned : PipelineAligned start stages)
    (hForked : 1 < liveBranchCount start)
    (hCollapse : deterministicCollapse start (pipelineTerminal start stages)) :
    PipelineHasWasteStage start stages := by
  have hWaste :=
    pipeline_deterministic_collapse_requires_waste hAligned hForked hCollapse
  rcases hWaste with hVent | hDebt
  · exact pipeline_total_vent_positive_implies_waste_stage start stages hVent
  · exact pipeline_total_repair_debt_positive_implies_waste_stage start stages hDebt

theorem pipeline_vented_covers_live_branch_loss :
    ∀ current stages,
      PipelineAligned current stages ->
      liveBranchCount current <=
        liveBranchCount (pipelineTerminal current stages) + pipelineTotalVented current stages
  | current, [], _ => by
      simp [pipelineTerminal, pipelineTotalVented]
  | current, next :: rest, hAligned => by
      rcases hAligned with ⟨hAlignedStep, hAlignedRest⟩
      have hStep :=
        live_branch_count_le_after_plus_vented current next hAlignedStep
      have hTail :=
        pipeline_vented_covers_live_branch_loss next rest hAlignedRest
      have : liveBranchCount current <=
          liveBranchCount (pipelineTerminal next rest) +
            (ventedCount current next + pipelineTotalVented next rest) := by
        omega
      simpa [pipelineTerminal, pipelineTotalVented, Nat.add_assoc] using this

end ForkRaceFoldTheorems
