/*
 * ngx_flow_aeon_module.c — nginx stream module for Aeon Flow → HTTP
 *
 * Accepts native Aeon Flow binary connections on a TCP port,
 * translates each stream's DATA frames into HTTP/1.1 requests
 * to upstream backends, and encodes HTTP responses back as
 * Aeon Flow frames to the client.
 *
 * This is a stream module (L4) because Aeon Flow is its own binary
 * protocol, not HTTP. The nginx stream subsystem handles raw TCP.
 *
 * Configuration:
 *
 *   stream {
 *       server {
 *           listen 4001;
 *           flow_aeon on;
 *           flow_aeon_http_upstream 127.0.0.1:8080;
 *           flow_aeon_max_streams 256;
 *       }
 *   }
 *
 * Request flow:
 *
 *   1. Aeon Flow client connects on TCP port
 *   2. Client opens streams (DATA frames with request payloads)
 *   3. For each stream: parse request, connect to HTTP upstream, forward
 *   4. Read HTTP response, encode as Aeon Flow DATA frames + FIN
 *   5. Handle FORK: open child streams, each maps to an HTTP request
 *   6. Handle POISON: cancel in-flight HTTP requests, close connections
 *
 * Directives:
 *   flow_aeon on|off                    — enable Aeon Flow listener
 *   flow_aeon_http_upstream <addr:port> — HTTP backend address
 *   flow_aeon_max_streams <n>           — max concurrent streams (default 256)
 *   flow_aeon_connect_timeout <ms>      — upstream connect timeout
 *   flow_aeon_send_timeout <ms>         — upstream send timeout
 *   flow_aeon_read_timeout <ms>         — upstream read timeout
 */

#include "ngx_flow_aeon.h"


/* ═══════════════════════════════════════════════════════════════════════════
 * Forward declarations
 * ═══════════════════════════════════════════════════════════════════════════ */

static void *ngx_flow_aeon_create_srv_conf(ngx_conf_t *cf);
static char *ngx_flow_aeon_merge_srv_conf(ngx_conf_t *cf, void *parent,
    void *child);
static char *ngx_flow_aeon_enable(ngx_conf_t *cf, ngx_command_t *cmd,
    void *conf);
static void ngx_flow_aeon_handler(ngx_stream_session_t *s);
static void ngx_flow_aeon_read_handler(ngx_event_t *rev);
static void ngx_flow_aeon_upstream_read_handler(ngx_event_t *rev);
static void ngx_flow_aeon_write_handler(ngx_event_t *wev);
static ngx_int_t ngx_flow_aeon_connect_upstream(ngx_flow_aeon_session_t *sess,
    ngx_flow_aeon_stream_t *stream, ngx_flow_aeon_srv_conf_t *conf);
static void ngx_flow_aeon_poison_stream(ngx_flow_aeon_session_t *sess,
    ngx_flow_aeon_stream_t *stream);
static void ngx_flow_aeon_send_fin(ngx_flow_aeon_session_t *sess,
    ngx_flow_aeon_stream_t *stream);


/* ═══════════════════════════════════════════════════════════════════════════
 * Directives
 * ═══════════════════════════════════════════════════════════════════════════ */

static ngx_command_t ngx_flow_aeon_commands[] = {

    { ngx_string("flow_aeon"),
      NGX_STREAM_SRV_CONF|NGX_CONF_FLAG,
      ngx_flow_aeon_enable,
      NGX_STREAM_SRV_CONF_OFFSET,
      offsetof(ngx_flow_aeon_srv_conf_t, enable),
      NULL },

    { ngx_string("flow_aeon_http_upstream"),
      NGX_STREAM_SRV_CONF|NGX_CONF_TAKE1,
      ngx_conf_set_str_slot,
      NGX_STREAM_SRV_CONF_OFFSET,
      offsetof(ngx_flow_aeon_srv_conf_t, http_upstream),
      NULL },

    { ngx_string("flow_aeon_max_streams"),
      NGX_STREAM_SRV_CONF|NGX_CONF_TAKE1,
      ngx_conf_set_num_slot,
      NGX_STREAM_SRV_CONF_OFFSET,
      offsetof(ngx_flow_aeon_srv_conf_t, max_streams),
      NULL },

    { ngx_string("flow_aeon_connect_timeout"),
      NGX_STREAM_SRV_CONF|NGX_CONF_TAKE1,
      ngx_conf_set_msec_slot,
      NGX_STREAM_SRV_CONF_OFFSET,
      offsetof(ngx_flow_aeon_srv_conf_t, connect_timeout),
      NULL },

    { ngx_string("flow_aeon_send_timeout"),
      NGX_STREAM_SRV_CONF|NGX_CONF_TAKE1,
      ngx_conf_set_msec_slot,
      NGX_STREAM_SRV_CONF_OFFSET,
      offsetof(ngx_flow_aeon_srv_conf_t, send_timeout),
      NULL },

    { ngx_string("flow_aeon_read_timeout"),
      NGX_STREAM_SRV_CONF|NGX_CONF_TAKE1,
      ngx_conf_set_msec_slot,
      NGX_STREAM_SRV_CONF_OFFSET,
      offsetof(ngx_flow_aeon_srv_conf_t, read_timeout),
      NULL },

    ngx_null_command
};


/* ═══════════════════════════════════════════════════════════════════════════
 * Module context
 * ═══════════════════════════════════════════════════════════════════════════ */

static ngx_stream_module_t ngx_flow_aeon_module_ctx = {
    NULL,                              /* preconfiguration */
    NULL,                              /* postconfiguration */
    NULL,                              /* create main configuration */
    NULL,                              /* init main configuration */
    ngx_flow_aeon_create_srv_conf,     /* create server configuration */
    ngx_flow_aeon_merge_srv_conf       /* merge server configuration */
};


/* ═══════════════════════════════════════════════════════════════════════════
 * Module definition
 * ═══════════════════════════════════════════════════════════════════════════ */

ngx_module_t ngx_flow_aeon_module = {
    NGX_MODULE_V1,
    &ngx_flow_aeon_module_ctx,         /* module context */
    ngx_flow_aeon_commands,            /* module directives */
    NGX_STREAM_MODULE,                 /* module type */
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
ngx_flow_aeon_create_srv_conf(ngx_conf_t *cf)
{
    ngx_flow_aeon_srv_conf_t  *conf;

    conf = ngx_pcalloc(cf->pool, sizeof(ngx_flow_aeon_srv_conf_t));
    if (conf == NULL) {
        return NULL;
    }

    conf->enable = NGX_CONF_UNSET;
    conf->max_streams = NGX_CONF_UNSET_UINT;
    conf->connect_timeout = NGX_CONF_UNSET_MSEC;
    conf->send_timeout = NGX_CONF_UNSET_MSEC;
    conf->read_timeout = NGX_CONF_UNSET_MSEC;

    return conf;
}


static char *
ngx_flow_aeon_merge_srv_conf(ngx_conf_t *cf, void *parent, void *child)
{
    ngx_flow_aeon_srv_conf_t  *prev = parent;
    ngx_flow_aeon_srv_conf_t  *conf = child;

    ngx_conf_merge_value(conf->enable, prev->enable, 0);
    ngx_conf_merge_uint_value(conf->max_streams, prev->max_streams, 256);
    ngx_conf_merge_msec_value(conf->connect_timeout, prev->connect_timeout, 5000);
    ngx_conf_merge_msec_value(conf->send_timeout, prev->send_timeout, 30000);
    ngx_conf_merge_msec_value(conf->read_timeout, prev->read_timeout, 30000);
    ngx_conf_merge_str_value(conf->http_upstream, prev->http_upstream, "");

    return NGX_CONF_OK;
}


static char *
ngx_flow_aeon_enable(ngx_conf_t *cf, ngx_command_t *cmd, void *conf)
{
    ngx_flow_aeon_srv_conf_t  *facf = conf;
    ngx_str_t                 *value;
    ngx_stream_core_srv_conf_t *cscf;

    value = cf->args->elts;

    if (ngx_strcasecmp(value[1].data, (u_char *)"on") == 0) {
        facf->enable = 1;
    } else if (ngx_strcasecmp(value[1].data, (u_char *)"off") == 0) {
        facf->enable = 0;
        return NGX_CONF_OK;
    } else {
        ngx_conf_log_error(NGX_LOG_EMERG, cf, 0,
                           "invalid value \"%V\" in \"%V\" directive",
                           &value[1], &value[0]);
        return NGX_CONF_ERROR;
    }

    /* Register the content handler for this server block */
    cscf = ngx_stream_conf_get_module_srv_conf(cf, ngx_stream_core_module);
    cscf->handler = ngx_flow_aeon_handler;

    return NGX_CONF_OK;
}


/* ═══════════════════════════════════════════════════════════════════════════
 * Session handler — called when a new TCP connection arrives
 * ═══════════════════════════════════════════════════════════════════════════ */

static void
ngx_flow_aeon_handler(ngx_stream_session_t *s)
{
    ngx_flow_aeon_session_t   *sess;
    ngx_connection_t          *c;

    c = s->connection;

    sess = ngx_pcalloc(c->pool, sizeof(ngx_flow_aeon_session_t));
    if (sess == NULL) {
        ngx_stream_finalize_session(s, NGX_STREAM_INTERNAL_SERVER_ERROR);
        return;
    }

    sess->session = s;
    sess->pool = c->pool;
    sess->active_streams = 0;
    sess->streams = NULL;
    sess->streams_size = 0;
    sess->close = 0;

    /* Allocate receive buffer (header + max payload) */
    sess->recv_buf = ngx_create_temp_buf(c->pool,
                         NGX_AEON_FLOW_HEADER_SIZE + 65536);
    if (sess->recv_buf == NULL) {
        ngx_stream_finalize_session(s, NGX_STREAM_INTERNAL_SERVER_ERROR);
        return;
    }

    /* Allocate send buffer for outgoing Aeon Flow frames */
    sess->send_buf = ngx_create_temp_buf(c->pool,
                         NGX_AEON_FLOW_HEADER_SIZE + 65536);
    if (sess->send_buf == NULL) {
        ngx_stream_finalize_session(s, NGX_STREAM_INTERNAL_SERVER_ERROR);
        return;
    }

    c->data = sess;
    c->read->handler = ngx_flow_aeon_read_handler;
    c->write->handler = ngx_flow_aeon_write_handler;

    ngx_log_debug0(NGX_LOG_DEBUG_STREAM, c->log, 0,
                   "flow_aeon: new connection accepted");

    /* Trigger initial read */
    if (c->read->ready) {
        ngx_flow_aeon_read_handler(c->read);
    } else {
        ngx_handle_read_event(c->read, 0);
    }
}


/* ═══════════════════════════════════════════════════════════════════════════
 * Read handler — decode Aeon Flow frames from the client
 * ═══════════════════════════════════════════════════════════════════════════ */

static void
ngx_flow_aeon_read_handler(ngx_event_t *rev)
{
    ngx_connection_t           *c;
    ngx_flow_aeon_session_t    *sess;
    ngx_flow_aeon_srv_conf_t   *conf;
    ngx_aeon_flow_frame_t       frame;
    ssize_t                     n;
    size_t                      consumed;
    u_char                     *p;

    c = rev->data;
    sess = c->data;
    conf = ngx_stream_get_module_srv_conf(sess->session, ngx_flow_aeon_module);

    /* Read from the Aeon Flow client */
    n = c->recv(c, sess->recv_buf->last,
                sess->recv_buf->end - sess->recv_buf->last);

    if (n == NGX_AGAIN) {
        ngx_handle_read_event(rev, 0);
        return;
    }

    if (n <= 0) {
        /* Client disconnected — poison all active streams */
        ngx_log_debug0(NGX_LOG_DEBUG_STREAM, c->log, 0,
                       "flow_aeon: client disconnected");

        if (sess->streams != NULL) {
            uint16_t s;
            for (s = 0; s < sess->streams_size; s++) {
                if (sess->streams[s] != NULL
                    && sess->streams[s]->state == NGX_AEON_STREAM_OPEN)
                {
                    ngx_flow_aeon_poison_stream(sess, sess->streams[s]);
                }
            }
        }

        ngx_stream_finalize_session(sess->session, NGX_STREAM_OK);
        return;
    }

    sess->recv_buf->last += n;

    /* Decode and dispatch frames */
    p = sess->recv_buf->pos;

    while ((size_t)(sess->recv_buf->last - p) >= NGX_AEON_FLOW_HEADER_SIZE) {
        ngx_int_t rc;

        rc = ngx_aeon_flow_decode(p, sess->recv_buf->last - p,
                                   &frame, &consumed);

        if (rc == NGX_AGAIN) {
            break;
        }

        if (rc == NGX_ERROR) {
            ngx_log_error(NGX_LOG_ERR, c->log, 0,
                          "flow_aeon: malformed frame from client");
            sess->close = 1;
            ngx_stream_finalize_session(sess->session,
                                        NGX_STREAM_BAD_REQUEST);
            return;
        }

        /* ─── Frame dispatch ─────────────────────────────────────────── */

        if (frame.flags & NGX_AEON_FLOW_POISON) {
            /* Client poisoned a stream — cancel the HTTP upstream */
            if (frame.stream_id < sess->streams_size
                && sess->streams[frame.stream_id] != NULL)
            {
                ngx_log_debug1(NGX_LOG_DEBUG_STREAM, c->log, 0,
                               "flow_aeon: client poisoned stream %ui",
                               (ngx_uint_t)frame.stream_id);
                ngx_flow_aeon_poison_stream(sess,
                                            sess->streams[frame.stream_id]);
            }

        } else if (frame.flags & NGX_AEON_FLOW_FIN) {
            /* Client finished a stream — nothing to do on our side,
             * the request was already sent with the first DATA frame */
            ngx_log_debug1(NGX_LOG_DEBUG_STREAM, c->log, 0,
                           "flow_aeon: client FIN on stream %ui",
                           (ngx_uint_t)frame.stream_id);

        } else if (frame.flags & NGX_AEON_FLOW_FORK) {
            /* Client wants to fork child streams from a parent.
             * Each child will be a separate HTTP request. */
            uint16_t  parent_id = frame.stream_id;
            u_char   *fp = frame.payload;
            ngx_uint_t child_count = frame.length / 2;
            ngx_uint_t ci;

            ngx_log_debug2(NGX_LOG_DEBUG_STREAM, c->log, 0,
                           "flow_aeon: FORK %ui children from stream %ui",
                           child_count, (ngx_uint_t)parent_id);

            for (ci = 0; ci < child_count; ci++) {
                uint16_t child_id = (fp[ci * 2] << 8) | fp[ci * 2 + 1];
                ngx_flow_aeon_stream_t *child;

                child = ngx_flow_aeon_alloc_stream(sess, child_id);
                if (child == NULL) {
                    ngx_log_error(NGX_LOG_ERR, c->log, 0,
                                  "flow_aeon: failed to allocate child stream");
                    continue;
                }

                child->parent_id = parent_id;

                /* Track child on parent */
                if (parent_id < sess->streams_size
                    && sess->streams[parent_id] != NULL)
                {
                    ngx_flow_aeon_stream_t *parent_stream;
                    uint16_t *child_slot;

                    parent_stream = sess->streams[parent_id];
                    if (parent_stream->children == NULL) {
                        parent_stream->children = ngx_array_create(
                            sess->pool, child_count, sizeof(uint16_t));
                    }

                    if (parent_stream->children != NULL) {
                        child_slot = ngx_array_push(parent_stream->children);
                        if (child_slot != NULL) {
                            *child_slot = child_id;
                        }
                    }
                }
            }

        } else if (frame.length > 0 && frame.payload != NULL) {
            /* DATA frame — this is a request on a stream */
            ngx_flow_aeon_stream_t *stream;

            /* Auto-allocate stream if it doesn't exist */
            if (frame.stream_id >= sess->streams_size
                || sess->streams[frame.stream_id] == NULL)
            {
                if (sess->active_streams >= (uint16_t)conf->max_streams) {
                    ngx_log_error(NGX_LOG_ERR, c->log, 0,
                                  "flow_aeon: max streams exceeded");
                    p += consumed;
                    continue;
                }

                stream = ngx_flow_aeon_alloc_stream(sess, frame.stream_id);
                if (stream == NULL) {
                    p += consumed;
                    continue;
                }
            } else {
                stream = sess->streams[frame.stream_id];
            }

            if (stream->state != NGX_AEON_STREAM_OPEN) {
                p += consumed;
                continue;
            }

            /* Parse the DATA payload as an HTTP request */
            if (ngx_flow_aeon_parse_request(stream, frame.payload,
                                             frame.length) != NGX_OK)
            {
                ngx_log_error(NGX_LOG_ERR, c->log, 0,
                              "flow_aeon: failed to parse request on stream %ui",
                              (ngx_uint_t)frame.stream_id);
                ngx_flow_aeon_poison_stream(sess, stream);
                p += consumed;
                continue;
            }

            /* Connect to HTTP upstream and forward the request */
            if (ngx_flow_aeon_connect_upstream(sess, stream, conf) != NGX_OK) {
                ngx_log_error(NGX_LOG_ERR, c->log, 0,
                              "flow_aeon: failed to connect upstream for stream %ui",
                              (ngx_uint_t)frame.stream_id);
                ngx_flow_aeon_poison_stream(sess, stream);
            }
        }

        p += consumed;
    }

    /* Compact receive buffer */
    if (p > sess->recv_buf->pos) {
        size_t remaining = sess->recv_buf->last - p;
        if (remaining > 0) {
            ngx_memmove(sess->recv_buf->pos, p, remaining);
        }
        sess->recv_buf->last = sess->recv_buf->pos + remaining;
    }

    /* Flush any queued response frames back to the Aeon Flow client */
    if (sess->send_buf->pos < sess->send_buf->last) {
        ngx_flow_aeon_write_handler(c->write);
    }

    ngx_handle_read_event(rev, 0);
}


/* ═══════════════════════════════════════════════════════════════════════════
 * Connect to HTTP upstream and send the request
 * ═══════════════════════════════════════════════════════════════════════════ */

static ngx_int_t
ngx_flow_aeon_connect_upstream(ngx_flow_aeon_session_t *sess,
    ngx_flow_aeon_stream_t *stream, ngx_flow_aeon_srv_conf_t *conf)
{
    ngx_int_t                rc;
    ngx_buf_t               *req_buf;
    ngx_connection_t        *uc;

    /* Parse upstream address */
    ngx_memzero(&stream->upstream, sizeof(ngx_peer_connection_t));
    stream->upstream.log = sess->session->connection->log;
    stream->upstream.log_error = NGX_ERROR_ERR;

    rc = ngx_event_connect_peer(&stream->upstream);

    if (rc == NGX_ERROR || rc == NGX_DECLINED) {
        return NGX_ERROR;
    }

    uc = stream->upstream.connection;
    uc->data = stream;

    /* Build the HTTP/1.1 request */
    req_buf = ngx_flow_aeon_build_http_request(stream);
    if (req_buf == NULL) {
        ngx_close_connection(uc);
        stream->upstream.connection = NULL;
        return NGX_ERROR;
    }

    stream->http_send_buf = req_buf;

    /* Allocate HTTP response receive buffer */
    stream->http_recv_buf = ngx_create_temp_buf(sess->pool, 65536);
    if (stream->http_recv_buf == NULL) {
        ngx_close_connection(uc);
        stream->upstream.connection = NULL;
        return NGX_ERROR;
    }

    /* Send the HTTP request */
    {
        ssize_t  sent;

        sent = uc->send(uc, req_buf->pos, req_buf->last - req_buf->pos);

        if (sent == NGX_ERROR) {
            ngx_close_connection(uc);
            stream->upstream.connection = NULL;
            return NGX_ERROR;
        }

        if (sent > 0) {
            req_buf->pos += sent;
        }
    }

    /* Set up read handler for the HTTP response */
    uc->read->handler = ngx_flow_aeon_upstream_read_handler;
    uc->write->handler = ngx_flow_aeon_write_handler;
    ngx_handle_read_event(uc->read, 0);

    ngx_log_debug2(NGX_LOG_DEBUG_STREAM, sess->session->connection->log, 0,
                   "flow_aeon: connected upstream for stream %ui (%V)",
                   (ngx_uint_t)stream->stream_id, &stream->uri);

    return NGX_OK;
}


/* ═══════════════════════════════════════════════════════════════════════════
 * Upstream read handler — read HTTP response, encode as Aeon Flow frames
 * ═══════════════════════════════════════════════════════════════════════════ */

static void
ngx_flow_aeon_upstream_read_handler(ngx_event_t *rev)
{
    ngx_connection_t           *uc;
    ngx_flow_aeon_stream_t     *stream;
    ngx_flow_aeon_session_t    *sess;
    ngx_connection_t           *client_c;
    ssize_t                     n;
    ngx_int_t                   rc;

    uc = rev->data;
    stream = uc->data;
    sess = stream->session->connection->data;
    client_c = sess->session->connection;

    /* Read HTTP response from upstream */
    n = uc->recv(uc, stream->http_recv_buf->last,
                 stream->http_recv_buf->end - stream->http_recv_buf->last);

    if (n == NGX_AGAIN) {
        ngx_handle_read_event(rev, 0);
        return;
    }

    if (n <= 0) {
        /* Upstream closed — send FIN on the Aeon Flow stream */
        ngx_log_debug1(NGX_LOG_DEBUG_STREAM, client_c->log, 0,
                       "flow_aeon: upstream closed for stream %ui",
                       (ngx_uint_t)stream->stream_id);

        if (stream->state == NGX_AEON_STREAM_OPEN) {
            ngx_flow_aeon_send_fin(sess, stream);
        }

        ngx_close_connection(uc);
        stream->upstream.connection = NULL;
        ngx_flow_aeon_close_stream(sess, stream);

        /* Flush response frames to client */
        if (sess->send_buf->pos < sess->send_buf->last) {
            ngx_flow_aeon_write_handler(client_c->write);
        }
        return;
    }

    stream->http_recv_buf->last += n;

    /* Translate HTTP response into Aeon Flow frames */
    rc = ngx_flow_aeon_parse_http_response(stream,
            stream->http_recv_buf->pos,
            stream->http_recv_buf->last - stream->http_recv_buf->pos,
            sess->send_buf);

    if (rc == NGX_AGAIN) {
        /* Incomplete headers, wait for more data */
        ngx_handle_read_event(rev, 0);
        return;
    }

    if (rc > 0) {
        stream->http_recv_buf->pos += rc;

        /* Compact receive buffer */
        if (stream->http_recv_buf->pos > stream->http_recv_buf->start) {
            size_t remaining = stream->http_recv_buf->last
                             - stream->http_recv_buf->pos;
            if (remaining > 0) {
                ngx_memmove(stream->http_recv_buf->start,
                            stream->http_recv_buf->pos, remaining);
            }
            stream->http_recv_buf->pos = stream->http_recv_buf->start;
            stream->http_recv_buf->last = stream->http_recv_buf->start
                                        + remaining;
        }
    }

    /* Flush response frames to the Aeon Flow client */
    if (sess->send_buf->pos < sess->send_buf->last) {
        ngx_flow_aeon_write_handler(client_c->write);
    }

    /* If stream closed (FIN sent), clean up */
    if (stream->state == NGX_AEON_STREAM_CLOSED) {
        ngx_close_connection(uc);
        stream->upstream.connection = NULL;
        ngx_flow_aeon_close_stream(sess, stream);
    } else {
        ngx_handle_read_event(rev, 0);
    }
}


/* ═══════════════════════════════════════════════════════════════════════════
 * Write handler — flush Aeon Flow frames to the client
 * ═══════════════════════════════════════════════════════════════════════════ */

static void
ngx_flow_aeon_write_handler(ngx_event_t *wev)
{
    ngx_connection_t         *c;
    ngx_flow_aeon_session_t  *sess;
    ssize_t                   n;
    size_t                    pending;

    c = wev->data;
    sess = c->data;

    pending = sess->send_buf->last - sess->send_buf->pos;
    if (pending == 0) {
        return;
    }

    n = c->send(c, sess->send_buf->pos, pending);

    if (n == NGX_ERROR) {
        ngx_stream_finalize_session(sess->session,
                                    NGX_STREAM_INTERNAL_SERVER_ERROR);
        return;
    }

    if (n > 0) {
        sess->send_buf->pos += n;

        /* Compact send buffer */
        if (sess->send_buf->pos >= sess->send_buf->last) {
            sess->send_buf->pos = sess->send_buf->start;
            sess->send_buf->last = sess->send_buf->start;
        }
    }
}


/* ═══════════════════════════════════════════════════════════════════════════
 * Poison a stream — cancel HTTP upstream, send POISON back to client
 * ═══════════════════════════════════════════════════════════════════════════ */

static void
ngx_flow_aeon_poison_stream(ngx_flow_aeon_session_t *sess,
    ngx_flow_aeon_stream_t *stream)
{
    ngx_aeon_flow_frame_t  frame;
    size_t                 encoded;

    if (stream->state == NGX_AEON_STREAM_CLOSED
        || stream->state == NGX_AEON_STREAM_POISONED)
    {
        return;
    }

    stream->state = NGX_AEON_STREAM_POISONED;

    /* Close the HTTP upstream connection if active */
    if (stream->upstream.connection != NULL) {
        ngx_close_connection(stream->upstream.connection);
        stream->upstream.connection = NULL;
    }

    /* Send POISON frame back to the client */
    frame.stream_id = stream->stream_id;
    frame.sequence = stream->next_sequence++;
    frame.flags = NGX_AEON_FLOW_POISON;
    frame.length = 0;
    frame.payload = NULL;

    if ((size_t)(sess->send_buf->end - sess->send_buf->last)
        >= NGX_AEON_FLOW_HEADER_SIZE)
    {
        encoded = ngx_aeon_flow_encode(sess->send_buf->last, &frame);
        sess->send_buf->last += encoded;
    }

    /* Recursively poison children */
    if (stream->children != NULL) {
        uint16_t    *child_ids;
        ngx_uint_t   i;

        child_ids = stream->children->elts;
        for (i = 0; i < stream->children->nelts; i++) {
            if (child_ids[i] < sess->streams_size
                && sess->streams[child_ids[i]] != NULL)
            {
                ngx_flow_aeon_poison_stream(sess,
                                            sess->streams[child_ids[i]]);
            }
        }
    }

    sess->active_streams--;

    ngx_log_debug1(NGX_LOG_DEBUG_STREAM, sess->session->connection->log, 0,
                   "flow_aeon: poisoned stream %ui",
                   (ngx_uint_t)stream->stream_id);
}


/* ═══════════════════════════════════════════════════════════════════════════
 * Send FIN frame to the Aeon Flow client
 * ═══════════════════════════════════════════════════════════════════════════ */

static void
ngx_flow_aeon_send_fin(ngx_flow_aeon_session_t *sess,
    ngx_flow_aeon_stream_t *stream)
{
    ngx_aeon_flow_frame_t  frame;
    size_t                 encoded;

    frame.stream_id = stream->stream_id;
    frame.sequence = stream->next_sequence++;
    frame.flags = NGX_AEON_FLOW_FIN;
    frame.length = 0;
    frame.payload = NULL;

    if ((size_t)(sess->send_buf->end - sess->send_buf->last)
        >= NGX_AEON_FLOW_HEADER_SIZE)
    {
        encoded = ngx_aeon_flow_encode(sess->send_buf->last, &frame);
        sess->send_buf->last += encoded;
    }

    stream->state = NGX_AEON_STREAM_CLOSED;
}
