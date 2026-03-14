import Mathlib
import ForkRaceFoldTheorems.QuorumConsistency

namespace ForkRaceFoldTheorems

theorem committed_multiwriter_read_exact_of_coverage
    {quorum : Finset Nat}
    {storedBallot : Nat -> Nat}
    {ackedBallot : Nat}
    (hAckMember : ∃ replica ∈ quorum, ackedBallot ≤ storedBallot replica)
    (hNoReplicaAhead : ∀ replica ∈ quorum, storedBallot replica ≤ ackedBallot) :
    readValue quorum storedBallot = ackedBallot := by
  exact committed_read_exact_of_coverage hAckMember hNoReplicaAhead

theorem committed_multiwriter_read_tracks_latest_writer
    {ballotWriter : Nat -> Nat}
    {sessionReadBallot ackedBallot sessionReadWriter ackedWriter : Nat}
    (hExact : sessionReadBallot = ackedBallot)
    (hReadWriter : sessionReadWriter = ballotWriter sessionReadBallot)
    (hAckWriter : ackedWriter = ballotWriter ackedBallot) :
    sessionReadWriter = ackedWriter := by
  rw [hReadWriter, hAckWriter, hExact]

theorem committed_multiwriter_reads_monotone_of_acked_order
    {firstAck secondAck firstRead secondRead : Nat}
    (hFirstExact : firstRead = firstAck)
    (hSecondExact : secondRead = secondAck)
    (hAckOrder : firstAck <= secondAck) :
    firstRead <= secondRead := by
  omega

theorem later_committed_ballot_excludes_stale_read
    {firstAck secondAck firstRead secondRead : Nat}
    (hFirstExact : firstRead = firstAck)
    (hSecondExact : secondRead = secondAck)
    (hAckOrder : firstAck < secondAck) :
    firstRead < secondRead := by
  omega

def partitionBoundaryReadSet : Finset Nat := {0, 1}

def partitionBoundaryStoredBallot (replica : Nat) : Nat :=
  if replica ∈ partitionBoundaryReadSet then 1 else 2

def partitionBoundaryLatestAck : Nat := 2

theorem partition_boundary_read_set_not_quorum :
    partitionBoundaryReadSet.card < quorumSize 5 2 := by
  native_decide

theorem partition_boundary_read_returns_stale_ballot :
    readValue partitionBoundaryReadSet partitionBoundaryStoredBallot = 1 := by
  native_decide

theorem partition_boundary_read_stale_under_split_connectivity :
    readValue partitionBoundaryReadSet partitionBoundaryStoredBallot < partitionBoundaryLatestAck := by
  native_decide

structure WriterBallot where
  ballot : Nat
  writer : Nat
deriving DecidableEq

def ballotCollisionLeft : WriterBallot := { ballot := 1, writer := 1 }
def ballotCollisionRight : WriterBallot := { ballot := 1, writer := 2 }

theorem ballot_collision_boundary_same_ballot :
    ballotCollisionLeft.ballot = ballotCollisionRight.ballot := by
  rfl

theorem ballot_collision_boundary_distinct_writers :
    ballotCollisionLeft.writer ≠ ballotCollisionRight.writer := by
  decide

theorem ballot_collision_boundary_distinct_records :
    ballotCollisionLeft ≠ ballotCollisionRight := by
  decide

theorem ballot_collision_boundary_unique_writer_fails :
    ¬ ∃! record : WriterBallot, record.ballot = 1 := by
  intro hUnique
  rcases hUnique with ⟨record, _hRecord, hOnly⟩
  have hLeft : ballotCollisionLeft = record := hOnly ballotCollisionLeft rfl
  have hRight : ballotCollisionRight = record := hOnly ballotCollisionRight rfl
  exact ballot_collision_boundary_distinct_records (hLeft.trans hRight.symm)

end ForkRaceFoldTheorems
