/**
 * Aeon Flow DevTools Panel Controller
 *
 * Captures WebSocket binary frames, decodes them as Aeon Flow protocol,
 * and renders:
 *   - Waterfall: timeline view of all frames (like Network tab)
 *   - Stream Tree: hierarchical view of streams (parent→children via FORK)
 *   - Frames: detailed frame-by-frame inspector
 *   - Stats: protocol overhead, throughput, stream utilization
 */

// ═══════════════════════════════════════════════════════════════════════════════
// State
// ═══════════════════════════════════════════════════════════════════════════════

const state = {
  frames: [],        // { frame, timestamp, direction, rawBytes }
  streams: {},       // streamId → { state, parent, children, frames, bytesReceived }
  recording: true,
  startTime: null,
};

// ═══════════════════════════════════════════════════════════════════════════════
// Tab switching
// ═══════════════════════════════════════════════════════════════════════════════

document.querySelectorAll('.tabs button').forEach(btn => {
  btn.addEventListener('click', () => {
    document.querySelectorAll('.tabs button').forEach(b => b.classList.remove('active'));
    document.querySelectorAll('.panel').forEach(p => p.classList.remove('active'));
    btn.classList.add('active');
    document.getElementById('panel-' + btn.dataset.panel).classList.add('active');
  });
});

// ═══════════════════════════════════════════════════════════════════════════════
// Toolbar
// ═══════════════════════════════════════════════════════════════════════════════

document.getElementById('btn-record').addEventListener('click', function () {
  state.recording = !state.recording;
  this.textContent = state.recording ? '● Record' : '○ Paused';
  this.style.color = state.recording ? '#f38ba8' : 'var(--text-dim)';
});

document.getElementById('btn-clear').addEventListener('click', () => {
  state.frames = [];
  state.streams = {};
  state.startTime = null;
  renderAll();
  document.getElementById('status').textContent = 'Cleared. Waiting for frames...';
});

document.getElementById('btn-export').addEventListener('click', () => {
  const data = {
    frames: state.frames.map(f => ({
      streamId: f.frame.streamId,
      sequence: f.frame.sequence,
      flags: f.frame.flags,
      flagNames: f.frame.flagNames,
      length: f.frame.length,
      timestamp: f.timestamp,
      direction: f.direction,
    })),
    streams: Object.entries(state.streams).map(([id, s]) => ({
      streamId: parseInt(id),
      state: s.state,
      parent: s.parent,
      children: s.children,
      framesCount: s.frames.length,
      bytesReceived: s.bytesReceived,
    })),
  };
  const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `aeon-flow-capture-${Date.now()}.json`;
  a.click();
  URL.revokeObjectURL(url);
});

// ═══════════════════════════════════════════════════════════════════════════════
// Frame ingestion
// ═══════════════════════════════════════════════════════════════════════════════

function ingestFrame(frame, direction, timestamp) {
  if (!state.recording) return;

  if (!state.startTime) state.startTime = timestamp;

  const entry = { frame, direction, timestamp, elapsed: timestamp - state.startTime };
  state.frames.push(entry);

  // Track stream state
  const sid = frame.streamId;
  if (!state.streams[sid]) {
    state.streams[sid] = {
      state: 'open',
      parent: null,
      children: [],
      frames: [],
      bytesReceived: 0,
    };
  }

  const stream = state.streams[sid];
  stream.frames.push(entry);

  if (direction === 'recv' && frame.length > 0) {
    stream.bytesReceived += frame.length;
  }

  // Update stream state based on flags
  if (frame.flags & AEON_FLAGS.FIN) {
    stream.state = 'closed';
  }
  if (frame.flags & AEON_FLAGS.POISON) {
    stream.state = 'poisoned';
  }
  if (frame.flags & AEON_FLAGS.FORK) {
    // Parse child stream IDs from payload
    if (frame.payload && frame.payload.length >= 2) {
      const view = new DataView(frame.payload.buffer, frame.payload.byteOffset, frame.payload.byteLength);
      for (let i = 0; i < frame.payload.length; i += 2) {
        const childId = view.getUint16(i);
        stream.children.push(childId);

        // Ensure child stream exists
        if (!state.streams[childId]) {
          state.streams[childId] = {
            state: 'open',
            parent: sid,
            children: [],
            frames: [],
            bytesReceived: 0,
          };
        } else {
          state.streams[childId].parent = sid;
        }
      }
    }
  }

  renderAll();
  updateStatus();
}

// ═══════════════════════════════════════════════════════════════════════════════
// Rendering
// ═══════════════════════════════════════════════════════════════════════════════

function renderAll() {
  renderWaterfall();
  renderTree();
  renderFrames();
  renderStats();
}

function renderWaterfall() {
  const body = document.getElementById('waterfall-body');
  if (state.frames.length === 0) {
    body.innerHTML = '<p style="color: var(--text-dim); padding: 16px;">No frames captured yet.</p>';
    return;
  }

  const maxElapsed = state.frames[state.frames.length - 1].elapsed || 1;

  body.innerHTML = state.frames.map(entry => {
    const f = entry.frame;
    const pct = (entry.elapsed / maxElapsed) * 100;
    const widthPct = Math.max(2, (f.length / (maxElapsed + 1)) * 30);
    const barColor = getBarColor(f.flags);

    return `<div class="waterfall-row ${entry.direction}">
      <span>${entry.elapsed.toFixed(1)}ms</span>
      <span>${f.streamId}</span>
      <span>${f.sequence}</span>
      <span class="flag-${f.flagClass}">${f.flagNames}</span>
      <span>${f.length}</span>
      <span>
        <div class="bar" style="
          margin-left: ${pct}%;
          width: ${widthPct}%;
          background: ${barColor};
        "></div>
      </span>
    </div>`;
  }).join('');
}

function getBarColor(flags) {
  if (flags & AEON_FLAGS.FORK) return 'var(--fork)';
  if (flags & AEON_FLAGS.POISON) return 'var(--poison)';
  if (flags & AEON_FLAGS.FIN) return 'var(--fin)';
  if (flags & AEON_FLAGS.RACE) return 'var(--race)';
  if (flags & AEON_FLAGS.COLLAPSE) return 'var(--collapse)';
  return 'var(--accent)';
}

function renderTree() {
  const body = document.getElementById('tree-body');

  // Find root streams (no parent)
  const roots = Object.entries(state.streams)
    .filter(([_, s]) => s.parent === null)
    .map(([id]) => parseInt(id));

  if (roots.length === 0) {
    body.innerHTML = '<p style="color: var(--text-dim); padding: 16px;">No streams captured yet.</p>';
    return;
  }

  body.innerHTML = roots.map(id => renderStreamNode(id, 0)).join('');
}

function renderStreamNode(streamId, depth) {
  const stream = state.streams[streamId];
  if (!stream) return '';

  const stateClass = stream.state;
  const indent = depth * 24;

  let html = `<div class="stream-node ${stateClass}" style="margin-left: ${indent}px;">
    <span class="stream-id">Stream ${streamId}</span>
    <span class="stream-state ${stateClass}">${stream.state.toUpperCase()}</span>
    <span style="color: var(--text-dim); margin-left: 8px;">
      ${stream.frames.length} frames, ${formatBytes(stream.bytesReceived)}
    </span>
  </div>`;

  if (stream.children.length > 0) {
    html += '<div class="stream-children">';
    html += stream.children.map(cid => renderStreamNode(cid, depth + 1)).join('');
    html += '</div>';
  }

  return html;
}

function renderFrames() {
  const body = document.getElementById('frames-body');

  if (state.frames.length === 0) {
    body.innerHTML = '<p style="color: var(--text-dim); padding: 16px;">No frames captured yet.</p>';
    return;
  }

  body.innerHTML = state.frames.map((entry, i) => {
    const f = entry.frame;
    const preview = f.payload ? payloadPreview(f.payload) : '';

    return `<div class="frame-item ${f.flagClass}">
      <div class="frame-header">
        <span>#${i}</span>
        <span>${entry.elapsed.toFixed(1)}ms</span>
        <span>${entry.direction === 'send' ? '>>>' : '<<<'}</span>
        <span>stream=${f.streamId}</span>
        <span>seq=${f.sequence}</span>
        <span class="flag-${f.flagClass}">${f.flagNames}</span>
        <span>${f.length} bytes</span>
      </div>
      ${preview ? `<div class="frame-payload">${escapeHtml(preview)}</div>` : ''}
    </div>`;
  }).join('');
}

function renderStats() {
  const body = document.getElementById('stats-body');

  if (state.frames.length === 0) {
    body.innerHTML = '<p style="color: var(--text-dim);">No data yet.</p>';
    return;
  }

  const totalFrames = state.frames.length;
  const sentFrames = state.frames.filter(f => f.direction === 'send').length;
  const recvFrames = totalFrames - sentFrames;

  const totalPayload = state.frames.reduce((sum, f) => sum + f.frame.length, 0);
  const totalOverhead = totalFrames * AEON_HEADER_SIZE;
  const totalWire = totalPayload + totalOverhead;
  const overheadPct = totalWire > 0 ? (totalOverhead / totalWire * 100).toFixed(2) : '0';

  const totalStreams = Object.keys(state.streams).length;
  const openStreams = Object.values(state.streams).filter(s => s.state === 'open').length;
  const closedStreams = Object.values(state.streams).filter(s => s.state === 'closed').length;
  const poisonedStreams = Object.values(state.streams).filter(s => s.state === 'poisoned').length;

  const forkFrames = state.frames.filter(f => f.frame.flags & AEON_FLAGS.FORK).length;
  const poisonFrames = state.frames.filter(f => f.frame.flags & AEON_FLAGS.POISON).length;
  const finFrames = state.frames.filter(f => f.frame.flags & AEON_FLAGS.FIN).length;
  const dataFrames = state.frames.filter(f => f.frame.flags === 0 && f.frame.length > 0).length;

  const elapsed = state.frames[state.frames.length - 1].elapsed;

  body.innerHTML = `
    <div class="stat-row"><span class="stat-label">Total frames</span><span class="stat-value">${totalFrames} (${sentFrames} sent, ${recvFrames} received)</span></div>
    <div class="stat-row"><span class="stat-label">DATA frames</span><span class="stat-value">${dataFrames}</span></div>
    <div class="stat-row"><span class="stat-label">FORK frames</span><span class="stat-value">${forkFrames}</span></div>
    <div class="stat-row"><span class="stat-label">FIN frames</span><span class="stat-value">${finFrames}</span></div>
    <div class="stat-row"><span class="stat-label">POISON frames</span><span class="stat-value">${poisonFrames}</span></div>
    <div class="stat-row"><span class="stat-label">Payload bytes</span><span class="stat-value">${formatBytes(totalPayload)}</span></div>
    <div class="stat-row"><span class="stat-label">Framing overhead</span><span class="stat-value">${formatBytes(totalOverhead)} (${overheadPct}%)</span></div>
    <div class="stat-row"><span class="stat-label">Total wire bytes</span><span class="stat-value">${formatBytes(totalWire)}</span></div>
    <div class="stat-row"><span class="stat-label">Streams</span><span class="stat-value">${totalStreams} total (${openStreams} open, ${closedStreams} closed, ${poisonedStreams} poisoned)</span></div>
    <div class="stat-row"><span class="stat-label">Duration</span><span class="stat-value">${elapsed.toFixed(1)}ms</span></div>
    <div class="stat-row"><span class="stat-label">Throughput</span><span class="stat-value">${elapsed > 0 ? formatBytes(totalPayload / (elapsed / 1000)) + '/s' : 'N/A'}</span></div>
  `;
}

// ═══════════════════════════════════════════════════════════════════════════════
// Utilities
// ═══════════════════════════════════════════════════════════════════════════════

function formatBytes(bytes) {
  if (bytes < 1024) return bytes + ' B';
  if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + ' KB';
  return (bytes / (1024 * 1024)).toFixed(2) + ' MB';
}

function escapeHtml(str) {
  return str.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}

function updateStatus() {
  const n = state.frames.length;
  const streams = Object.keys(state.streams).length;
  document.getElementById('status').textContent =
    `${n} frames, ${streams} streams`;
}

// ═══════════════════════════════════════════════════════════════════════════════
// WebSocket interception via Chrome Debugger API
// ═══════════════════════════════════════════════════════════════════════════════

const tabId = chrome.devtools.inspectedWindow.tabId;

// Attach the debugger to intercept WebSocket frames
chrome.debugger.attach({ tabId }, '1.3', () => {
  chrome.debugger.sendCommand({ tabId }, 'Network.enable', {});
});

chrome.debugger.onEvent.addListener((source, method, params) => {
  if (source.tabId !== tabId) return;

  // Intercept WebSocket frame events
  if (method === 'Network.webSocketFrameReceived') {
    handleWebSocketFrame(params, 'recv');
  }
  if (method === 'Network.webSocketFrameSent') {
    handleWebSocketFrame(params, 'send');
  }
});

function handleWebSocketFrame(params, direction) {
  const response = params.response;
  if (!response || response.opcode !== 2) return; // only binary frames

  // Decode the binary payload as Aeon Flow frames
  try {
    const raw = atob(response.payloadData);
    const buffer = new ArrayBuffer(raw.length);
    const view = new Uint8Array(buffer);
    for (let i = 0; i < raw.length; i++) {
      view[i] = raw.charCodeAt(i);
    }

    const frames = decodeAllFrames(buffer);
    const now = performance.now();

    for (const frame of frames) {
      ingestFrame(frame, direction, now);
    }
  } catch (e) {
    // Not an Aeon Flow frame — ignore
  }
}

// Clean up debugger on panel close
window.addEventListener('unload', () => {
  chrome.debugger.detach({ tabId });
});
