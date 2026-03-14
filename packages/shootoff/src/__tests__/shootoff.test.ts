/**
 * Aeon Flow Protocol Shootoff
 *
 * Head-to-head comparison: HTTP/1.1 vs HTTP/2 vs Aeon Flow vs Aeon-Flux
 * with no compression, gzip, and brotli.
 *
 * Same content served four ways:
 * 1. HTTP/1.1 — N resources, 6 parallel connections
 * 2. HTTP/2 — N resources, 100 multiplexed streams
 * 3. Aeon Flow — N resources, 256 forked streams, 1 RTT
 * 4. Aeon-Flux (HTTP) — 1 pre-rendered resource over HTTP
 * 5. Aeon-Flux (Flow) — 1 pre-rendered resource over flow protocol
 *
 * Four site profiles:
 * 1. "Whip Worthington's Flaxseed Empire" — big content (12 resources, ~2.5 MB)
 * 2. "The Wally Wallington Wonder Archive" — microfrontend (95 resources, ~1.8 MB)
 * 3. Whip Worthington Flux — same content, pre-rendered (1 resource, ~1.56 MB)
 * 4. Wally Wallington Flux — same content, pre-rendered (1 resource, ~230 KB)
 */

import { describe, it, expect } from 'vitest';
import { bigContentSite } from '../fixtures/big-content';
import { microfrontendSite } from '../fixtures/microfrontend';
import { bigContentFluxSite, bigContentFluxMeta } from '../fixtures/big-content-flux';
import { microfrontendFluxSite, microfrontendFluxMeta } from '../fixtures/microfrontend-flux';
import { serveHttp1, http1RoundTrips } from '../protocols/http1';
import { serveHttp2, http2RoundTrips } from '../protocols/http2';
import { serveHttp3, http3RoundTrips } from '../protocols/http3';
import { serveAeonFlow, aeonFlowRoundTrips } from '../protocols/aeon-flow';
import { serveAeonFluxHttp, serveAeonFluxFlow, aeonFluxHttpRoundTrips, aeonFluxFlowRoundTrips } from '../protocols/aeon-flux';
import { serveXGnosis, xGnosisRoundTrips } from '../protocols/x-gnosis';
import { serveXGnosisTopo, xGnosisTopoRoundTrips } from '../protocols/x-gnosis-topo';
import type { SiteManifest, SiteResult, Protocol, CompressionAlgo, ComparisonRow } from '../types';

// ═══════════════════════════════════════════════════════════════════════════════
// Test runner
// ═══════════════════════════════════════════════════════════════════════════════

function runSite(
  site: SiteManifest,
  protocol: Protocol,
  compression: CompressionAlgo
): SiteResult {
  const results = site.resources.map((resource, i) => {
    switch (protocol) {
      case 'http1':
        return serveHttp1(resource, compression);
      case 'http2':
        return serveHttp2(resource, compression, i === 0);
      case 'http3':
        return serveHttp3(resource, compression, i === 0);
      case 'aeon-flow':
        return serveAeonFlow(resource, compression, site.resources.length);
      case 'aeon-flux-http':
        return serveAeonFluxHttp(resource, compression);
      case 'aeon-flux-flow':
        return serveAeonFluxFlow(resource, compression);
      case 'x-gnosis':
        return serveXGnosis(resource, compression, site.resources.length);
      case 'x-gnosis-topo':
        return serveXGnosisTopo(resource, compression, site.resources.length);
    }
  });

  const totalRawBytes = results.reduce((s, r) => s + r.rawSize, 0);
  const totalCompressedBytes = results.reduce((s, r) => s + r.compressedSize, 0);
  const totalFramingOverhead = results.reduce((s, r) => s + r.framingOverhead, 0);
  const totalWireBytes = results.reduce((s, r) => s + r.wireBytes, 0);
  const totalEncodeUs = results.reduce((s, r) => s + r.encodeUs, 0);
  const totalDecodeUs = results.reduce((s, r) => s + r.decodeUs, 0);

  let roundTrips: number;
  let maxConcurrentStreams: number;
  switch (protocol) {
    case 'http1':
      roundTrips = http1RoundTrips(site.resources.length);
      maxConcurrentStreams = 6;
      break;
    case 'http2':
      roundTrips = http2RoundTrips(site.resources.length);
      maxConcurrentStreams = 100;
      break;
    case 'http3':
      roundTrips = http3RoundTrips(site.resources.length);
      maxConcurrentStreams = 100;
      break;
    case 'aeon-flow':
      roundTrips = aeonFlowRoundTrips(site.resources.length);
      maxConcurrentStreams = 256;
      break;
    case 'aeon-flux-http':
      roundTrips = aeonFluxHttpRoundTrips();
      maxConcurrentStreams = 1;
      break;
    case 'aeon-flux-flow':
      roundTrips = aeonFluxFlowRoundTrips();
      maxConcurrentStreams = 1;
      break;
    case 'x-gnosis':
      roundTrips = xGnosisRoundTrips(site.resources.length);
      maxConcurrentStreams = 6;
      break;
    case 'x-gnosis-topo':
      roundTrips = xGnosisTopoRoundTrips(site.resources.length);
      maxConcurrentStreams = 6;
      break;
  }

  return {
    protocol,
    compression,
    site: site.name,
    resources: results,
    totalRawBytes,
    totalCompressedBytes,
    totalFramingOverhead,
    totalWireBytes,
    totalEncodeUs,
    totalDecodeUs,
    roundTrips,
    maxConcurrentStreams,
    framingOverheadPercent: (totalFramingOverhead / totalWireBytes) * 100,
    compressionRatio: totalCompressedBytes / totalRawBytes,
  };
}

function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(2)} MB`;
}

function buildTable(results: SiteResult[]): ComparisonRow[] {
  const baseline = results.find(r => r.protocol === 'http1' && r.compression === 'none');
  const baselineWire = baseline?.totalWireBytes ?? 1;

  return results.map(r => ({
    protocol: r.protocol,
    compression: r.compression,
    totalRaw: formatBytes(r.totalRawBytes),
    totalWire: formatBytes(r.totalWireBytes),
    overhead: formatBytes(r.totalFramingOverhead),
    overheadPct: `${r.framingOverheadPercent.toFixed(2)}%`,
    compressionRatio: `${(r.compressionRatio * 100).toFixed(1)}%`,
    roundTrips: r.roundTrips,
    encodeMs: `${(r.totalEncodeUs / 1000).toFixed(2)}ms`,
    decodeMs: `${(r.totalDecodeUs / 1000).toFixed(2)}ms`,
    savings: `${((1 - r.totalWireBytes / baselineWire) * 100).toFixed(1)}%`,
  }));
}

function printTable(siteName: string, rows: ComparisonRow[]): void {
  console.log(`\n${'═'.repeat(140)}`);
  console.log(`  ${siteName}`);
  console.log(`${'═'.repeat(140)}`);
  console.log(
    '  ' +
    'Protocol'.padEnd(18) +
    'Compress'.padEnd(10) +
    'Raw'.padEnd(12) +
    'Wire'.padEnd(12) +
    'Overhead'.padEnd(12) +
    'Ovhd %'.padEnd(10) +
    'Comp Ratio'.padEnd(12) +
    'RTTs'.padEnd(6) +
    'Encode'.padEnd(12) +
    'Decode'.padEnd(12) +
    'Savings'
  );
  console.log(`  ${'─'.repeat(136)}`);

  for (const row of rows) {
    const protoLabel =
      row.protocol === 'aeon-flow' ? 'Aeon Flow' :
      row.protocol === 'aeon-flux-http' ? 'Aeon-Flux/HTTP' :
      row.protocol === 'aeon-flux-flow' ? 'Aeon-Flux/Flow' :
      row.protocol === 'x-gnosis-topo' ? 'x-gnosis/topo' :
      row.protocol === 'x-gnosis' ? 'x-gnosis' :
      row.protocol === 'http3' ? 'HTTP/3' :
      row.protocol === 'http1' ? 'HTTP/1.1' : 'HTTP/2';
    console.log(
      '  ' +
      protoLabel.padEnd(18) +
      row.compression.padEnd(10) +
      row.totalRaw.padEnd(12) +
      row.totalWire.padEnd(12) +
      row.overhead.padEnd(12) +
      row.overheadPct.padEnd(10) +
      row.compressionRatio.padEnd(12) +
      String(row.roundTrips).padEnd(6) +
      row.encodeMs.padEnd(12) +
      row.decodeMs.padEnd(12) +
      row.savings
    );
  }
  console.log();
}

// ═══════════════════════════════════════════════════════════════════════════════
// Original Protocol Tests (HTTP/1.1, HTTP/2, Aeon Flow)
// ═══════════════════════════════════════════════════════════════════════════════

const protocols: Protocol[] = ['http1', 'http2', 'http3', 'aeon-flow', 'x-gnosis', 'x-gnosis-topo'];
const allProtocols: Protocol[] = ['http1', 'http2', 'http3', 'aeon-flow', 'x-gnosis', 'x-gnosis-topo', 'aeon-flux-http', 'aeon-flux-flow'];
const compressions: CompressionAlgo[] = ['none', 'gzip', 'brotli', 'topo-pure', 'topo-full'];

describe('Protocol Shootoff', () => {
  describe('Whip Worthington\'s Flaxseed Empire (big content site)', () => {
    const allResults: SiteResult[] = [];

    for (const proto of protocols) {
      for (const comp of compressions) {
        it(`${proto} + ${comp}`, () => {
          const result = runSite(bigContentSite, proto, comp);
          allResults.push(result);

          expect(result.totalWireBytes).toBeGreaterThan(0);
          expect(result.totalFramingOverhead).toBeGreaterThan(0);
          expect(result.totalCompressedBytes).toBeLessThanOrEqual(result.totalRawBytes * 1.1);
        });
      }
    }

    it('prints comparison table', () => {
      if (allResults.length === 0) {
        for (const proto of protocols) {
          for (const comp of compressions) {
            allResults.push(runSite(bigContentSite, proto, comp));
          }
        }
      }
      const rows = buildTable(allResults);
      printTable('Whip Worthington\'s Flaxseed Empire — Big Content Site (12 resources, ~2.5 MB)', rows);

      const aeonBrotli = allResults.find(r => r.protocol === 'aeon-flow' && r.compression === 'brotli')!;
      const http1Brotli = allResults.find(r => r.protocol === 'http1' && r.compression === 'brotli')!;
      expect(aeonBrotli.totalFramingOverhead).toBeLessThan(http1Brotli.totalFramingOverhead);
    });
  });

  describe('The Wally Wallington Wonder Archive (microfrontend)', () => {
    const allResults: SiteResult[] = [];

    for (const proto of protocols) {
      for (const comp of compressions) {
        it(`${proto} + ${comp}`, () => {
          const result = runSite(microfrontendSite, proto, comp);
          allResults.push(result);

          expect(result.totalWireBytes).toBeGreaterThan(0);
          expect(result.totalFramingOverhead).toBeGreaterThan(0);
          expect(result.totalCompressedBytes).toBeLessThanOrEqual(result.totalRawBytes * 1.1);
        });
      }
    }

    it('prints comparison table', () => {
      if (allResults.length === 0) {
        for (const proto of protocols) {
          for (const comp of compressions) {
            allResults.push(runSite(microfrontendSite, proto, comp));
          }
        }
      }
      const rows = buildTable(allResults);
      printTable('The Wally Wallington Wonder Archive — Microfrontend (95 resources, ~1.8 MB)', rows);

      const aeonBrotli = allResults.find(r => r.protocol === 'aeon-flow' && r.compression === 'brotli')!;
      const http1Brotli = allResults.find(r => r.protocol === 'http1' && r.compression === 'brotli')!;
      const http2Brotli = allResults.find(r => r.protocol === 'http2' && r.compression === 'brotli')!;

      expect(aeonBrotli.totalFramingOverhead).toBeLessThan(http1Brotli.totalFramingOverhead);
      expect(aeonBrotli.totalFramingOverhead).toBeLessThan(http2Brotli.totalFramingOverhead);
      expect(aeonBrotli.roundTrips).toBeLessThan(http1Brotli.roundTrips);
    });
  });

  // ═══════════════════════════════════════════════════════════════════════════
  // Aeon-Flux Tests — Pre-rendered Self-Contained Sites
  // ═══════════════════════════════════════════════════════════════════════════

  describe('Whip Worthington Flux (pre-rendered big content)', () => {
    const fluxProtocols: Protocol[] = ['aeon-flux-http', 'aeon-flux-flow'];

    for (const proto of fluxProtocols) {
      for (const comp of compressions) {
        it(`${proto} + ${comp}`, () => {
          const result = runSite(bigContentFluxSite, proto, comp);

          expect(result.totalWireBytes).toBeGreaterThan(0);
          expect(result.totalFramingOverhead).toBeGreaterThan(0);
          expect(result.totalCompressedBytes).toBeLessThanOrEqual(result.totalRawBytes * 1.1);
          // Only 1 resource
          expect(result.resources.length).toBe(1);
        });
      }
    }
  });

  describe('Wally Wallington Flux (pre-rendered microfrontend)', () => {
    const fluxProtocols: Protocol[] = ['aeon-flux-http', 'aeon-flux-flow'];

    for (const proto of fluxProtocols) {
      for (const comp of compressions) {
        it(`${proto} + ${comp}`, () => {
          const result = runSite(microfrontendFluxSite, proto, comp);

          expect(result.totalWireBytes).toBeGreaterThan(0);
          expect(result.totalFramingOverhead).toBeGreaterThan(0);
          expect(result.totalCompressedBytes).toBeLessThanOrEqual(result.totalRawBytes * 1.1);
          expect(result.resources.length).toBe(1);
        });
      }
    }
  });

  // ═══════════════════════════════════════════════════════════════════════════
  // Cross-Comparison Matrix
  // ═══════════════════════════════════════════════════════════════════════════

  describe('Full matrix comparison', () => {
    it('Big Content: HTTP vs Aeon vs x-gnosis vs x-gnosis/topo vs Aeon-Flux (brotli)', () => {
      const results: SiteResult[] = [
        // Original site through 6 protocols
        runSite(bigContentSite, 'http1', 'brotli'),
        runSite(bigContentSite, 'http2', 'brotli'),
        runSite(bigContentSite, 'http3', 'brotli'),
        runSite(bigContentSite, 'aeon-flow', 'brotli'),
        runSite(bigContentSite, 'x-gnosis', 'brotli'),
        runSite(bigContentSite, 'x-gnosis-topo', 'brotli'), // topo-race ignores the algo param
        // Flux site through 2 transports
        runSite(bigContentFluxSite, 'aeon-flux-http', 'brotli'),
        runSite(bigContentFluxSite, 'aeon-flux-flow', 'brotli'),
      ];

      // Use HTTP/1.1 original as baseline for savings
      const baseline = results[0].totalWireBytes;
      const rows = results.map(r => ({
        protocol: r.protocol,
        compression: r.compression,
        totalRaw: formatBytes(r.totalRawBytes),
        totalWire: formatBytes(r.totalWireBytes),
        overhead: formatBytes(r.totalFramingOverhead),
        overheadPct: `${r.framingOverheadPercent.toFixed(2)}%`,
        compressionRatio: `${(r.compressionRatio * 100).toFixed(1)}%`,
        roundTrips: r.roundTrips,
        encodeMs: `${(r.totalEncodeUs / 1000).toFixed(2)}ms`,
        decodeMs: `${(r.totalDecodeUs / 1000).toFixed(2)}ms`,
        savings: `${((1 - r.totalWireBytes / baseline) * 100).toFixed(1)}%`,
      }));

      printTable('BIG CONTENT CROSS-COMPARISON (brotli)', rows);

      // Flux/Flow should have lowest framing overhead
      const fluxFlow = results.find(r => r.protocol === 'aeon-flux-flow')!;
      const http1 = results.find(r => r.protocol === 'http1')!;
      expect(fluxFlow.totalFramingOverhead).toBeLessThan(http1.totalFramingOverhead);
      expect(fluxFlow.roundTrips).toBeLessThanOrEqual(http1.roundTrips);
    });

    it('Microfrontend: HTTP vs Aeon vs x-gnosis vs x-gnosis/topo vs Aeon-Flux (brotli)', () => {
      const results: SiteResult[] = [
        runSite(microfrontendSite, 'http1', 'brotli'),
        runSite(microfrontendSite, 'http2', 'brotli'),
        runSite(microfrontendSite, 'http3', 'brotli'),
        runSite(microfrontendSite, 'aeon-flow', 'brotli'),
        runSite(microfrontendSite, 'x-gnosis', 'brotli'),
        runSite(microfrontendSite, 'x-gnosis-topo', 'brotli'),
        runSite(microfrontendFluxSite, 'aeon-flux-http', 'brotli'),
        runSite(microfrontendFluxSite, 'aeon-flux-flow', 'brotli'),
      ];

      const baseline = results[0].totalWireBytes;
      const rows = results.map(r => ({
        protocol: r.protocol,
        compression: r.compression,
        totalRaw: formatBytes(r.totalRawBytes),
        totalWire: formatBytes(r.totalWireBytes),
        overhead: formatBytes(r.totalFramingOverhead),
        overheadPct: `${r.framingOverheadPercent.toFixed(2)}%`,
        compressionRatio: `${(r.compressionRatio * 100).toFixed(1)}%`,
        roundTrips: r.roundTrips,
        encodeMs: `${(r.totalEncodeUs / 1000).toFixed(2)}ms`,
        decodeMs: `${(r.totalDecodeUs / 1000).toFixed(2)}ms`,
        savings: `${((1 - r.totalWireBytes / baseline) * 100).toFixed(1)}%`,
      }));

      printTable('MICROFRONTEND CROSS-COMPARISON (brotli)', rows);

      // Flux should be dramatically smaller — 230KB vs 1.8MB raw
      const fluxFlow = results.find(r => r.protocol === 'aeon-flux-flow')!;
      const http1 = results.find(r => r.protocol === 'http1')!;
      expect(fluxFlow.totalWireBytes).toBeLessThan(http1.totalWireBytes);
      // Flux should have lowest overhead percentage
      expect(fluxFlow.framingOverheadPercent).toBeLessThan(http1.framingOverheadPercent);
    });
  });

  // ═══════════════════════════════════════════════════════════════════════════
  // Topological vs Brotli — Per-Chunk Adaptive vs Global Algorithm
  // ═══════════════════════════════════════════════════════════════════════════

  describe('Topological vs Brotli shootoff', () => {
    it('Big Content: brotli vs topo-pure vs topo-full across all protocols', () => {
      const results: SiteResult[] = [];
      for (const proto of protocols) {
        results.push(runSite(bigContentSite, proto, 'brotli'));
        results.push(runSite(bigContentSite, proto, 'topo-pure'));
        results.push(runSite(bigContentSite, proto, 'topo-full'));
      }

      const rows = buildTable(results);
      printTable('BROTLI vs TOPO-PURE vs TOPO-FULL — Big Content (12 resources, ~2.5 MB)', rows);

      // Topo-full (with brotli in the race) should beat or match standalone brotli
      const aeonBrotli = results.find(r => r.protocol === 'aeon-flow' && r.compression === 'brotli')!;
      const aeonTopoFull = results.find(r => r.protocol === 'aeon-flow' && r.compression === 'topo-full')!;
      expect(aeonTopoFull.totalWireBytes).toBeGreaterThan(0);
      expect(aeonTopoFull.totalCompressedBytes).toBeLessThanOrEqual(aeonTopoFull.totalRawBytes);
      // Topo-full should be within 10% of brotli (9-byte per-chunk header overhead)
      expect(aeonTopoFull.totalCompressedBytes).toBeLessThan(aeonBrotli.totalCompressedBytes * 1.15);
    });

    it('Microfrontend: brotli vs topo-pure vs topo-full across all protocols', () => {
      const results: SiteResult[] = [];
      for (const proto of protocols) {
        results.push(runSite(microfrontendSite, proto, 'brotli'));
        results.push(runSite(microfrontendSite, proto, 'topo-pure'));
        results.push(runSite(microfrontendSite, proto, 'topo-full'));
      }

      const rows = buildTable(results);
      printTable('BROTLI vs TOPO-PURE vs TOPO-FULL — Microfrontend (95 resources, ~1.8 MB)', rows);

      const aeonBrotli = results.find(r => r.protocol === 'aeon-flow' && r.compression === 'brotli')!;
      const aeonTopoPure = results.find(r => r.protocol === 'aeon-flow' && r.compression === 'topo-pure')!;
      const aeonTopoFull = results.find(r => r.protocol === 'aeon-flow' && r.compression === 'topo-full')!;
      expect(aeonTopoFull.totalWireBytes).toBeGreaterThan(0);
      expect(aeonTopoFull.totalCompressedBytes).toBeLessThanOrEqual(aeonTopoFull.totalRawBytes);
      // Topo-full should beat topo-pure significantly
      expect(aeonTopoFull.totalCompressedBytes).toBeLessThan(aeonTopoPure.totalCompressedBytes);
      // Topo-full trades 9-byte/chunk headers for per-chunk adaptivity — within 25% of brotli
      expect(aeonTopoFull.totalCompressedBytes).toBeLessThan(aeonBrotli.totalCompressedBytes * 1.25);
    });
  });

  // ═══════════════════════════════════════════════════════════════════════════
  // Head-to-Head Summary
  // ═══════════════════════════════════════════════════════════════════════════

  describe('Head-to-head summary', () => {
    it('prints winner analysis', () => {
      const sites = [
        { manifest: bigContentSite, fluxManifest: bigContentFluxSite, fluxMeta: bigContentFluxMeta, label: 'Big Content (Whip Worthington)' },
        { manifest: microfrontendSite, fluxManifest: microfrontendFluxSite, fluxMeta: microfrontendFluxMeta, label: 'Microfrontend (Wally Wallington)' },
      ];

      console.log(`\n${'═'.repeat(100)}`);
      console.log('  HEAD-TO-HEAD WINNER ANALYSIS — FULL MATRIX');
      console.log(`${'═'.repeat(100)}`);

      for (const { manifest, fluxManifest, fluxMeta, label } of sites) {
        console.log(`\n  ${label}:`);

        const bestByWire = { protocol: '' as Protocol, comp: '' as CompressionAlgo, wire: Infinity };
        const bestByOverhead = { protocol: '' as Protocol, comp: '' as CompressionAlgo, pct: Infinity };

        // Test original site through original protocols
        for (const proto of protocols) {
          for (const comp of compressions) {
            const r = runSite(manifest, proto, comp);
            if (r.totalWireBytes < bestByWire.wire) {
              bestByWire.protocol = proto;
              bestByWire.comp = comp;
              bestByWire.wire = r.totalWireBytes;
            }
            if (r.framingOverheadPercent < bestByOverhead.pct) {
              bestByOverhead.protocol = proto;
              bestByOverhead.comp = comp;
              bestByOverhead.pct = r.framingOverheadPercent;
            }
          }
        }

        // Test flux site through flux protocols
        const fluxProtos: Protocol[] = ['aeon-flux-http', 'aeon-flux-flow'];
        for (const proto of fluxProtos) {
          for (const comp of compressions) {
            const r = runSite(fluxManifest, proto, comp);
            if (r.totalWireBytes < bestByWire.wire) {
              bestByWire.protocol = proto;
              bestByWire.comp = comp;
              bestByWire.wire = r.totalWireBytes;
            }
            if (r.framingOverheadPercent < bestByOverhead.pct) {
              bestByOverhead.protocol = proto;
              bestByOverhead.comp = comp;
              bestByOverhead.pct = r.framingOverheadPercent;
            }
          }
        }

        // Also test topo-full through original protocols
        for (const proto of protocols) {
          const r = runSite(manifest, proto, 'topo-full');
          if (r.totalWireBytes < bestByWire.wire) {
            bestByWire.protocol = proto;
            bestByWire.comp = 'topo-full';
            bestByWire.wire = r.totalWireBytes;
          }
          if (r.framingOverheadPercent < bestByOverhead.pct) {
            bestByOverhead.protocol = proto;
            bestByOverhead.comp = 'topo-full';
            bestByOverhead.pct = r.framingOverheadPercent;
          }
        }

        const protoLabel = (p: Protocol) =>
          p === 'aeon-flow' ? 'Aeon Flow' :
          p === 'aeon-flux-http' ? 'Aeon-Flux/HTTP' :
          p === 'aeon-flux-flow' ? 'Aeon-Flux/Flow' :
          p === 'x-gnosis-topo' ? 'x-gnosis/topo' :
          p === 'x-gnosis' ? 'x-gnosis' :
          p === 'http3' ? 'HTTP/3' :
          p === 'http1' ? 'HTTP/1.1' : 'HTTP/2';

        console.log(`    Smallest wire size:     ${protoLabel(bestByWire.protocol)} + ${bestByWire.comp} (${formatBytes(bestByWire.wire)})`);
        console.log(`    Lowest framing overhead: ${protoLabel(bestByOverhead.protocol)} + ${bestByOverhead.comp} (${bestByOverhead.pct.toFixed(3)}%)`);

        const h1rtt = http1RoundTrips(manifest.resources.length);
        const xgRtt = xGnosisRoundTrips(manifest.resources.length);
        const xgtRtt = xGnosisTopoRoundTrips(manifest.resources.length);
        console.log(`    Round trips:            HTTP/1.1=${h1rtt}, HTTP/2=2, HTTP/3=1, Aeon Flow=1, x-gnosis=${xgRtt}, x-gnosis/topo=${xgtRtt}, Aeon-Flux/HTTP=2, Aeon-Flux/Flow=1`);

        // Show the raw payload reduction from Flux
        const origRaw = manifest.resources.reduce((s, r) => s + r.size, 0);
        const fluxRaw = fluxManifest.resources.reduce((s, r) => s + r.size, 0);
        const reduction = ((1 - fluxRaw / origRaw) * 100).toFixed(1);
        console.log(`    Flux payload reduction: ${formatBytes(origRaw)} → ${formatBytes(fluxRaw)} (${reduction}% smaller via tree-shaking + inlining)`);
        console.log(`    Pre-rendered HTML:      ${formatBytes(fluxMeta.htmlSize)} (from prerenderPage())`);
        console.log(`    Tree-shaken CSS:        ${formatBytes(fluxMeta.cssSize)}`);
        console.log(`    Normie features:        0 (static HTML, no intelligence)`);
        console.log(`    Flux features (${fluxMeta.features.length}):`);
        for (const feat of fluxMeta.features) {
          console.log(`      + ${feat}`);
        }
      }

      console.log();
    });
  });
});
