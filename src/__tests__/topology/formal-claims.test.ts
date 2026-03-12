import { describe, expect, it } from 'vitest';

import {
  TopologyAnalyzer,
  beta2FromBandGap,
  firstLawConserved,
  protocolDeficits,
  quantumDeficitIdentity,
  settlementDeficits,
  speculativeTreeExpectedAccepted,
  turbulentIdleFraction,
  worthingtonWhipSavings,
} from '../../topology';

describe('Topology formal claim helpers', () => {
  it('computes theorem-aligned §7 formulas with explicit assumptions', () => {
    const whip = worthingtonWhipSavings(8);
    expect(whip.savingsFraction).toBeCloseTo(0.4375, 10);

    const speculative = speculativeTreeExpectedAccepted(0.9, 6);
    expect(speculative.expectedAccepted).toBeCloseTo(4.68559, 4);

    const turbulent = turbulentIdleFraction(4, 4);
    expect(turbulent.idleFraction).toBeCloseTo(3 / 7, 10);
  });

  it('encodes THM-Q-DEFICIT identity', () => {
    const quantum = quantumDeficitIdentity(32);
    expect(quantum.searchSize).toBe(1024);
    expect(quantum.quantumDeficit).toBe(0);
    expect(quantum.speedup).toBe(32);
    expect(quantum.speedup).toBe(quantum.classicalDeficit + 1);
  });

  it('matches protocol deficit helpers against TopologyAnalyzer behavior', () => {
    const streamCount = 32;
    const protocol = protocolDeficits(streamCount);

    const tcpTopology = TopologyAnalyzer.sequential(5, protocol.intrinsicBeta1);
    const tcpReport = TopologyAnalyzer.analyze(tcpTopology);
    expect(tcpReport.deficit?.deficit).toBe(protocol.tcpDeficit);

    const flowTopology = TopologyAnalyzer.fromForkRaceFold({
      forkWidth: streamCount,
      intrinsicBeta1: protocol.intrinsicBeta1,
    });
    const flowReport = TopologyAnalyzer.analyze(flowTopology);
    expect(flowReport.deficit?.deficit).toBe(protocol.flowDeficit);
  });

  it('returns canonical settlement deficits and band-gap beta2 behavior', () => {
    const settlement = settlementDeficits();
    expect(settlement.sequentialDeficit).toBe(2);
    expect(settlement.parallelDeficit).toBe(0);

    expect(beta2FromBandGap(0)).toBe(0);
    expect(beta2FromBandGap(2)).toBe(1);
  });

  it('checks first-law conservation under explicit work bound', () => {
    expect(firstLawConserved(10, 7, 3)).toBe(true);
    expect(firstLawConserved(10, 8, 3)).toBe(false);
    expect(firstLawConserved(10, 12, 0)).toBe(false);
  });
});
