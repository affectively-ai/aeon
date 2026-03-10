/*
 * ngx_aeon_flow_module.c — nginx module for Aeon Flow Protocol
 *
 * Translates between HTTP (client-facing) and Aeon Flow (backend-facing).
 *
 * Directives:
 *   aeon_flow_pass <upstream>       — proxy to Aeon Flow backend
 *   aeon_flow_fork on|off           — fork child streams per sub-resource
 *   aeon_flow_race on|off           — race cache vs origin
 *   aeon_flow_collapse on|off       — collapse forked responses
 *   aeon_flow_compress none|gzip|brotli — payload compression
 *   aeon_flow_esi on|off            — ESI fragment assembly via fork
 *   aeon_flow_max_streams <n>       — max concurrent streams per connection
 *   aeon_flow_high_water_mark <n>   — backpressure threshold
 *   aeon_flow_keepalive <n>         — keepalive connection pool size
 */

#include "ngx_aeon_flow.h"


/* ═══════════════════════════════════════════════════════════════════════════
 * Forward declarations
 * ═══════════════════════════════════════════════════════════════════════════ */

static void *ngx_aeon_flow_create_loc_conf(ngx_conf_t *cf);
static char *ngx_aeon_flow_merge_loc_conf(ngx_conf_t *cf, void *parent,
    void *child);
static char *ngx_aeon_flow_pass(ngx_conf_t *cf, ngx_command_t *cmd,
    void *conf);
static ngx_int_t ngx_aeon_flow_handler(ngx_http_request_t *r);
static void ngx_aeon_flow_read_handler(ngx_event_t *rev);
static void ngx_aeon_flow_write_handler(ngx_event_t *wev);
static void ngx_aeon_flow_cleanup(void *data);


/* ═══════════════════════════════════════════════════════════════════════════
 * Directives
 * ═══════════════════════════════════════════════════════════════════════════ */

static ngx_command_t ngx_aeon_flow_commands[] = {

    { ngx_string("aeon_flow_pass"),
      NGX_HTTP_LOC_CONF|NGX_HTTP_LIF_CONF|NGX_CONF_TAKE1,
      ngx_aeon_flow_pass,
      NGX_HTTP_LOC_CONF_OFFSET,
      0,
      NULL },

    { ngx_string("aeon_flow_fork"),
      NGX_HTTP_LOC_CONF|NGX_CONF_FLAG,
      ngx_conf_set_flag_slot,
      NGX_HTTP_LOC_CONF_OFFSET,
      offsetof(ngx_aeon_flow_loc_conf_t, fork),
      NULL },

    { ngx_string("aeon_flow_race"),
      NGX_HTTP_LOC_CONF|NGX_CONF_FLAG,
      ngx_conf_set_flag_slot,
      NGX_HTTP_LOC_CONF_OFFSET,
      offsetof(ngx_aeon_flow_loc_conf_t, race),
      NULL },

    { ngx_string("aeon_flow_collapse"),
      NGX_HTTP_LOC_CONF|NGX_CONF_FLAG,
      ngx_conf_set_flag_slot,
      NGX_HTTP_LOC_CONF_OFFSET,
      offsetof(ngx_aeon_flow_loc_conf_t, collapse),
      NULL },

    { ngx_string("aeon_flow_esi"),
      NGX_HTTP_LOC_CONF|NGX_CONF_FLAG,
      ngx_conf_set_flag_slot,
      NGX_HTTP_LOC_CONF_OFFSET,
      offsetof(ngx_aeon_flow_loc_conf_t, esi),
      NULL },

    { ngx_string("aeon_flow_compress"),
      NGX_HTTP_LOC_CONF|NGX_CONF_TAKE1,
      ngx_conf_set_str_slot,
      NGX_HTTP_LOC_CONF_OFFSET,
      offsetof(ngx_aeon_flow_loc_conf_t, compress),
      NULL },

    { ngx_string("aeon_flow_max_streams"),
      NGX_HTTP_LOC_CONF|NGX_CONF_TAKE1,
      ngx_conf_set_num_slot,
      NGX_HTTP_LOC_CONF_OFFSET,
      offsetof(ngx_aeon_flow_loc_conf_t, max_streams),
      NULL },

    { ngx_string("aeon_flow_high_water_mark"),
      NGX_HTTP_LOC_CONF|NGX_CONF_TAKE1,
      ngx_conf_set_num_slot,
      NGX_HTTP_LOC_CONF_OFFSET,
      offsetof(ngx_aeon_flow_loc_conf_t, high_water_mark),
      NULL },

    { ngx_string("aeon_flow_keepalive"),
      NGX_HTTP_LOC_CONF|NGX_CONF_TAKE1,
      ngx_conf_set_num_slot,
      NGX_HTTP_LOC_CONF_OFFSET,
      offsetof(ngx_aeon_flow_loc_conf_t, keepalive),
      NULL },

    ngx_null_command
};


/* ═══════════════════════════════════════════════════════════════════════════
 * Module context
 * ═══════════════════════════════════════════════════════════════════════════ */

static ngx_http_module_t ngx_aeon_flow_module_ctx = {
    NULL,                              /* preconfiguration */
    NULL,                              /* postconfiguration */
    NULL,                              /* create main configuration */
    NULL,                              /* init main configuration */
    NULL,                              /* create server configuration */
    NULL,                              /* merge server configuration */
    ngx_aeon_flow_create_loc_conf,     /* create location configuration */
    ngx_aeon_flow_merge_loc_conf       /* merge location configuration */
};


/* ═══════════════════════════════════════════════════════════════════════════
 * Module definition
 * ═══════════════════════════════════════════════════════════════════════════ */

ngx_module_t ngx_aeon_flow_module = {
    NGX_MODULE_V1,
    &ngx_aeon_flow_module_ctx,         /* module context */
    ngx_aeon_flow_commands,            /* module directives */
    NGX_HTTP_MODULE,                   /* module type */
    NULL,                              /* init master */
    NULL,                              /* init module */
    NULL,                              /* init process */
    NULL,                              /* init thread */
    NULL,                              /* exit thread */
    NULL,                              /* exit process */
    NULL,                              /* exit master */
    NGX_MODULE_V1_PADDING
};


/* ═══════════════════════════════════════════════════════════════════════════
 * Configuration
 * ═══════════════════════════════════════════════════════════════════════════ */

static void *
ngx_aeon_flow_create_loc_conf(ngx_conf_t *cf)
{
    ngx_aeon_flow_loc_conf_t  *conf;

    conf = ngx_pcalloc(cf->pool, sizeof(ngx_aeon_flow_loc_conf_t));
    if (conf == NULL) {
        return NULL;
    }

    conf->enable = NGX_CONF_UNSET;
    conf->max_streams = NGX_CONF_UNSET_UINT;
    conf->high_water_mark = NGX_CONF_UNSET_UINT;
    conf->keepalive = NGX_CONF_UNSET_UINT;
    conf->fork = NGX_CONF_UNSET;
    conf->race = NGX_CONF_UNSET;
    conf->collapse = NGX_CONF_UNSET;
    conf->esi = NGX_CONF_UNSET;

    return conf;
}


static char *
ngx_aeon_flow_merge_loc_conf(ngx_conf_t *cf, void *parent, void *child)
{
    ngx_aeon_flow_loc_conf_t  *prev = parent;
    ngx_aeon_flow_loc_conf_t  *conf = child;

    ngx_conf_merge_value(conf->enable, prev->enable, 0);
    ngx_conf_merge_uint_value(conf->max_streams, prev->max_streams, 256);
    ngx_conf_merge_uint_value(conf->high_water_mark, prev->high_water_mark, 64);
    ngx_conf_merge_uint_value(conf->keepalive, prev->keepalive, 64);
    ngx_conf_merge_value(conf->fork, prev->fork, 0);
    ngx_conf_merge_value(conf->race, prev->race, 0);
    ngx_conf_merge_value(conf->collapse, prev->collapse, 0);
    ngx_conf_merge_value(conf->esi, prev->esi, 0);
    ngx_conf_merge_str_value(conf->compress, prev->compress, "none");

    return NGX_CONF_OK;
}


/* ═══════════════════════════════════════════════════════════════════════════
 * aeon_flow_pass directive handler
 * ═══════════════════════════════════════════════════════════════════════════ */

static char *
ngx_aeon_flow_pass(ngx_conf_t *cf, ngx_command_t *cmd, void *conf)
{
    ngx_aeon_flow_loc_conf_t   *aflcf = conf;
    ngx_str_t                  *value;
    ngx_http_core_loc_conf_t   *clcf;

    if (aflcf->enable != NGX_CONF_UNSET) {
        return "is duplicate";
    }

    value = cf->args->elts;

    aflcf->enable = 1;

    /* Register the content handler */
    clcf = ngx_http_conf_get_module_loc_conf(cf, ngx_http_core_module);
    clcf->handler = ngx_aeon_flow_handler;

    return NGX_CONF_OK;
}


/* ═══════════════════════════════════════════════════════════════════════════
 * Request handler
 *
 * This is the entry point when nginx receives an HTTP request for a
 * location configured with aeon_flow_pass. It:
 *
 * 1. Gets or creates an Aeon Flow connection to the backend
 * 2. Opens a root stream
 * 3. Encodes the HTTP request (method, URI, headers) as an Aeon Flow frame
 * 4. If fork mode is on, waits for the backend to signal sub-resources
 * 5. Reads response frames and translates back to HTTP
 * ═══════════════════════════════════════════════════════════════════════════ */

static ngx_int_t
ngx_aeon_flow_handler(ngx_http_request_t *r)
{
    ngx_aeon_flow_loc_conf_t    *aflcf;
    ngx_aeon_flow_conn_t        *conn;
    ngx_aeon_flow_stream_t      *stream;
    ngx_aeon_flow_frame_t        frame;
    ngx_chain_t                 *cl;
    ngx_buf_t                   *b;
    ngx_pool_cleanup_t          *cln;
    size_t                       req_size;
    u_char                      *p;

    aflcf = ngx_http_get_module_loc_conf(r, ngx_aeon_flow_module);
    if (!aflcf->enable) {
        return NGX_DECLINED;
    }

    /*
     * In a full implementation, we would:
     * 1. Get a connection from the keepalive pool
     * 2. Open a stream
     * 3. Send the request as Aeon Flow frames
     * 4. Set up read/write event handlers
     * 5. Return NGX_DONE (async processing)
     *
     * For now, this is a structural skeleton that compiles and
     * demonstrates the module architecture. The actual I/O path
     * requires integration with nginx's event loop, upstream module,
     * and connection pooling — each of which is a substantial piece
     * of engineering.
     */

    /* Register cleanup to poison streams if the client disconnects */
    cln = ngx_pool_cleanup_add(r->pool, sizeof(ngx_aeon_flow_stream_t *));
    if (cln == NULL) {
        return NGX_HTTP_INTERNAL_SERVER_ERROR;
    }
    cln->handler = ngx_aeon_flow_cleanup;

    /*
     * Skeleton: encode HTTP request as Aeon Flow payload.
     *
     * Payload format (simple for v1):
     *   METHOD SP URI SP HTTP/1.1 CRLF
     *   Header: Value CRLF
     *   ...
     *   CRLF
     *
     * This is intentionally simple — a more optimized format
     * would use a binary encoding similar to HPACK but without
     * the per-connection state overhead.
     */

    /* Calculate request payload size */
    req_size = r->method_name.len + 1 + r->unparsed_uri.len + 11; /* METHOD SP URI SP HTTP/1.1\r\n */

    /* For the skeleton, just send method + URI */
    b = ngx_create_temp_buf(r->pool, req_size);
    if (b == NULL) {
        return NGX_HTTP_INTERNAL_SERVER_ERROR;
    }

    p = b->pos;
    p = ngx_cpymem(p, r->method_name.data, r->method_name.len);
    *p++ = ' ';
    p = ngx_cpymem(p, r->unparsed_uri.data, r->unparsed_uri.len);
    p = ngx_cpymem(p, " HTTP/1.1\r\n\r\n", 13);
    b->last = p;

    /*
     * At this point we would:
     *
     * frame.stream_id = stream->id;
     * frame.sequence = 0;
     * frame.flags = 0;
     * frame.length = b->last - b->pos;
     * frame.payload = b->pos;
     *
     * cl = ngx_aeon_flow_encode_chain(r->pool, &frame);
     * ngx_aeon_flow_send(conn, stream, cl, 0);
     * ngx_aeon_flow_finish(conn, stream);
     *
     * Then set up the read handler to receive response frames
     * and translate them back to HTTP.
     */

    /* For now, return 501 — module is structurally complete but
     * needs the I/O event loop integration to actually proxy. */
    return NGX_HTTP_NOT_IMPLEMENTED;
}


/* ═══════════════════════════════════════════════════════════════════════════
 * Event handlers (skeleton)
 * ═══════════════════════════════════════════════════════════════════════════ */

static void
ngx_aeon_flow_read_handler(ngx_event_t *rev)
{
    ngx_connection_t        *c;
    ngx_aeon_flow_conn_t    *conn;
    ngx_aeon_flow_frame_t    frame;
    ssize_t                  n;
    size_t                   consumed;
    u_char                  *p;

    c = rev->data;
    conn = c->data;

    /* Read into the receive buffer */
    n = c->recv(c, conn->recv_buf->last,
                conn->recv_buf->end - conn->recv_buf->last);

    if (n == NGX_AGAIN) {
        return;
    }

    if (n <= 0) {
        /* Connection closed or error */
        conn->close = 1;
        return;
    }

    conn->recv_buf->last += n;

    /* Decode frames from the buffer */
    p = conn->recv_buf->pos;

    while ((size_t)(conn->recv_buf->last - p) >= NGX_AEON_FLOW_HEADER_SIZE) {
        ngx_int_t rc;

        rc = ngx_aeon_flow_decode(p, conn->recv_buf->last - p,
                                   &frame, &consumed);

        if (rc == NGX_AGAIN) {
            break;  /* Incomplete frame, wait for more data */
        }

        if (rc == NGX_ERROR) {
            conn->close = 1;
            return;
        }

        /* Dispatch frame to the appropriate stream */
        if (frame.stream_id < conn->streams_size
            && conn->streams[frame.stream_id] != NULL)
        {
            ngx_aeon_flow_stream_t *stream = conn->streams[frame.stream_id];

            if (frame.flags & NGX_AEON_FLOW_POISON) {
                stream->state = NGX_AEON_STREAM_POISONED;
                /* TODO: notify the HTTP request handler */
            } else if (frame.flags & NGX_AEON_FLOW_FIN) {
                stream->state = NGX_AEON_STREAM_CLOSED;
                /* TODO: finalize HTTP response */
            } else {
                /* Data frame — accumulate into stream results */
                /* TODO: build HTTP response body from payload */
            }
        }

        p += consumed;
    }

    /* Compact the receive buffer */
    if (p > conn->recv_buf->pos) {
        size_t remaining = conn->recv_buf->last - p;
        if (remaining > 0) {
            ngx_memmove(conn->recv_buf->pos, p, remaining);
        }
        conn->recv_buf->last = conn->recv_buf->pos + remaining;
    }
}


static void
ngx_aeon_flow_write_handler(ngx_event_t *wev)
{
    ngx_connection_t        *c;
    ngx_aeon_flow_conn_t    *conn;

    c = wev->data;
    conn = c->data;

    if (conn->send_chain == NULL) {
        return;  /* Nothing to send */
    }

    /* Send queued frames */
    conn->send_chain = c->send_chain(c, conn->send_chain, 0);

    if (conn->send_chain == NULL) {
        conn->send_chain_last = &conn->send_chain;
    }
}


/* ═══════════════════════════════════════════════════════════════════════════
 * Cleanup: poison streams when client disconnects
 * ═══════════════════════════════════════════════════════════════════════════ */

static void
ngx_aeon_flow_cleanup(void *data)
{
    ngx_aeon_flow_stream_t  *stream = *(ngx_aeon_flow_stream_t **)data;

    if (stream != NULL && stream->conn != NULL) {
        ngx_aeon_flow_poison(stream->conn, stream);

        /* Flush poison frames */
        if (stream->conn->send_chain != NULL
            && stream->conn->connection != NULL)
        {
            stream->conn->connection->send_chain(
                stream->conn->connection,
                stream->conn->send_chain, 0);
        }
    }
}
