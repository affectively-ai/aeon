/**
 * Real compression using Node's zlib.
 *
 * We generate synthetic payloads that match real-world compressibility:
 * - Text (HTML/CSS/JS): highly compressible (~70-85% reduction)
 * - Images (WebP/PNG): already compressed (~2-5% reduction)
 * - Fonts (WOFF2): already compressed (~1-3% reduction)
 * - JSON: moderately compressible (~60-75% reduction)
 */

import { gzipSync, brotliCompressSync, constants } from 'node:zlib';
import type { CompressionAlgo } from '../types';

/**
 * Generate a synthetic payload of the given size that matches
 * the compressibility of the given MIME type.
 *
 * Text-like content gets repetitive patterns (like real code/markup).
 * Binary content gets pseudo-random bytes (like real compressed images).
 */
export function generatePayload(size: number, contentType: string): Uint8Array {
  const buf = new Uint8Array(size);

  if (isTextLike(contentType)) {
    // Text: repeating patterns with some variation (simulates real code/markup)
    // Real JS/CSS/HTML compresses ~70-85% with brotli
    const patterns = [
      'function(){return this.props.children;}',
      'export default class Component extends React.Component{',
      '.container{display:flex;align-items:center;justify-content:center;}',
      '<div class="flex items-center gap-4 p-6 rounded-lg shadow-md">',
      'const [state, setState] = useState(initialValue);',
      'import { useCallback, useMemo, useEffect } from "react";',
      'border-radius:var(--radius-md);background:var(--bg-primary);',
      'addEventListener("click",function(e){e.preventDefault();});',
    ];
    let offset = 0;
    let patternIdx = 0;
    while (offset < size) {
      const pattern = patterns[patternIdx % patterns.length];
      const bytes = new TextEncoder().encode(pattern + '\n');
      const toCopy = Math.min(bytes.length, size - offset);
      buf.set(bytes.subarray(0, toCopy), offset);
      offset += toCopy;
      patternIdx++;
    }
  } else if (isAlreadyCompressed(contentType)) {
    // Binary: pseudo-random (simulates already-compressed content)
    // Use a simple LCG for deterministic "random" bytes
    let seed = 0xDEADBEEF;
    for (let i = 0; i < size; i++) {
      seed = (seed * 1664525 + 1013904223) & 0xFFFFFFFF;
      buf[i] = (seed >>> 24) & 0xFF;
    }
  } else {
    // Mixed: some structure, some randomness
    let seed = 0xCAFEBABE;
    for (let i = 0; i < size; i++) {
      if (i % 8 < 4) {
        // Structured bytes (repeating)
        buf[i] = (i * 7 + 13) & 0xFF;
      } else {
        seed = (seed * 1664525 + 1013904223) & 0xFFFFFFFF;
        buf[i] = (seed >>> 24) & 0xFF;
      }
    }
  }

  return buf;
}

/**
 * Compress a payload with the given algorithm.
 * Returns the compressed bytes (or original for 'none').
 */
export function compress(payload: Uint8Array, algo: CompressionAlgo): Uint8Array {
  switch (algo) {
    case 'none':
      return payload;

    case 'gzip':
      return new Uint8Array(gzipSync(Buffer.from(payload), {
        level: 6, // nginx default
      }));

    case 'brotli':
      return new Uint8Array(brotliCompressSync(Buffer.from(payload), {
        params: {
          [constants.BROTLI_PARAM_QUALITY]: 4, // nginx default for on-the-fly
        },
      }));
  }
}

function isTextLike(contentType: string): boolean {
  return (
    contentType.startsWith('text/') ||
    contentType === 'application/javascript' ||
    contentType === 'application/json' ||
    contentType === 'image/svg+xml'
  );
}

function isAlreadyCompressed(contentType: string): boolean {
  return (
    contentType === 'image/webp' ||
    contentType === 'image/png' ||
    contentType === 'image/jpeg' ||
    contentType === 'font/woff2' ||
    contentType === 'font/woff'
  );
}
