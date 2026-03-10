/*
 * ngx_aeon_flow_upstream.c — Upstream connection management
 *
 * Manages a pool of persistent TCP connections to Aeon Flow backends.
 * Each connection multiplexes up to max_concurrent_streams streams.
 *
 * Key design decisions:
 * - Connection pooling with keepalive (reuse connections across requests)
 * - Stream table is a flat array indexed by stream_id (fast O(1) lookup)
 * - Fork sends a single FORK frame with all child IDs packed as u16 pairs
 * - Poison propagates recursively through the stream tree
 */

#include "ngx_aeon_flow.h"


/* ═══════════════════════════════════════════════════════════════════════════
 * Connection management
 * ═══════════════════════════════════════════════════════════════════════════ */

ngx_aeon_flow_conn_t *
ngx_aeon_flow_get_connection(ngx_http_request_t *r,
    ngx_aeon_flow_upstream_conf_t *conf)
{
    ngx_aeon_flow_conn_t    *conn;
    ngx_uint_t               i;

    /* Try to find an existing connection with available stream capacity */
    if (conf->connections != NULL) {
        conn = conf->connections->elts;
        for (i = 0; i < conf->connections->nelts; i++) {
            if (conn[i].active_streams < conn[i].max_concurrent_streams
                && !conn[i].close)
            {
                return &conn[i];
            }
        }
    }

    /* No available connection — create a new one */
    /* In production, this would initiate a TCP connect to the upstream.
     * For now, we return NULL to signal the caller to establish a new
     * connection via the standard nginx upstream machinery. */
    return NULL;
}


/* ═══════════════════════════════════════════════════════════════════════════
 * Stream management
 * ═══════════════════════════════════════════════════════════════════════════ */

ngx_aeon_flow_stream_t *
ngx_aeon_flow_open_stream(ngx_aeon_flow_conn_t *conn,
    ngx_http_request_t *r)
{
    ngx_aeon_flow_stream_t  *stream;
    uint16_t                 id;

    if (conn->active_streams >= conn->max_concurrent_streams) {
        ngx_log_error(NGX_LOG_ERR, conn->connection->log, 0,
                      "aeon flow: max concurrent streams exceeded");
        return NULL;
    }

    id = conn->next_stream_id;
    conn->next_stream_id += 2;  /* even = client-initiated */

    /* Grow stream table if needed */
    if (id >= conn->streams_size) {
        uint16_t                  new_size;
        ngx_aeon_flow_stream_t  **new_table;

        new_size = (id + 1) * 2;
        if (new_size > 65535) {
            new_size = 65535;
        }

        new_table = ngx_pcalloc(conn->pool,
                                new_size * sizeof(ngx_aeon_flow_stream_t *));
        if (new_table == NULL) {
            return NULL;
        }

        if (conn->streams != NULL) {
            ngx_memcpy(new_table, conn->streams,
                       conn->streams_size * sizeof(ngx_aeon_flow_stream_t *));
        }

        conn->streams = new_table;
        conn->streams_size = new_size;
    }

    stream = ngx_pcalloc(conn->pool, sizeof(ngx_aeon_flow_stream_t));
    if (stream == NULL) {
        return NULL;
    }

    stream->id = id;
    stream->state = NGX_AEON_STREAM_OPEN;
    stream->next_sequence = 0;
    stream->buffered_frames = 0;
    stream->parent = NULL;
    stream->children = NULL;
    stream->results = NULL;
    stream->results_last = &stream->results;
    stream->results_size = 0;
    stream->conn = conn;
    stream->request = r;

    conn->streams[id] = stream;
    conn->active_streams++;

    return stream;
}


ngx_int_t
ngx_aeon_flow_fork(ngx_aeon_flow_conn_t *conn,
    ngx_aeon_flow_stream_t *parent, ngx_uint_t count,
    ngx_aeon_flow_stream_t **children)
{
    ngx_aeon_flow_frame_t    frame;
    u_char                  *payload;
    ngx_uint_t               i;
    ngx_chain_t             *cl;

    if (count < 1) {
        return NGX_ERROR;
    }

    if (conn->active_streams + count > conn->max_concurrent_streams) {
        ngx_log_error(NGX_LOG_ERR, conn->connection->log, 0,
                      "aeon flow: fork would exceed max streams (%ui + %ui > %ui)",
                      conn->active_streams, count,
                      conn->max_concurrent_streams);
        return NGX_ERROR;
    }

    /* Allocate children array on parent if needed */
    if (parent->children == NULL) {
        parent->children = ngx_array_create(conn->pool, count,
                                             sizeof(ngx_aeon_flow_stream_t *));
        if (parent->children == NULL) {
            return NGX_ERROR;
        }
    }

    /* Create child streams and build FORK payload */
    payload = ngx_pcalloc(conn->pool, count * 2);
    if (payload == NULL) {
        return NGX_ERROR;
    }

    for (i = 0; i < count; i++) {
        ngx_aeon_flow_stream_t  *child;
        ngx_aeon_flow_stream_t **child_slot;

        child = ngx_aeon_flow_open_stream(conn, parent->request);
        if (child == NULL) {
            return NGX_ERROR;
        }

        child->parent = parent;

        child_slot = ngx_array_push(parent->children);
        if (child_slot == NULL) {
            return NGX_ERROR;
        }
        *child_slot = child;

        children[i] = child;

        /* Encode child stream ID as u16 big-endian */
        payload[i * 2]     = (u_char)((child->id >> 8) & 0xFF);
        payload[i * 2 + 1] = (u_char)(child->id & 0xFF);
    }

    /* Send FORK frame on parent stream */
    frame.stream_id = parent->id;
    frame.sequence = parent->next_sequence++;
    frame.flags = NGX_AEON_FLOW_FORK;
    frame.length = (uint32_t)(count * 2);
    frame.payload = payload;

    cl = ngx_aeon_flow_encode_chain(conn->pool, &frame);
    if (cl == NULL) {
        return NGX_ERROR;
    }

    *conn->send_chain_last = cl;
    conn->send_chain_last = &cl->next;

    return NGX_OK;
}


ngx_int_t
ngx_aeon_flow_send(ngx_aeon_flow_conn_t *conn,
    ngx_aeon_flow_stream_t *stream, ngx_chain_t *payload, uint8_t flags)
{
    ngx_aeon_flow_frame_t    frame;
    ngx_chain_t             *cl;
    ngx_buf_t               *b;
    size_t                   payload_size;

    if (stream->state == NGX_AEON_STREAM_CLOSED
        || stream->state == NGX_AEON_STREAM_POISONED)
    {
        return NGX_ERROR;
    }

    /* Backpressure check */
    if (stream->buffered_frames >= conn->high_water_mark) {
        ngx_log_error(NGX_LOG_WARN, conn->connection->log, 0,
                      "aeon flow: stream %ui backpressure (%ui frames)",
                      (ngx_uint_t)stream->id,
                      (ngx_uint_t)stream->buffered_frames);
        return NGX_AGAIN;
    }

    /* Calculate total payload size from chain */
    payload_size = 0;
    for (cl = payload; cl != NULL; cl = cl->next) {
        b = cl->buf;
        payload_size += b->last - b->pos;
    }

    if (payload_size > NGX_AEON_FLOW_MAX_PAYLOAD) {
        ngx_log_error(NGX_LOG_ERR, conn->connection->log, 0,
                      "aeon flow: payload too large (%uz bytes)", payload_size);
        return NGX_ERROR;
    }

    /* Build frame — for now, copy payload into a contiguous buffer.
     * Future optimization: scatter-gather with writev. */
    frame.stream_id = stream->id;
    frame.sequence = stream->next_sequence++;
    frame.flags = flags;
    frame.length = (uint32_t)payload_size;

    if (payload_size > 0) {
        u_char  *p;

        frame.payload = ngx_palloc(conn->pool, payload_size);
        if (frame.payload == NULL) {
            return NGX_ERROR;
        }

        p = frame.payload;
        for (cl = payload; cl != NULL; cl = cl->next) {
            b = cl->buf;
            p = ngx_cpymem(p, b->pos, b->last - b->pos);
        }
    } else {
        frame.payload = NULL;
    }

    cl = ngx_aeon_flow_encode_chain(conn->pool, &frame);
    if (cl == NULL) {
        return NGX_ERROR;
    }

    *conn->send_chain_last = cl;
    conn->send_chain_last = &cl->next;

    stream->buffered_frames++;

    return NGX_OK;
}


ngx_int_t
ngx_aeon_flow_finish(ngx_aeon_flow_conn_t *conn,
    ngx_aeon_flow_stream_t *stream)
{
    ngx_aeon_flow_frame_t    frame;
    ngx_chain_t             *cl;

    if (stream->state == NGX_AEON_STREAM_CLOSED
        || stream->state == NGX_AEON_STREAM_POISONED)
    {
        return NGX_OK;  /* already done */
    }

    frame.stream_id = stream->id;
    frame.sequence = stream->next_sequence++;
    frame.flags = NGX_AEON_FLOW_FIN;
    frame.length = 0;
    frame.payload = NULL;

    cl = ngx_aeon_flow_encode_chain(conn->pool, &frame);
    if (cl == NULL) {
        return NGX_ERROR;
    }

    *conn->send_chain_last = cl;
    conn->send_chain_last = &cl->next;

    stream->state = NGX_AEON_STREAM_CLOSED;
    conn->active_streams--;

    return NGX_OK;
}


ngx_int_t
ngx_aeon_flow_poison(ngx_aeon_flow_conn_t *conn,
    ngx_aeon_flow_stream_t *stream)
{
    ngx_aeon_flow_frame_t    frame;
    ngx_chain_t             *cl;
    ngx_uint_t               i;

    if (stream->state == NGX_AEON_STREAM_CLOSED
        || stream->state == NGX_AEON_STREAM_POISONED)
    {
        return NGX_OK;  /* already dead */
    }

    /* Send POISON frame */
    frame.stream_id = stream->id;
    frame.sequence = stream->next_sequence++;
    frame.flags = NGX_AEON_FLOW_POISON;
    frame.length = 0;
    frame.payload = NULL;

    cl = ngx_aeon_flow_encode_chain(conn->pool, &frame);
    if (cl == NULL) {
        return NGX_ERROR;
    }

    *conn->send_chain_last = cl;
    conn->send_chain_last = &cl->next;

    stream->state = NGX_AEON_STREAM_POISONED;
    conn->active_streams--;

    /* Recursively poison children */
    if (stream->children != NULL) {
        ngx_aeon_flow_stream_t **child;

        child = stream->children->elts;
        for (i = 0; i < stream->children->nelts; i++) {
            ngx_aeon_flow_poison(conn, child[i]);
        }
    }

    return NGX_OK;
}


void
ngx_aeon_flow_release_connection(ngx_aeon_flow_conn_t *conn)
{
    if (conn->close || conn->active_streams > 0) {
        /* Connection should be closed or has active work */
        if (conn->close && conn->active_streams == 0) {
            ngx_close_connection(conn->connection);
        }
        return;
    }

    /* Return to keepalive pool — the connection is ready for reuse */
    conn->keepalive = 1;
}
