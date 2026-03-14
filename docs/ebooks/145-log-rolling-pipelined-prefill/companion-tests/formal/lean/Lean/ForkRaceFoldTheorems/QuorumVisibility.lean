import Mathlib
import ForkRaceFoldTheorems.FailureDurability

namespace ForkRaceFoldTheorems

def readValue (quorum : Finset Nat) (storedVersion : Nat -> Nat) : Nat :=
  quorum.sup storedVersion

theorem le_readValue_of_mem
    {quorum : Finset Nat}
    {storedVersion : Nat -> Nat}
    {replica : Nat}
    (hReplica : replica ∈ quorum) :
    storedVersion replica ≤ readValue quorum storedVersion := by
  unfold readValue
  exact Finset.le_sup hReplica

theorem strict_majority_failure_budget_lt_quorum
    {replicaCount failureBudget : Nat}
    (hMajority : 2 * failureBudget < replicaCount) :
    failureBudget < quorumSize replicaCount failureBudget := by
  unfold quorumSize
  omega

theorem write_read_quorums_intersect
    {replicaCount failureBudget : Nat}
    {writeQuorum readQuorum : Finset Nat}
    (hMajority : 2 * failureBudget < replicaCount)
    (hWriteSubset : writeQuorum ⊆ Finset.range replicaCount)
    (hReadSubset : readQuorum ⊆ Finset.range replicaCount)
    (hWriteCard : writeQuorum.card = quorumSize replicaCount failureBudget)
    (hReadCard : readQuorum.card = quorumSize replicaCount failureBudget) :
    (writeQuorum ∩ readQuorum).Nonempty := by
  by_contra hEmpty
  have hInterEmpty : writeQuorum ∩ readQuorum = ∅ :=
    Finset.not_nonempty_iff_eq_empty.mp hEmpty
  have hUnionSubset : writeQuorum ∪ readQuorum ⊆ Finset.range replicaCount := by
    intro replica hReplica
    rcases Finset.mem_union.mp hReplica with hWrite | hRead
    · exact hWriteSubset hWrite
    · exact hReadSubset hRead
  have hUnionEq : (writeQuorum ∪ readQuorum).card = writeQuorum.card + readQuorum.card := by
    have hCard := Finset.card_union_add_card_inter writeQuorum readQuorum
    rw [hInterEmpty, Finset.card_empty, add_zero] at hCard
    exact hCard
  have hUnionBound : (writeQuorum ∪ readQuorum).card ≤ replicaCount := by
    simpa using Finset.card_le_card hUnionSubset
  rw [hWriteCard, hReadCard] at hUnionEq
  unfold quorumSize at hUnionEq
  omega

theorem read_after_ack_visible
    {replicaCount failureBudget ackedVersion : Nat}
    {writeQuorum readQuorum : Finset Nat}
    {storedVersion : Nat -> Nat}
    (hMajority : 2 * failureBudget < replicaCount)
    (hWriteSubset : writeQuorum ⊆ Finset.range replicaCount)
    (hReadSubset : readQuorum ⊆ Finset.range replicaCount)
    (hWriteCard : writeQuorum.card = quorumSize replicaCount failureBudget)
    (hReadCard : readQuorum.card = quorumSize replicaCount failureBudget)
    (hAckedStored : ∀ replica ∈ writeQuorum, ackedVersion ≤ storedVersion replica) :
    ackedVersion ≤ readValue readQuorum storedVersion := by
  have hInter :=
    write_read_quorums_intersect
      hMajority
      hWriteSubset
      hReadSubset
      hWriteCard
      hReadCard
  rcases hInter with ⟨replica, hReplica⟩
  have hWrite : replica ∈ writeQuorum := (Finset.mem_inter.mp hReplica).1
  have hRead : replica ∈ readQuorum := (Finset.mem_inter.mp hReplica).2
  exact le_trans (hAckedStored replica hWrite) (le_readValue_of_mem hRead)

def weakBoundaryWriteQuorum : Finset Nat := {0, 1}
def weakBoundaryReadQuorum : Finset Nat := {2, 3}

def weakBoundaryStoredVersion (replica : Nat) : Nat :=
  if replica ∈ weakBoundaryWriteQuorum then 1 else 0

theorem weak_quorum_boundary_not_strict_majority :
    ¬ (2 * 2 < 4) := by
  omega

theorem weak_quorum_boundary_disjoint :
    weakBoundaryWriteQuorum ∩ weakBoundaryReadQuorum = ∅ := by
  decide

theorem weak_quorum_boundary_read_misses_acked_write :
    readValue weakBoundaryReadQuorum weakBoundaryStoredVersion = 0 := by
  native_decide

def contagiousBoundaryWriteQuorum : Finset Nat := {0, 1}
def contagiousBoundaryReadQuorum : Finset Nat := {1, 2}

def contagiousBoundaryStoredVersion : Nat -> Nat
  | 0 => 1
  | _ => 0

theorem contagious_boundary_quorums_still_intersect :
    (contagiousBoundaryWriteQuorum ∩ contagiousBoundaryReadQuorum).Nonempty := by
  decide

theorem contagious_boundary_read_still_misses_acked_write :
    readValue contagiousBoundaryReadQuorum contagiousBoundaryStoredVersion = 0 := by
  native_decide

def unfairRepairBoundaryState : DurableReplicaState :=
  { liveCount := 2, repairDebt := 1, failuresRemaining := 0 }

theorem unfair_repair_boundary_well_formed :
    DurableWellFormed 3 1 unfairRepairBoundaryState := by
  unfold DurableWellFormed unfairRepairBoundaryState
  decide

theorem unfair_repair_boundary_not_stable :
    ¬ StableReplicaState 3 unfairRepairBoundaryState := by
  unfold StableReplicaState unfairRepairBoundaryState
  decide

theorem unfair_repair_boundary_stutter_keeps_state :
    unfairRepairBoundaryState = unfairRepairBoundaryState := by
  rfl

theorem unfair_repair_boundary_repair_closure_is_stable :
    StableReplicaState 3 (repairClosure unfairRepairBoundaryState) := by
  apply repair_closure_stable_of_exhausted_failures
  · exact unfair_repair_boundary_well_formed
  · rfl

end ForkRaceFoldTheorems
