------------------------------ MODULE QuantumDeficit ------------------------------
EXTENDS Naturals

CONSTANTS SqrtDomain

VARIABLES rootN, mode

vars == <<rootN, mode>>

Modes == {"classical", "quantum"}

Init ==
  /\ rootN \in SqrtDomain
  /\ rootN > 0
  /\ mode \in Modes

Change ==
  /\ rootN' \in SqrtDomain
  /\ rootN' > 0
  /\ mode' \in Modes

Stutter == UNCHANGED vars

Next == Change \/ Stutter
Spec == Init /\ [][Next]_vars

N == rootN * rootN
ClassicalBeta1 == 0
ProblemBeta1 == rootN - 1
ImplementationBeta1 == IF mode = "classical" THEN ClassicalBeta1 ELSE ProblemBeta1
Deficit == ProblemBeta1 - ImplementationBeta1
SequentialRounds == N
ParallelRounds == IF mode = "classical" THEN N ELSE rootN
Speedup == SequentialRounds \div ParallelRounds

InvPerfectSquare ==
  /\ N = rootN * rootN
  /\ rootN > 0

InvClassicalDeficit ==
  mode = "classical" => Deficit = rootN - 1

InvSpeedupIdentity ==
  /\ mode = "quantum" => Speedup = Deficit + 1
  /\ mode = "quantum" => Deficit = 0

=============================================================================
