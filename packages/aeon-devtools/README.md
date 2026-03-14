# Aeon Flow Inspector  --  Chrome DevTools Extension

A Chrome DevTools panel that decodes Aeon Flow binary frames into a visual waterfall, stream tree, and frame-by-frame inspector. The Network tab replacement for Aeon Flow.

## Install

1. Open `chrome://extensions`
2. Enable "Developer mode"
3. Click "Load unpacked"
4. Select the `aeon-devtools/` directory

## Panels

### Waterfall

Timeline view of all Aeon Flow frames  --  the equivalent of Chrome's Network waterfall tab. Each frame shows:

- Timestamp (ms from connection start)
- Stream ID
- Sequence number
- Frame type (DATA, FORK, FIN, VENT, RACE, FOLD)
- Payload size
- Visual timeline bar with color coding:
  - Blue: DATA
  - Green: FORK
  - Blue-light: FIN
  - Red: VENT
  - Yellow: RACE
  - Purple: FOLD

### Stream Tree

Hierarchical view of all streams. FORK frames create parent→child relationships, displayed as a tree. Each node shows:

- Stream ID
- State (OPEN / CLOSED / VENTED)
- Frame count and bytes received

### Frames

Detailed frame-by-frame inspector. Each frame can be expanded to show:

- Full header fields (stream_id, sequence, flags, length)
- Payload preview (text for HTTP-like payloads, hex dump for binary)

### Stats

Protocol statistics:

- Total frames (sent/received breakdown)
- Frame type counts (DATA, FORK, FIN, VENT)
- Payload bytes vs framing overhead (with percentage)
- Total wire bytes
- Active/closed/vented stream counts
- Duration and throughput

## How It Works

The extension uses Chrome's Debugger API to intercept WebSocket binary frames (`Network.webSocketFrameReceived` / `Network.webSocketFrameSent`). Each binary frame is decoded as an Aeon Flow 10-byte header + payload using the same codec as the TypeScript and C implementations.

When Aeon Flow runs over a WebSocket transport (e.g., browser↔server), the extension captures every frame in real-time and renders the four panel views.

## Structure

```
├── manifest.json       Chrome extension manifest (MV3)
├── devtools.html        DevTools page (creates the panel)
├── devtools.js          Panel creation
├── panel.html           Panel UI with tabs
├── icons/               Extension icons
└── src/
    ├── codec.js          Aeon Flow frame decoder (JS port)
    └── panel.js          Panel controller (state, rendering, WebSocket interception)
```

## See Also

- [`wall`](../wall/)  --  CLI tool for Aeon Flow (curl equivalent)
- [`nginx-aeon-flow`](../nginx-aeon-flow/)  --  HTTP → Aeon Flow nginx module
- [`nginx-flow-aeon`](../nginx-flow-aeon/)  --  Aeon Flow → HTTP nginx module
