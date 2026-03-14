import Mathlib
import ForkRaceFoldTheorems.QuorumConsistency

namespace ForkRaceFoldTheorems

theorem minority_connected_set_cannot_host_quorum
    {replicaCount failureBudget : Nat}
    {connected : Finset Nat}
    (hConnectedCard : connected.card < quorumSize replicaCount failureBudget) :
    ¬ ∃ q : Finset Nat, q ⊆ connected ∧ q.card = quorumSize replicaCount failureBudget := by
  intro hQuorum
  rcases hQuorum with ⟨q, hSubset, hCard⟩
  have hLe : q.card <= connected.card := Finset.card_le_card hSubset
  rw [hCard] at hLe
  omega

theorem connected_quorum_read_exact_of_coverage
    {quorum : Finset Nat}
    {storedVersion : Nat -> Nat}
    {ackedVersion : Nat}
    (hAckMember : ∃ replica ∈ quorum, ackedVersion ≤ storedVersion replica)
    (hNoReplicaAhead : ∀ replica ∈ quorum, storedVersion replica ≤ ackedVersion) :
    readValue quorum storedVersion = ackedVersion := by
  exact committed_read_exact_of_coverage hAckMember hNoReplicaAhead

def minoritySplitReadSet : Finset Nat := {0, 1}

def minoritySplitStoredVersion (replica : Nat) : Nat :=
  if replica ∈ minoritySplitReadSet then 1 else 2

def minoritySplitAckedVersion : Nat := 2

theorem minority_split_read_set_not_quorum :
    minoritySplitReadSet.card < quorumSize 5 2 := by
  native_decide

theorem minority_split_read_stale_if_weak_reads_are_allowed :
    readValue minoritySplitReadSet minoritySplitStoredVersion = 1 := by
  native_decide

theorem minority_split_read_below_acked_if_weak_reads_are_allowed :
    readValue minoritySplitReadSet minoritySplitStoredVersion < minoritySplitAckedVersion := by
  native_decide

def noRepairSafeQuorum : Finset Nat := {0, 1, 2}

def noRepairStoredVersion : Nat -> Nat
  | 4 => 1
  | _ => 2

theorem no_repair_boundary_safe_quorum_still_reads_acked :
    readValue noRepairSafeQuorum noRepairStoredVersion = 2 := by
  native_decide

theorem no_repair_boundary_stale_replica_persists :
    noRepairStoredVersion 4 < 2 := by
  native_decide

end ForkRaceFoldTheorems
