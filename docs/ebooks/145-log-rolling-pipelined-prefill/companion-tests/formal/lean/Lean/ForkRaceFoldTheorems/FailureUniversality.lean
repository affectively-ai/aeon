import ForkRaceFoldTheorems.FailureComposition

namespace ForkRaceFoldTheorems

structure SparseBranchSnapshot where
  branchId : Nat
  survives : Bool
  output : List Nat
deriving DecidableEq, Repr

def deadBranchSnapshot : BranchSnapshot :=
  { survives := false, output := [] }

def branchSnapshotOfSparse (entry : SparseBranchSnapshot) : BranchSnapshot :=
  { survives := entry.survives, output := entry.output }

def lookupSparseStage : List SparseBranchSnapshot -> Nat -> BranchSnapshot
  | [], _ => deadBranchSnapshot
  | entry :: rest, branchId =>
      if entry.branchId = branchId then
        branchSnapshotOfSparse entry
      else
        lookupSparseStage rest branchId

def sparseStageSupport (stage : List SparseBranchSnapshot) : List Nat :=
  stage.map SparseBranchSnapshot.branchId

def sparseStagesSupport : List (List SparseBranchSnapshot) -> List Nat
  | [] => []
  | stage :: rest => sparseStageSupport stage ++ sparseStagesSupport rest

def sparseSystemSupport
    (start : List SparseBranchSnapshot)
    (stages : List (List SparseBranchSnapshot)) : List Nat :=
  ((sparseStageSupport start) ++ sparseStagesSupport stages).eraseDups

def normalizeSparseStage
    (support : List Nat)
    (stage : List SparseBranchSnapshot) : List BranchSnapshot :=
  support.map (lookupSparseStage stage)

def normalizeSparseStages
    (support : List Nat)
    (stages : List (List SparseBranchSnapshot)) : List (List BranchSnapshot) :=
  stages.map (normalizeSparseStage support)

theorem normalized_sparse_pipeline_aligned :
    ∀ support current stages,
      PipelineAligned (normalizeSparseStage support current) (normalizeSparseStages support stages)
  | support, current, [] => by
      simp [normalizeSparseStages, PipelineAligned]
  | support, current, next :: rest => by
      simp [normalizeSparseStages, PipelineAligned, alignedSnapshots, normalizeSparseStage]
      exact normalized_sparse_pipeline_aligned support next rest

def collapseRemainder : List BranchSnapshot -> List BranchSnapshot
  | [] => []
  | branch :: rest =>
      { survives := false, output := branch.output } :: collapseRemainder rest

def collapseWitness : List BranchSnapshot -> List BranchSnapshot
  | [] => []
  | branch :: rest =>
      if branch.survives then
        { survives := true, output := branch.output } :: collapseRemainder rest
      else
        { survives := false, output := branch.output } :: collapseWitness rest

theorem collapseRemainder_branch_isolating :
    ∀ before, BranchIsolating before (collapseRemainder before)
  | [] => by
      simp [collapseRemainder, BranchIsolating]
  | _ :: rest => by
      refine ⟨collapseRemainder_branch_isolating rest, ?_⟩
      intro hAfterSurvives
      cases hAfterSurvives

theorem collapseWitness_branch_isolating :
    ∀ before, BranchIsolating before (collapseWitness before)
  | [] => by
      simp [collapseWitness, BranchIsolating]
  | branch :: rest => by
      by_cases hSurv : branch.survives = true
      · simp [collapseWitness, hSurv, BranchIsolating, collapseRemainder_branch_isolating]
      · simp [collapseWitness, hSurv, BranchIsolating, collapseWitness_branch_isolating]

theorem collapseRemainder_aligned :
    ∀ before, alignedSnapshots before (collapseRemainder before)
  | [] => by
      simp [alignedSnapshots, collapseRemainder]
  | _ :: rest => by
      simpa [alignedSnapshots, collapseRemainder] using collapseRemainder_aligned rest

theorem collapseWitness_aligned :
    ∀ before, alignedSnapshots before (collapseWitness before)
  | [] => by
      simp [alignedSnapshots, collapseWitness]
  | branch :: rest => by
      by_cases hSurv : branch.survives = true
      · simpa [alignedSnapshots, collapseWitness, hSurv] using
          congrArg Nat.succ (collapseRemainder_aligned rest)
      · simpa [alignedSnapshots, collapseWitness, hSurv] using collapseWitness_aligned rest

theorem collapseRemainder_live_branch_count :
    ∀ before, liveBranchCount (collapseRemainder before) = 0
  | [] => by
      simp [collapseRemainder, liveBranchCount]
  | _ :: rest => by
      simpa [collapseRemainder, liveBranchCount] using collapseRemainder_live_branch_count rest

theorem collapseWitness_live_branch_count :
    ∀ before, liveBranchCount (collapseWitness before) = min 1 (liveBranchCount before)
  | [] => by
      simp [collapseWitness, liveBranchCount]
  | branch :: rest => by
      by_cases hSurv : branch.survives = true
      · have hMin :
          min 1 ((if branch.survives then 1 else 0) + liveBranchCount rest) = 1 := by
          have hLe :
              1 <= (if branch.survives then 1 else 0) + liveBranchCount rest := by
            rw [hSurv]
            simp
          exact Nat.min_eq_left hLe
        simp [collapseWitness, hSurv, liveBranchCount, collapseRemainder_live_branch_count]
      · simpa [collapseWitness, hSurv, liveBranchCount] using collapseWitness_live_branch_count rest

theorem collapseRemainder_vented_count :
    ∀ before, ventedCount before (collapseRemainder before) = liveBranchCount before
  | [] => by
      simp [collapseRemainder, ventedCount, liveBranchCount]
  | branch :: rest => by
      by_cases hSurv : branch.survives = true
      · simp [collapseRemainder, ventedCount, liveBranchCount, hSurv, collapseRemainder_vented_count]
      · simp [collapseRemainder, ventedCount, liveBranchCount, hSurv, collapseRemainder_vented_count]

theorem collapseWitness_live_plus_vented :
    ∀ before,
      liveBranchCount before =
        liveBranchCount (collapseWitness before) + ventedCount before (collapseWitness before)
  | [] => by
      simp [collapseWitness, liveBranchCount, ventedCount]
  | branch :: rest => by
      by_cases hSurv : branch.survives = true
      · simp
          [ collapseWitness
          , hSurv
          , liveBranchCount
          , ventedCount
          , collapseRemainder_live_branch_count
          , collapseRemainder_vented_count
          ]
      · simpa [collapseWitness, hSurv, liveBranchCount, ventedCount] using
          collapseWitness_live_plus_vented rest

theorem collapseWitness_single_survivor
    {before : List BranchSnapshot}
    (hHasLive : 0 < liveBranchCount before) :
    singleSurvivor (collapseWitness before) := by
  unfold singleSurvivor
  rw [collapseWitness_live_branch_count]
  exact Nat.min_eq_left (Nat.succ_le_of_lt hHasLive)

theorem collapseWitness_deterministic_collapse
    {before : List BranchSnapshot}
    (hHasLive : 0 < liveBranchCount before) :
    deterministicCollapse before (collapseWitness before) := by
  refine ⟨?_, collapseWitness_single_survivor hHasLive⟩
  exact
    branch_isolating_preserves_deterministic_fold
      before
      (collapseWitness before)
      (collapseWitness_branch_isolating before)

theorem collapseWitness_zero_repair_debt
    (before : List BranchSnapshot) :
    repairDebt before (collapseWitness before) = 0 := by
  exact
    branch_isolating_has_zero_repair_debt
      before
      (collapseWitness before)
      (collapseWitness_branch_isolating before)

theorem collapseWitness_vented_cost_exact
    {before : List BranchSnapshot}
    (hHasLive : 0 < liveBranchCount before) :
    ventedCount before (collapseWitness before) = liveBranchCount before - 1 := by
  have hDecomp := collapseWitness_live_plus_vented before
  have hSingle : liveBranchCount (collapseWitness before) = 1 := by
    simpa [singleSurvivor] using collapseWitness_single_survivor hHasLive
  rw [hSingle] at hDecomp
  omega

theorem collapseWitness_total_cost_exact
    {before : List BranchSnapshot}
    (hHasLive : 0 < liveBranchCount before) :
    ventedCount before (collapseWitness before) + repairDebt before (collapseWitness before) =
      liveBranchCount before - 1 := by
  rw [collapseWitness_vented_cost_exact hHasLive, collapseWitness_zero_repair_debt before]
  simp

def CollapseCostAchievableFrom (start : List BranchSnapshot) (cost : Nat) : Prop :=
  ∃ stages,
    PipelineAligned start stages /\
      deterministicCollapse start (pipelineTerminal start stages) /\
      pipelineTotalVented start stages + pipelineTotalRepairDebt start stages = cost

theorem collapse_cost_floor_attainable
    (start : List BranchSnapshot)
    (hHasLive : 0 < liveBranchCount start) :
    CollapseCostAchievableFrom start (liveBranchCount start - 1) := by
  refine ⟨[collapseWitness start], ?_, ?_, ?_⟩
  · simp [PipelineAligned, collapseWitness_aligned]
  · simpa [pipelineTerminal] using collapseWitness_deterministic_collapse hHasLive
  · simpa [pipelineTotalVented, pipelineTotalRepairDebt, collapseWitness_zero_repair_debt] using
      collapseWitness_total_cost_exact hHasLive

theorem collapse_cost_achievable_lower_bound
    {start : List BranchSnapshot}
    {cost : Nat}
    (hAchievable : CollapseCostAchievableFrom start cost) :
    liveBranchCount start - 1 <= cost := by
  rcases hAchievable with ⟨stages, hAligned, hCollapse, hCost⟩
  have hCovered :=
    pipeline_vented_covers_live_branch_loss start stages hAligned
  have hVentedLower :
      liveBranchCount start - 1 <= pipelineTotalVented start stages := by
    unfold deterministicCollapse at hCollapse
    unfold singleSurvivor at hCollapse
    rw [hCollapse.2] at hCovered
    omega
  have hCostLower :
      liveBranchCount start - 1 <=
        pipelineTotalVented start stages + pipelineTotalRepairDebt start stages := by
    omega
  simpa [hCost] using hCostLower

theorem collapse_cost_floor_exact
    (start : List BranchSnapshot)
    (hHasLive : 0 < liveBranchCount start) :
    (∀ cost, CollapseCostAchievableFrom start cost -> liveBranchCount start - 1 <= cost) /\
      CollapseCostAchievableFrom start (liveBranchCount start - 1) := by
  refine ⟨?_, collapse_cost_floor_attainable start hHasLive⟩
  intro cost hAchievable
  exact collapse_cost_achievable_lower_bound hAchievable

structure ChoiceSystem where
  initial : List SparseBranchSnapshot
  recovery : List (List SparseBranchSnapshot)
deriving Repr

def ChoiceSystem.support (system : ChoiceSystem) : List Nat :=
  sparseSystemSupport system.initial system.recovery

def ChoiceSystem.normalizedInitial (system : ChoiceSystem) : List BranchSnapshot :=
  normalizeSparseStage system.support system.initial

def ChoiceSystem.normalizedRecovery (system : ChoiceSystem) : List (List BranchSnapshot) :=
  normalizeSparseStages system.support system.recovery

def ChoiceSystem.normalizedTerminal (system : ChoiceSystem) : List BranchSnapshot :=
  pipelineTerminal system.normalizedInitial system.normalizedRecovery

def ChoiceSystem.totalVented (system : ChoiceSystem) : Nat :=
  pipelineTotalVented system.normalizedInitial system.normalizedRecovery

def ChoiceSystem.totalRepairDebt (system : ChoiceSystem) : Nat :=
  pipelineTotalRepairDebt system.normalizedInitial system.normalizedRecovery

def ChoiceSystem.totalCost (system : ChoiceSystem) : Nat :=
  system.totalVented + system.totalRepairDebt

def ChoiceSystem.globalZeroWaste (system : ChoiceSystem) : Prop :=
  system.totalVented = 0 /\ system.totalRepairDebt = 0

def ChoiceSystem.hasPaidStage (system : ChoiceSystem) : Prop :=
  PipelineHasWasteStage system.normalizedInitial system.normalizedRecovery

theorem ChoiceSystem.normalized_pipeline_aligned (system : ChoiceSystem) :
    PipelineAligned system.normalizedInitial system.normalizedRecovery := by
  simpa [ChoiceSystem.normalizedInitial, ChoiceSystem.normalizedRecovery, ChoiceSystem.support] using
    normalized_sparse_pipeline_aligned system.support system.initial system.recovery

theorem ChoiceSystem.no_free_global_collapse
    (system : ChoiceSystem)
    (hForked : 1 < liveBranchCount system.normalizedInitial)
    (hZeroWaste : system.globalZeroWaste) :
    ¬ deterministicCollapse system.normalizedInitial system.normalizedTerminal := by
  exact
    pipeline_no_waste_precludes_deterministic_collapse
      (start := system.normalizedInitial)
      (stages := system.normalizedRecovery)
      ⟨ system.normalized_pipeline_aligned
      , pipeline_total_vent_zero_implies_zero_vent
          system.normalizedInitial
          system.normalizedRecovery
          hZeroWaste.1
      , pipeline_total_repair_debt_zero_implies_zero_debt
          system.normalizedInitial
          system.normalizedRecovery
          hZeroWaste.2
      ⟩
      hForked

theorem ChoiceSystem.deterministic_collapse_requires_waste
    (system : ChoiceSystem)
    (hForked : 1 < liveBranchCount system.normalizedInitial)
    (hCollapse : deterministicCollapse system.normalizedInitial system.normalizedTerminal) :
    0 < system.totalVented \/ 0 < system.totalRepairDebt := by
  exact
    pipeline_deterministic_collapse_requires_waste
      (start := system.normalizedInitial)
      (stages := system.normalizedRecovery)
      system.normalized_pipeline_aligned
      hForked
      hCollapse

theorem ChoiceSystem.deterministic_collapse_requires_paid_stage
    (system : ChoiceSystem)
    (hForked : 1 < liveBranchCount system.normalizedInitial)
    (hCollapse : deterministicCollapse system.normalizedInitial system.normalizedTerminal) :
    system.hasPaidStage := by
  exact
    pipeline_deterministic_collapse_requires_waste_stage
      (start := system.normalizedInitial)
      (stages := system.normalizedRecovery)
      system.normalized_pipeline_aligned
      hForked
      hCollapse

theorem ChoiceSystem.deterministic_collapse_vented_lower_bound
    (system : ChoiceSystem)
    (hCollapse : deterministicCollapse system.normalizedInitial system.normalizedTerminal) :
    liveBranchCount system.normalizedInitial - 1 <= system.totalVented := by
  have hCovered :=
    pipeline_vented_covers_live_branch_loss
      system.normalizedInitial
      system.normalizedRecovery
      system.normalized_pipeline_aligned
  have hCovered' :
      liveBranchCount system.normalizedInitial <=
        liveBranchCount system.normalizedTerminal + system.totalVented := by
    simpa [ChoiceSystem.normalizedTerminal, ChoiceSystem.totalVented] using hCovered
  unfold deterministicCollapse at hCollapse
  unfold singleSurvivor at hCollapse
  rw [hCollapse.2] at hCovered'
  omega

theorem ChoiceSystem.deterministic_collapse_cost_lower_bound
    (system : ChoiceSystem)
    (hCollapse : deterministicCollapse system.normalizedInitial system.normalizedTerminal) :
    liveBranchCount system.normalizedInitial - 1 <= system.totalCost := by
  have hVentedLower :=
    system.deterministic_collapse_vented_lower_bound hCollapse
  unfold ChoiceSystem.totalCost
  omega

theorem ChoiceSystem.exact_collapse_cost_floor
    (system : ChoiceSystem)
    (hHasLive : 0 < liveBranchCount system.normalizedInitial) :
    (∀ cost,
        CollapseCostAchievableFrom system.normalizedInitial cost ->
          liveBranchCount system.normalizedInitial - 1 <= cost) /\
      CollapseCostAchievableFrom
        system.normalizedInitial
        (liveBranchCount system.normalizedInitial - 1) := by
  exact collapse_cost_floor_exact system.normalizedInitial hHasLive

theorem ChoiceSystem.trilemma
    (system : ChoiceSystem)
    (hForked : 1 < liveBranchCount system.normalizedInitial) :
    ¬ (deterministicCollapse system.normalizedInitial system.normalizedTerminal /\
        system.totalVented = 0 /\
        system.totalRepairDebt = 0) := by
  intro h
  exact
    system.no_free_global_collapse
      hForked
      ⟨h.2.1, h.2.2⟩
      h.1

structure ChoiceTrajectory where
  initial : List SparseBranchSnapshot
  recovery : Nat -> List SparseBranchSnapshot

def ChoiceTrajectory.prefixStages
    (trajectory : ChoiceTrajectory)
    (depth : Nat) : List (List SparseBranchSnapshot) :=
  List.ofFn (fun index : Fin depth => trajectory.recovery index.1)

def ChoiceTrajectory.prefixSystem
    (trajectory : ChoiceTrajectory)
    (depth : Nat) : ChoiceSystem :=
  { initial := trajectory.initial, recovery := trajectory.prefixStages depth }

theorem ChoiceTrajectory.collapse_at_depth_requires_waste
    (trajectory : ChoiceTrajectory)
    (depth : Nat)
    (hForked : 1 < liveBranchCount (trajectory.prefixSystem depth).normalizedInitial)
    (hCollapse :
      deterministicCollapse
        (trajectory.prefixSystem depth).normalizedInitial
        (trajectory.prefixSystem depth).normalizedTerminal) :
    0 < (trajectory.prefixSystem depth).totalVented \/
      0 < (trajectory.prefixSystem depth).totalRepairDebt := by
  exact
    (trajectory.prefixSystem depth).deterministic_collapse_requires_waste
      hForked
      hCollapse

theorem ChoiceTrajectory.collapse_at_depth_requires_paid_stage
    (trajectory : ChoiceTrajectory)
    (depth : Nat)
    (hForked : 1 < liveBranchCount (trajectory.prefixSystem depth).normalizedInitial)
    (hCollapse :
      deterministicCollapse
        (trajectory.prefixSystem depth).normalizedInitial
        (trajectory.prefixSystem depth).normalizedTerminal) :
    (trajectory.prefixSystem depth).hasPaidStage := by
  exact
    (trajectory.prefixSystem depth).deterministic_collapse_requires_paid_stage
      hForked
      hCollapse

theorem ChoiceTrajectory.collapse_at_depth_vented_lower_bound
    (trajectory : ChoiceTrajectory)
    (depth : Nat)
    (hCollapse :
      deterministicCollapse
        (trajectory.prefixSystem depth).normalizedInitial
        (trajectory.prefixSystem depth).normalizedTerminal) :
    liveBranchCount (trajectory.prefixSystem depth).normalizedInitial - 1 <=
      (trajectory.prefixSystem depth).totalVented := by
  exact
    (trajectory.prefixSystem depth).deterministic_collapse_vented_lower_bound
      hCollapse

theorem ChoiceTrajectory.collapse_at_depth_cost_lower_bound
    (trajectory : ChoiceTrajectory)
    (depth : Nat)
    (hCollapse :
      deterministicCollapse
        (trajectory.prefixSystem depth).normalizedInitial
        (trajectory.prefixSystem depth).normalizedTerminal) :
    liveBranchCount (trajectory.prefixSystem depth).normalizedInitial - 1 <=
      (trajectory.prefixSystem depth).totalCost := by
  exact
    (trajectory.prefixSystem depth).deterministic_collapse_cost_lower_bound
      hCollapse

theorem ChoiceTrajectory.no_depth_beats_fork_cost_floor
    (trajectory : ChoiceTrajectory)
    (depth : Nat)
    (hCollapse :
      deterministicCollapse
        (trajectory.prefixSystem depth).normalizedInitial
        (trajectory.prefixSystem depth).normalizedTerminal) :
    ¬ ((trajectory.prefixSystem depth).totalCost <
        liveBranchCount (trajectory.prefixSystem depth).normalizedInitial - 1) := by
  have hLower :=
    trajectory.collapse_at_depth_cost_lower_bound depth hCollapse
  omega

theorem ChoiceTrajectory.prefix_exact_collapse_cost_floor
    (trajectory : ChoiceTrajectory)
    (depth : Nat)
    (hHasLive : 0 < liveBranchCount (trajectory.prefixSystem depth).normalizedInitial) :
    (∀ cost,
        CollapseCostAchievableFrom (trajectory.prefixSystem depth).normalizedInitial cost ->
          liveBranchCount (trajectory.prefixSystem depth).normalizedInitial - 1 <= cost) /\
      CollapseCostAchievableFrom
        (trajectory.prefixSystem depth).normalizedInitial
        (liveBranchCount (trajectory.prefixSystem depth).normalizedInitial - 1) := by
  exact collapse_cost_floor_exact (trajectory.prefixSystem depth).normalizedInitial hHasLive

theorem ChoiceTrajectory.no_depth_realizes_free_deterministic_collapse
    (trajectory : ChoiceTrajectory)
    (depth : Nat)
    (hForked : 1 < liveBranchCount (trajectory.prefixSystem depth).normalizedInitial) :
    ¬ (deterministicCollapse
          (trajectory.prefixSystem depth).normalizedInitial
          (trajectory.prefixSystem depth).normalizedTerminal /\
        (trajectory.prefixSystem depth).totalVented = 0 /\
        (trajectory.prefixSystem depth).totalRepairDebt = 0) := by
  exact
    (trajectory.prefixSystem depth).trilemma
      hForked

end ForkRaceFoldTheorems
