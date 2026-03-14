import Mathlib

namespace ForkRaceFoldTheorems

structure DurableReplicaState where
  liveCount : Nat
  repairDebt : Nat
  failuresRemaining : Nat
deriving DecidableEq, Repr

def quorumSize (replicaCount failureBudget : Nat) : Nat :=
  replicaCount - failureBudget

def DurableWellFormed
    (replicaCount failureBudget : Nat)
    (state : DurableReplicaState) : Prop :=
  state.liveCount + state.repairDebt = replicaCount /\
    state.repairDebt <= failureBudget /\
    state.failuresRemaining <= failureBudget

def StableReplicaState (replicaCount : Nat) (state : DurableReplicaState) : Prop :=
  state.liveCount = replicaCount /\ state.repairDebt = 0 /\ state.failuresRemaining = 0

def repairClosure (state : DurableReplicaState) : DurableReplicaState :=
  { liveCount := state.liveCount + state.repairDebt
    repairDebt := 0
    failuresRemaining := state.failuresRemaining }

theorem durable_live_count_ge_quorum
    {replicaCount failureBudget : Nat}
    {state : DurableReplicaState}
    (hWellFormed : DurableWellFormed replicaCount failureBudget state) :
    quorumSize replicaCount failureBudget <= state.liveCount := by
  rcases hWellFormed with ⟨hMass, hDebtBound, _⟩
  unfold quorumSize
  omega

theorem durable_live_count_positive
    {replicaCount failureBudget : Nat}
    {state : DurableReplicaState}
    (hBudget : failureBudget < replicaCount)
    (hWellFormed : DurableWellFormed replicaCount failureBudget state) :
    0 < state.liveCount := by
  have hQuorum :
      quorumSize replicaCount failureBudget <= state.liveCount :=
    durable_live_count_ge_quorum hWellFormed
  have hQuorumPositive : 0 < quorumSize replicaCount failureBudget := by
    unfold quorumSize
    omega
  exact lt_of_lt_of_le hQuorumPositive hQuorum

theorem repair_closure_preserves_replica_mass
    {replicaCount failureBudget : Nat}
    {state : DurableReplicaState}
    (hWellFormed : DurableWellFormed replicaCount failureBudget state) :
    DurableWellFormed replicaCount failureBudget (repairClosure state) := by
  rcases hWellFormed with ⟨hMass, _hDebtBound, hFailuresBound⟩
  refine ⟨?_, ?_, hFailuresBound⟩
  · simpa [repairClosure] using hMass
  · simp [repairClosure]

theorem repair_closure_stable_of_exhausted_failures
    {replicaCount failureBudget : Nat}
    {state : DurableReplicaState}
    (hWellFormed : DurableWellFormed replicaCount failureBudget state)
    (hExhausted : state.failuresRemaining = 0) :
    StableReplicaState replicaCount (repairClosure state) := by
  rcases hWellFormed with ⟨hMass, _hDebtBound, _hFailuresBound⟩
  refine ⟨?_, ?_, ?_⟩
  · simpa [repairClosure] using hMass
  · simp [repairClosure]
  · simp [repairClosure, hExhausted]

end ForkRaceFoldTheorems
