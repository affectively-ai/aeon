/**
 * Aeon Flow frame decoder for the DevTools panel.
 *
 * Decodes the 10-byte binary frame header and extracts:
 *   [0..1]  stream_id  u16 big-endian
 *   [2..5]  sequence   u32 big-endian
 *   [6]     flags      u8
 *   [7..9]  length     u24 big-endian
 *   [10..]  payload
 */

const AEON_HEADER_SIZE = 10;

const AEON_FLAGS = {
  FORK:     0x01,
  RACE:     0x02,
  COLLAPSE: 0x04,
  POISON:   0x08,
  FIN:      0x10,
};

function decodeAeonFrame(buffer, offset = 0) {
  const view = new DataView(buffer, offset);

  if (buffer.byteLength - offset < AEON_HEADER_SIZE) {
    return null; // incomplete
  }

  const streamId = view.getUint16(0);
  const sequence = view.getUint32(2);
  const flags = view.getUint8(6);
  const length = (view.getUint8(7) << 16) | (view.getUint8(8) << 8) | view.getUint8(9);

  const total = AEON_HEADER_SIZE + length;
  if (buffer.byteLength - offset < total) {
    return null; // incomplete payload
  }

  const payload = length > 0
    ? new Uint8Array(buffer, offset + AEON_HEADER_SIZE, length)
    : null;

  return {
    streamId,
    sequence,
    flags,
    length,
    payload,
    totalBytes: total,
    flagNames: getFlagNames(flags),
    flagClass: getFlagClass(flags),
  };
}

function decodeAllFrames(buffer) {
  const frames = [];
  let offset = 0;

  while (offset < buffer.byteLength) {
    const frame = decodeAeonFrame(buffer, offset);
    if (!frame) break;
    frames.push(frame);
    offset += frame.totalBytes;
  }

  return frames;
}

function getFlagNames(flags) {
  const parts = [];
  if (flags & AEON_FLAGS.FORK) parts.push('FORK');
  if (flags & AEON_FLAGS.RACE) parts.push('RACE');
  if (flags & AEON_FLAGS.COLLAPSE) parts.push('COLLAPSE');
  if (flags & AEON_FLAGS.POISON) parts.push('POISON');
  if (flags & AEON_FLAGS.FIN) parts.push('FIN');
  if (parts.length === 0) parts.push('DATA');
  return parts.join('|');
}

function getFlagClass(flags) {
  if (flags & AEON_FLAGS.FORK) return 'fork';
  if (flags & AEON_FLAGS.POISON) return 'poison';
  if (flags & AEON_FLAGS.FIN) return 'fin';
  if (flags & AEON_FLAGS.RACE) return 'race';
  if (flags & AEON_FLAGS.COLLAPSE) return 'collapse';
  return 'data';
}

function payloadPreview(payload, maxLen = 200) {
  if (!payload || payload.length === 0) return '';

  // Try to decode as UTF-8 text
  try {
    const text = new TextDecoder().decode(payload);
    // Check if it looks like text (printable ASCII ratio)
    let printable = 0;
    for (let i = 0; i < Math.min(text.length, 100); i++) {
      const c = text.charCodeAt(i);
      if ((c >= 32 && c < 127) || c === 10 || c === 13 || c === 9) printable++;
    }
    if (printable / Math.min(text.length, 100) > 0.8) {
      return text.substring(0, maxLen) + (text.length > maxLen ? '...' : '');
    }
  } catch (_) {}

  // Binary: show hex dump
  const hex = Array.from(payload.slice(0, Math.min(payload.length, maxLen / 3)))
    .map(b => b.toString(16).padStart(2, '0'))
    .join(' ');
  return hex + (payload.length > maxLen / 3 ? ' ...' : '');
}
