/**
 * Aeon Flow Protocol Shootoff
 *
 * Head-to-head comparison: Aeon Flow vs HTTP/1.1 vs HTTP/2
 * with no compression, gzip, and brotli.
 *
 * Same payloads, same compression, same TLS assumptions.
 * The ONLY variable is the protocol framing.
 *
 * Two site profiles:
 * 1. "Whip Worthington's Flaxseed Empire" — big content site (few large resources)
 * 2. "The Wally Wallington Wonder Archive" — microfrontend (many small modules)
 */

import { describe, it, expect } from 'vitest';
import { bigContentSite } from '../fixtures/big-content';
import { microfrontendSite } from '../fixtures/microfrontend';
import { serveHttp1, http1RoundTrips } from '../protocols/http1';
import { serveHttp2, http2RoundTrips } from '../protocols/http2';
import { serveAeonFlow, aeonFlowRoundTrips } from '../protocols/aeon-flow';
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
      case 'aeon-flow':
        return serveAeonFlow(resource, compression, site.resources.length);
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
    case 'aeon-flow':
      roundTrips = aeonFlowRoundTrips(site.resources.length);
      maxConcurrentStreams = 256;
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
  // Baseline = HTTP/1.1 no compression
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
  console.log(`\n${'═'.repeat(130)}`);
  console.log(`  ${siteName}`);
  console.log(`${'═'.repeat(130)}`);
  console.log(
    '  ' +
    'Protocol'.padEnd(14) +
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
  console.log(`  ${'─'.repeat(126)}`);

  for (const row of rows) {
    const protoLabel = row.protocol === 'aeon-flow' ? 'Aeon Flow' :
                       row.protocol === 'http1' ? 'HTTP/1.1' : 'HTTP/2';
    console.log(
      '  ' +
      protoLabel.padEnd(14) +
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
// Tests
// ═══════════════════════════════════════════════════════════════════════════════

const protocols: Protocol[] = ['http1', 'http2', 'aeon-flow'];
const compressions: CompressionAlgo[] = ['none', 'gzip', 'brotli'];

describe('Protocol Shootoff', () => {
  describe('Whip Worthington\'s Flaxseed Empire (big content site)', () => {
    const allResults: SiteResult[] = [];

    for (const proto of protocols) {
      for (const comp of compressions) {
        it(`${proto} + ${comp}`, () => {
          const result = runSite(bigContentSite, proto, comp);
          allResults.push(result);

          // Basic sanity: wire bytes should be > 0
          expect(result.totalWireBytes).toBeGreaterThan(0);
          // Framing overhead should be positive
          expect(result.totalFramingOverhead).toBeGreaterThan(0);
          // Compressed should be <= raw (or equal for no compression of random data)
          expect(result.totalCompressedBytes).toBeLessThanOrEqual(result.totalRawBytes * 1.1);
        });
      }
    }

    it('prints comparison table', () => {
      // Run all if not already run
      if (allResults.length === 0) {
        for (const proto of protocols) {
          for (const comp of compressions) {
            allResults.push(runSite(bigContentSite, proto, comp));
          }
        }
      }
      const rows = buildTable(allResults);
      printTable('Whip Worthington\'s Flaxseed Empire — Big Content Site (12 resources, ~2.5 MB)', rows);

      // Aeon Flow should have less framing overhead than HTTP/1.1
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

      // This is where Aeon should really shine — many small resources
      const aeonBrotli = allResults.find(r => r.protocol === 'aeon-flow' && r.compression === 'brotli')!;
      const http1Brotli = allResults.find(r => r.protocol === 'http1' && r.compression === 'brotli')!;
      const http2Brotli = allResults.find(r => r.protocol === 'http2' && r.compression === 'brotli')!;

      // Aeon should have dramatically less framing overhead than HTTP/1.1 for many resources
      expect(aeonBrotli.totalFramingOverhead).toBeLessThan(http1Brotli.totalFramingOverhead);
      // Aeon should also beat HTTP/2 on framing overhead
      expect(aeonBrotli.totalFramingOverhead).toBeLessThan(http2Brotli.totalFramingOverhead);
      // Aeon should use fewer round trips
      expect(aeonBrotli.roundTrips).toBeLessThan(http1Brotli.roundTrips);
    });
  });

  describe('Head-to-head summary', () => {
    it('prints winner analysis', () => {
      const sites = [
        { manifest: bigContentSite, label: 'Big Content (Whip Worthington)' },
        { manifest: microfrontendSite, label: 'Microfrontend (Wally Wallington)' },
      ];

      console.log(`\n${'═'.repeat(90)}`);
      console.log('  HEAD-TO-HEAD WINNER ANALYSIS');
      console.log(`${'═'.repeat(90)}`);

      for (const { manifest, label } of sites) {
        console.log(`\n  ${label}:`);

        const bestByWire = { protocol: '' as Protocol, comp: '' as CompressionAlgo, wire: Infinity };
        const bestByOverhead = { protocol: '' as Protocol, comp: '' as CompressionAlgo, pct: Infinity };

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

        const wireLabel = bestByWire.protocol === 'aeon-flow' ? 'Aeon Flow' :
                          bestByWire.protocol === 'http1' ? 'HTTP/1.1' : 'HTTP/2';
        const overheadLabel = bestByOverhead.protocol === 'aeon-flow' ? 'Aeon Flow' :
                              bestByOverhead.protocol === 'http1' ? 'HTTP/1.1' : 'HTTP/2';

        console.log(`    Smallest wire size:     ${wireLabel} + ${bestByWire.comp} (${formatBytes(bestByWire.wire)})`);
        console.log(`    Lowest framing overhead: ${overheadLabel} + ${bestByOverhead.comp} (${bestByOverhead.pct.toFixed(3)}%)`);

        // RTT comparison
        const h1rtt = http1RoundTrips(manifest.resources.length);
        console.log(`    Round trips:            HTTP/1.1=${h1rtt}, HTTP/2=2, Aeon Flow=1`);
      }

      console.log();
    });
  });
});
