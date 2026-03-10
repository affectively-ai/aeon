/*
 * ngx_aeon_flow.h — Aeon Flow Protocol for nginx
 *
 * Wire format: 10-byte header + payload
 *   [0..1]  stream_id  u16 big-endian
 *   [2..5]  sequence   u32 big-endian
 *   [6]     flags      u8
 *   [7..9]  length     u24 big-endian
 *   [10..]  payload    raw bytes
 */

#ifndef _NGX_AEON_FLOW_H_
#define _NGX_AEON_FLOW_H_

#include <ngx_config.h>
#include <ngx_core.h>
#include <ngx_http.h>

/* ═══════════════════════════════════════════════════════════════════════════
 * Constants
 * ═══════════════════════════════════════════════════════════════════════════ */

#define NGX_AEON_FLOW_HEADER_SIZE   10
#define NGX_AEON_FLOW_MAX_PAYLOAD   0xFFFFFF  /* 16 MB */

/* Frame flags */
#define NGX_AEON_FLOW_FORK          0x01
#define NGX_AEON_FLOW_RACE          0x02
#define NGX_AEON_FLOW_COLLAPSE      0x04
#define NGX_AEON_FLOW_POISON        0x08
#define NGX_AEON_FLOW_FIN           0x10

/* Stream states */
typedef enum {
    NGX_AEON_STREAM_OPEN = 0,
    NGX_AEON_STREAM_RACING,
    NGX_AEON_STREAM_COLLAPSING,
    NGX_AEON_STREAM_CLOSED,
    NGX_AEON_STREAM_POISONED
} ngx_aeon_stream_state_e;

/* ═══════════════════════════════════════════════════════════════════════════
 * Frame
 * ═══════════════════════════════════════════════════════════════════════════ */

typedef struct {
    uint16_t    stream_id;
    uint32_t    sequence;
    uint8_t     flags;
    uint32_t    length;       /* u24 on the wire, stored as u32 in memory */
    u_char     *payload;      /* points into the receive buffer (zerocopy) */
} ngx_aeon_flow_frame_t;

/* ═══════════════════════════════════════════════════════════════════════════
 * Stream
 * ═══════════════════════════════════════════════════════════════════════════ */

typedef struct ngx_aeon_flow_stream_s ngx_aeon_flow_stream_t;

struct ngx_aeon_flow_stream_s {
    uint16_t                     id;
    ngx_aeon_stream_state_e      state;
    uint32_t                     next_sequence;
    uint32_t                     buffered_frames;

    /* Tree relationships */
    ngx_aeon_flow_stream_t      *parent;
    ngx_array_t                 *children;   /* array of ngx_aeon_flow_stream_t* */

    /* Result accumulator (for race/collapse) */
    ngx_chain_t                 *results;
    ngx_chain_t                **results_last;
    size_t                       results_size;

    /* Back-pointer to the connection */
    struct ngx_aeon_flow_conn_s *conn;

    /* HTTP request this stream is serving (NULL for internal streams) */
    ngx_http_request_t          *request;
};

/* ═══════════════════════════════════════════════════════════════════════════
 * Connection (multiplexed)
 * ═══════════════════════════════════════════════════════════════════════════ */

typedef struct ngx_aeon_flow_conn_s {
    ngx_connection_t            *connection;    /* underlying TCP connection */
    ngx_pool_t                  *pool;

    /* Stream table: indexed by stream_id */
    ngx_aeon_flow_stream_t     **streams;
    uint16_t                     streams_size;  /* allocated table size */
    uint16_t                     next_stream_id;
    uint16_t                     active_streams;
    uint16_t                     max_concurrent_streams;

    /* Receive buffer for partial frame reads */
    ngx_buf_t                   *recv_buf;

    /* Send queue */
    ngx_chain_t                 *send_chain;
    ngx_chain_t                **send_chain_last;

    /* Backpressure */
    uint32_t                     high_water_mark;

    /* Keepalive */
    unsigned                     keepalive:1;
    unsigned                     close:1;
} ngx_aeon_flow_conn_t;

/* ═══════════════════════════════════════════════════════════════════════════
 * Module configuration
 * ═══════════════════════════════════════════════════════════════════════════ */

typedef struct {
    ngx_flag_t                   enable;
    ngx_uint_t                   max_streams;
    ngx_uint_t                   high_water_mark;
    ngx_uint_t                   keepalive;
    ngx_flag_t                   fork;
    ngx_flag_t                   race;
    ngx_flag_t                   collapse;
    ngx_flag_t                   esi;
    ngx_str_t                    compress;      /* "none", "gzip", "brotli" */
} ngx_aeon_flow_loc_conf_t;

typedef struct {
    ngx_http_upstream_conf_t     upstream;
    ngx_array_t                 *connections;   /* pool of ngx_aeon_flow_conn_t */
} ngx_aeon_flow_upstream_conf_t;

/* ═══════════════════════════════════════════════════════════════════════════
 * Codec functions (ngx_aeon_flow_codec.c)
 * ═══════════════════════════════════════════════════════════════════════════ */

/**
 * Encode a frame into a buffer.
 * Returns the number of bytes written (header_size + payload_length).
 * The caller must ensure buf has at least NGX_AEON_FLOW_HEADER_SIZE + frame->length bytes.
 */
size_t ngx_aeon_flow_encode(u_char *buf, ngx_aeon_flow_frame_t *frame);

/**
 * Decode a frame from a buffer.
 * Returns NGX_OK on success, NGX_AGAIN if buffer is incomplete,
 * NGX_ERROR if the frame is malformed.
 *
 * On success, frame->payload points into buf (zerocopy).
 */
ngx_int_t ngx_aeon_flow_decode(u_char *buf, size_t len,
    ngx_aeon_flow_frame_t *frame, size_t *bytes_consumed);

/**
 * Allocate and encode a frame into a chain link.
 * Convenience wrapper that allocates from pool.
 */
ngx_chain_t *ngx_aeon_flow_encode_chain(ngx_pool_t *pool,
    ngx_aeon_flow_frame_t *frame);

/* ═══════════════════════════════════════════════════════════════════════════
 * Upstream functions (ngx_aeon_flow_upstream.c)
 * ═══════════════════════════════════════════════════════════════════════════ */

/**
 * Get or create a connection to an Aeon Flow backend.
 */
ngx_aeon_flow_conn_t *ngx_aeon_flow_get_connection(
    ngx_http_request_t *r, ngx_aeon_flow_upstream_conf_t *conf);

/**
 * Open a new stream on a connection.
 */
ngx_aeon_flow_stream_t *ngx_aeon_flow_open_stream(
    ngx_aeon_flow_conn_t *conn, ngx_http_request_t *r);

/**
 * Fork N child streams from a parent.
 */
ngx_int_t ngx_aeon_flow_fork(ngx_aeon_flow_conn_t *conn,
    ngx_aeon_flow_stream_t *parent, ngx_uint_t count,
    ngx_aeon_flow_stream_t **children);

/**
 * Send a payload on a stream.
 */
ngx_int_t ngx_aeon_flow_send(ngx_aeon_flow_conn_t *conn,
    ngx_aeon_flow_stream_t *stream, ngx_chain_t *payload, uint8_t flags);

/**
 * Finish a stream (send FIN).
 */
ngx_int_t ngx_aeon_flow_finish(ngx_aeon_flow_conn_t *conn,
    ngx_aeon_flow_stream_t *stream);

/**
 * Poison a stream and propagate to children.
 */
ngx_int_t ngx_aeon_flow_poison(ngx_aeon_flow_conn_t *conn,
    ngx_aeon_flow_stream_t *stream);

/**
 * Release a connection back to the pool (or close it).
 */
void ngx_aeon_flow_release_connection(ngx_aeon_flow_conn_t *conn);

/* Module reference */
extern ngx_module_t ngx_aeon_flow_module;

#endif /* _NGX_AEON_FLOW_H_ */
