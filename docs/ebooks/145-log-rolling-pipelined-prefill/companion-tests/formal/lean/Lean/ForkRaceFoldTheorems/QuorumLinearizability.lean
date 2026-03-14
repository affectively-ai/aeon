import Mathlib
import ForkRaceFoldTheorems.QuorumOrdering

namespace ForkRaceFoldTheorems

structure LinearizedWrite where
  ballot : Nat
  writer : Nat
deriving DecidableEq, Repr

def zeroLinearizedWrite : LinearizedWrite := { ballot := 0, writer := 0 }

def latestCommittedWrite (history : List LinearizedWrite) : LinearizedWrite :=
  history.getLastD zeroLinearizedWrite

structure LinearizedRead where
  ballot : Nat
  writer : Nat
  writeCount : Nat
deriving DecidableEq, Repr

def readRefinesPrefix (history : List LinearizedWrite) (read : LinearizedRead) : Prop :=
  read.ballot = (latestCommittedWrite (history.take read.writeCount)).ballot
    ∧ read.writer = (latestCommittedWrite (history.take read.writeCount)).writer

theorem append_write_updates_latest_committed_write
    (history : List LinearizedWrite)
    (write : LinearizedWrite) :
    latestCommittedWrite (history ++ [write]) = write := by
  simp [latestCommittedWrite]

theorem completed_read_refines_latest_prefix
    {history : List LinearizedWrite}
    {read : LinearizedRead}
    (hBallot :
      read.ballot = (latestCommittedWrite (history.take read.writeCount)).ballot)
    (hWriter :
      read.writer = (latestCommittedWrite (history.take read.writeCount)).writer) :
    readRefinesPrefix history read := by
  exact ⟨hBallot, hWriter⟩

theorem read_after_appended_write_refines_new_latest
    (history : List LinearizedWrite)
    (write : LinearizedWrite) :
    readRefinesPrefix
      (history ++ [write])
      { ballot := write.ballot, writer := write.writer, writeCount := history.length + 1 } := by
  have hTake :
      List.take (history.length + 1) (history ++ [write]) = history ++ [write] := by
    simp
  simp [readRefinesPrefix, hTake, append_write_updates_latest_committed_write]

theorem later_appended_write_excludes_stale_history_read
    {first second : LinearizedWrite}
    (hOrder : first.ballot < second.ballot) :
    ({ ballot := first.ballot, writer := first.writer, writeCount := 1 } : LinearizedRead).ballot
      <
      ({ ballot := second.ballot, writer := second.writer, writeCount := 2 } : LinearizedRead).ballot := by
  simpa using hOrder

def speculativeCompletedWrite : LinearizedWrite := { ballot := 1, writer := 1 }

def speculativeHistoryRead : LinearizedRead := { ballot := 2, writer := 2, writeCount := 1 }

theorem speculative_read_breaks_completed_history_refinement :
    ¬ readRefinesPrefix [speculativeCompletedWrite] speculativeHistoryRead := by
  intro hRefines
  simp [readRefinesPrefix, speculativeCompletedWrite, speculativeHistoryRead, latestCommittedWrite] at hRefines

end ForkRaceFoldTheorems
