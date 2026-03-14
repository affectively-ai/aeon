import ForkRaceFoldTheorems.Axioms

namespace ForkRaceFoldTheorems

section GraphQuotients

variable {α β : Type*} [DecidableEq α] [DecidableEq β]

structure QuotientCollapseWitness (α β : Type*) [DecidableEq α] [DecidableEq β] where
  liveSupport : Finset α
  quotient : α → β
  injectiveOnLive : Set.InjOn quotient (↑liveSupport : Set α)

namespace QuotientCollapseWitness

def fineInitialLive (witness : QuotientCollapseWitness α β) : Nat :=
  witness.liveSupport.card

def coarseSupport (witness : QuotientCollapseWitness α β) : Finset β :=
  witness.liveSupport.image witness.quotient

def coarseInitialLive (witness : QuotientCollapseWitness α β) : Nat :=
  witness.coarseSupport.card

def coarseTotalVented (_witness : QuotientCollapseWitness α β) : Nat := 0

def coarseTerminalLive (witness : QuotientCollapseWitness α β) : Nat :=
  if witness.coarseInitialLive = 0 then 0 else 1

def coarseTotalRepairDebt (witness : QuotientCollapseWitness α β) : Nat :=
  witness.coarseInitialLive - 1

def fineContagious (witness : QuotientCollapseWitness α β) : Prop :=
  1 < witness.fineInitialLive

def coarseDeterministicCollapse (witness : QuotientCollapseWitness α β) : Prop :=
  0 < witness.coarseInitialLive

theorem coarseInitialLive_eq_fineInitialLive
    (witness : QuotientCollapseWitness α β) :
    witness.coarseInitialLive = witness.fineInitialLive := by
  unfold coarseInitialLive coarseSupport fineInitialLive
  exact Finset.card_image_of_injOn witness.injectiveOnLive

theorem supportPreservingQuotient
    (witness : QuotientCollapseWitness α β) :
    1 < witness.fineInitialLive ->
    1 < witness.coarseInitialLive := by
  intro hFineForked
  simpa [witness.coarseInitialLive_eq_fineInitialLive] using hFineForked

theorem coarseDeterministicCollapse_holds
    (witness : QuotientCollapseWitness α β)
    (hFineForked : 1 < witness.fineInitialLive) :
    witness.coarseDeterministicCollapse := by
  unfold coarseDeterministicCollapse
  have hCoarseForked := witness.supportPreservingQuotient hFineForked
  omega

theorem coarseTerminalLive_eq_one_of_collapse
    (witness : QuotientCollapseWitness α β)
    (hCollapse : witness.coarseDeterministicCollapse) :
    witness.coarseTerminalLive = 1 := by
  unfold coarseDeterministicCollapse coarseTerminalLive at *
  split_ifs with hZero
  · omega
  · rfl

theorem zero_vent_deterministic_collapse_requires_repair
    (witness : QuotientCollapseWitness α β)
    (hFineForked : 1 < witness.fineInitialLive) :
    0 < witness.coarseTotalRepairDebt := by
  unfold coarseTotalRepairDebt
  have hCoarseForked := witness.supportPreservingQuotient hFineForked
  omega

def toInterferenceCoarseningAssumptions
    (witness : QuotientCollapseWitness α β) :
    InterferenceCoarseningAssumptions where
  fineInitialLive := witness.fineInitialLive
  coarseInitialLive := witness.coarseInitialLive
  coarseTerminalLive := witness.coarseTerminalLive
  coarseTotalVented := witness.coarseTotalVented
  coarseTotalRepairDebt := witness.coarseTotalRepairDebt
  fineContagious := witness.fineContagious
  coarseDeterministicCollapse := witness.coarseDeterministicCollapse
  supportPreservingQuotient := witness.supportPreservingQuotient
  survivorFaithfulQuotient := witness.coarseTerminalLive_eq_one_of_collapse
  contagionReflectingQuotient := by
    intro _ hContagious _
    left
    simpa [QuotientCollapseWitness.fineContagious] using
      witness.zero_vent_deterministic_collapse_requires_repair hContagious

theorem interference_boundary_from_graph_quotient
    (witness : QuotientCollapseWitness α β) :
    witness.fineContagious ->
    witness.coarseDeterministicCollapse ->
    0 < witness.coarseTotalRepairDebt := by
  intro hContagious _
  simpa [QuotientCollapseWitness.fineContagious] using
    witness.zero_vent_deterministic_collapse_requires_repair hContagious

theorem interference_schema_instantiated
    (witness : QuotientCollapseWitness α β) :
    witness.fineContagious ->
    witness.coarseDeterministicCollapse ->
    0 < witness.coarseTotalVented \/ 0 < witness.coarseTotalRepairDebt := by
  intro hContagious hCollapse
  right
  exact witness.interference_boundary_from_graph_quotient hContagious hCollapse

end QuotientCollapseWitness

def appStageLiveSupport : Finset (Nat × Bool) :=
  {(0, false), (1, true), (2, false)}

def appStageQuotient : (Nat × Bool) → Nat := Prod.fst

def appStageCollapseWitness : QuotientCollapseWitness (Nat × Bool) Nat where
  liveSupport := appStageLiveSupport
  quotient := appStageQuotient
  injectiveOnLive := by
    intro a ha b hb hEq
    have ha' : a = (0, false) ∨ a = (1, true) ∨ a = (2, false) := by
      simpa [appStageLiveSupport] using ha
    have hb' : b = (0, false) ∨ b = (1, true) ∨ b = (2, false) := by
      simpa [appStageLiveSupport] using hb
    rcases ha' with rfl | ha'
    · rcases hb' with rfl | hb'
      · rfl
      · rcases hb' with rfl | rfl
        · simp [appStageQuotient] at hEq
        · simp [appStageQuotient] at hEq
    · rcases ha' with rfl | rfl
      · rcases hb' with rfl | hb'
        · simp [appStageQuotient] at hEq
        · rcases hb' with rfl | rfl
          · rfl
          · simp [appStageQuotient] at hEq
      · rcases hb' with rfl | hb'
        · simp [appStageQuotient] at hEq
        · rcases hb' with rfl | rfl
          · simp [appStageQuotient] at hEq
          · rfl

theorem app_stage_fine_contagious :
    QuotientCollapseWitness.fineContagious appStageCollapseWitness := by
  unfold QuotientCollapseWitness.fineContagious QuotientCollapseWitness.fineInitialLive
  simp [appStageCollapseWitness, appStageLiveSupport]

theorem app_stage_zero_vent_requires_repair :
    0 < QuotientCollapseWitness.coarseTotalRepairDebt appStageCollapseWitness := by
  exact QuotientCollapseWitness.zero_vent_deterministic_collapse_requires_repair appStageCollapseWitness
    app_stage_fine_contagious

theorem app_stage_schema_instantiated :
    0 < QuotientCollapseWitness.coarseTotalVented appStageCollapseWitness \/
      0 < QuotientCollapseWitness.coarseTotalRepairDebt appStageCollapseWitness := by
  exact QuotientCollapseWitness.interference_schema_instantiated appStageCollapseWitness
    app_stage_fine_contagious
    (QuotientCollapseWitness.coarseDeterministicCollapse_holds appStageCollapseWitness
      app_stage_fine_contagious)

end GraphQuotients

end ForkRaceFoldTheorems
