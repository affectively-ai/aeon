/*
 * ngx_flow_aeon.h — Aeon Flow → HTTP translation for nginx
 *
 * The reverse direction: accepts native Aeon Flow connections on a TCP port,
 * decodes binary frames, translates them into HTTP requests to upstream
 * backends, and encodes HTTP responses back as Aeon Flow frames.
 *
 * Uses the same wire format and codec as ngx_aeon_flow_module:
 *   [0..1]  stream_id  u16 big-endian
 *   [2..5]  sequence   u32 big-endian
 *   [6]     flags      u8
 *   [7..9]  length     u24 big-endian
 *   [10..]  payload    raw bytes
 *
 * Architecture:
 *
 *   Service ──Aeon Flow──▶ nginx ──HTTP──▶ Backend
 *                           │
 *                   ngx_flow_aeon_module
 *                   (stream module, L4)
 *
 * Combined with ngx_aeon_flow_module (HTTP→Aeon Flow), nginx becomes
 * a polyglot proxy supporting all four translation directions:
 *
 *   HTTP  → HTTP       (standard nginx)
 *   HTTP  → Aeon Flow  (ngx_aeon_flow_module)
 *   Aeon  → HTTP       (ngx_flow_aeon_module)
 *   Aeon  → Aeon       (passthrough via ngx_flow_aeon with aeon_flow_pass)
 */

#ifndef _NGX_FLOW_AEON_H_
#define _NGX_FLOW_AEON_H_

#include <ngx_config.h>
#include <ngx_core.h>
#include <ngx_stream.h>
#include <ngx_http.h>

/* Reuse the codec and constants from ngx_aeon_flow_module */
#include "ngx_aeon_flow.h"


/* ═══════════════════════════════════════════════════════════════════════════
 * HTTP Bridge — translates between Aeon Flow frames and HTTP requests
 * ═══════════════════════════════════════════════════════════════════════════ */

/*
 * State for a single Aeon Flow stream being translated to HTTP.
 * Each stream maps to one HTTP request/response cycle.
 */
typedef struct {
    uint16_t                     stream_id;
    ngx_aeon_stream_state_e      state;
    uint32_t                     next_sequence;

    /* Parsed request from the first DATA frame */
    ngx_str_t                    method;
    ngx_str_t                    uri;
    ngx_array_t                 *headers;      /* array of {key, value} pairs */

    /* HTTP upstream connection for this stream */
    ngx_peer_connection_t        upstream;
    ngx_buf_t                   *http_send_buf;
    ngx_buf_t                   *http_recv_buf;

    /* HTTP response parsing state */
    ngx_int_t                    http_status;
    unsigned                     headers_parsed:1;
    unsigned                     body_started:1;
    size_t                       content_length;
    size_t                       body_received;

    /* Back-pointers */
    ngx_stream_session_t        *session;
    ngx_pool_t                  *pool;

    /* Tree relationships (for FORK) */
    uint16_t                     parent_id;
    ngx_array_t                 *children;     /* array of uint16_t */
} ngx_flow_aeon_stream_t;

/*
 * Per-connection state for an Aeon Flow client.
 */
typedef struct {
    ngx_stream_session_t        *session;
    ngx_pool_t                  *pool;

    /* Stream table: indexed by stream_id */
    ngx_flow_aeon_stream_t     **streams;
    uint16_t                     streams_size;
    uint16_t                     active_streams;

    /* Receive buffer for partial frame reads from the Aeon Flow client */
    ngx_buf_t                   *recv_buf;

    /* Send buffer for Aeon Flow frames going back to the client */
    ngx_buf_t                   *send_buf;

    unsigned                     close:1;
} ngx_flow_aeon_session_t;


/* ═══════════════════════════════════════════════════════════════════════════
 * Module configuration
 * ═══════════════════════════════════════════════════════════════════════════ */

typedef struct {
    ngx_flag_t                   enable;
    ngx_uint_t                   max_streams;
    ngx_uint_t                   high_water_mark;
    ngx_str_t                    http_upstream;   /* HTTP backend address */
    ngx_msec_t                   connect_timeout;
    ngx_msec_t                   send_timeout;
    ngx_msec_t                   read_timeout;
} ngx_flow_aeon_srv_conf_t;


/* ═══════════════════════════════════════════════════════════════════════════
 * HTTP Bridge functions (ngx_flow_aeon_http_bridge.c)
 * ═══════════════════════════════════════════════════════════════════════════ */

/**
 * Parse the first DATA frame payload into method, URI, and headers.
 * Payload format: "METHOD URI HTTP/1.1\r\nHeader: Value\r\n...\r\n"
 */
ngx_int_t ngx_flow_aeon_parse_request(ngx_flow_aeon_stream_t *stream,
    u_char *payload, size_t len);

/**
 * Build an HTTP/1.1 request buffer from parsed stream fields.
 */
ngx_buf_t *ngx_flow_aeon_build_http_request(ngx_flow_aeon_stream_t *stream);

/**
 * Parse an HTTP/1.1 response and encode as Aeon Flow DATA frames.
 * Returns the number of bytes consumed from the HTTP response buffer.
 */
ngx_int_t ngx_flow_aeon_parse_http_response(ngx_flow_aeon_stream_t *stream,
    u_char *data, size_t len, ngx_buf_t *aeon_out);

/**
 * Allocate and initialize a new stream.
 */
ngx_flow_aeon_stream_t *ngx_flow_aeon_alloc_stream(
    ngx_flow_aeon_session_t *sess, uint16_t stream_id);

/**
 * Close a stream and clean up resources.
 */
void ngx_flow_aeon_close_stream(ngx_flow_aeon_session_t *sess,
    ngx_flow_aeon_stream_t *stream);


/* Module reference */
extern ngx_module_t ngx_flow_aeon_module;

#endif /* _NGX_FLOW_AEON_H_ */
