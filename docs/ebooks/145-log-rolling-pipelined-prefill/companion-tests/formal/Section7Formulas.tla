------------------------------ MODULE Section7Formulas ------------------------------
EXTENDS Naturals

CONSTANTS ChunkDomain, StageDomain, ShardDomain, AlphaPDomain, AlphaQDomain, KDomain

VARIABLES c, n, s, alphaP, alphaQ, k

vars == <<c, n, s, alphaP, alphaQ, k>>

RECURSIVE Pow(_, _)
Pow(base, exp) ==
  IF exp = 0 THEN 1 ELSE base * Pow(base, exp - 1)

Init ==
  /\ c \in ChunkDomain
  /\ n \in StageDomain
  /\ s \in ShardDomain
  /\ alphaP \in AlphaPDomain
  /\ alphaQ \in AlphaQDomain
  /\ k \in KDomain
  /\ alphaQ > alphaP

Change ==
  /\ c' \in ChunkDomain
  /\ n' \in StageDomain
  /\ s' \in ShardDomain
  /\ alphaP' \in AlphaPDomain
  /\ alphaQ' \in AlphaQDomain
  /\ k' \in KDomain
  /\ alphaQ' > alphaP'

Stutter == UNCHANGED vars

Next == Change \/ Stutter
Spec == Init /\ [][Next]_vars

WorthingtonNum == s - 1
WorthingtonDen == 2 * s

SpeculativeTreeNum == Pow(alphaQ, k) - Pow(alphaP, k)
SpeculativeTreeDen == (alphaQ - alphaP) * Pow(alphaQ, k - 1)

TurbulentIdleNum == n * (n - 1)
TurbulentIdleDen == (c + n - 1) * n

InvWellFormed ==
  /\ c > 0
  /\ n > 0
  /\ s > 0
  /\ k > 0
  /\ alphaQ > alphaP

InvWorthingtonBounds ==
  /\ WorthingtonNum = s - 1
  /\ WorthingtonDen = 2 * s
  /\ WorthingtonNum < WorthingtonDen

InvSpeculativeTreePositive ==
  /\ SpeculativeTreeNum > 0
  /\ SpeculativeTreeDen > 0

InvTurbulentIdleBounds ==
  /\ TurbulentIdleNum >= 0
  /\ TurbulentIdleDen > 0
  /\ TurbulentIdleNum <= TurbulentIdleDen

=============================================================================
