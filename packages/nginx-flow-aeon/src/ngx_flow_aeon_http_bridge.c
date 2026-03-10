/*
 * ngx_flow_aeon_http_bridge.c — Aeon Flow ↔ HTTP translation
 *
 * Translates between Aeon Flow binary frames and HTTP/1.1 text protocol.
 *
 * Inbound (Aeon Flow → HTTP):
 *   Parse the first DATA frame as an HTTP request line + headers.
 *   Build an HTTP/1.1 request buffer to send upstream.
 *
 * Outbound (HTTP → Aeon Flow):
 *   Parse HTTP/1.1 response status + headers + body.
 *   Encode as Aeon Flow DATA frames (status in first frame, body in subsequent).
 *   Send FIN when HTTP response is complete.
 */

#include "ngx_flow_aeon.h"


/* ═══════════════════════════════════════════════════════════════════════════
 * Stream allocation
 * ═══════════════════════════════════════════════════════════════════════════ */

ngx_flow_aeon_stream_t *
ngx_flow_aeon_alloc_stream(ngx_flow_aeon_session_t *sess, uint16_t stream_id)
{
    ngx_flow_aeon_stream_t  *stream;

    /* Grow stream table if needed */
    if (stream_id >= sess->streams_size) {
        uint16_t                  new_size;
        ngx_flow_aeon_stream_t  **new_table;

        new_size = (stream_id + 1) * 2;
        if (new_size > 65535) {
            new_size = 65535;
        }

        new_table = ngx_pcalloc(sess->pool,
                                new_size * sizeof(ngx_flow_aeon_stream_t *));
        if (new_table == NULL) {
            return NULL;
        }

        if (sess->streams != NULL && sess->streams_size > 0) {
            ngx_memcpy(new_table, sess->streams,
                       sess->streams_size * sizeof(ngx_flow_aeon_stream_t *));
        }

        sess->streams = new_table;
        sess->streams_size = new_size;
    }

    stream = ngx_pcalloc(sess->pool, sizeof(ngx_flow_aeon_stream_t));
    if (stream == NULL) {
        return NULL;
    }

    stream->stream_id = stream_id;
    stream->state = NGX_AEON_STREAM_OPEN;
    stream->next_sequence = 0;
    stream->session = sess->session;
    stream->pool = sess->pool;
    stream->parent_id = 0;
    stream->children = NULL;
    stream->headers_parsed = 0;
    stream->body_started = 0;
    stream->http_status = 0;
    stream->content_length = 0;
    stream->body_received = 0;

    sess->streams[stream_id] = stream;
    sess->active_streams++;

    return stream;
}


void
ngx_flow_aeon_close_stream(ngx_flow_aeon_session_t *sess,
    ngx_flow_aeon_stream_t *stream)
{
    if (stream->state == NGX_AEON_STREAM_CLOSED
        || stream->state == NGX_AEON_STREAM_POISONED)
    {
        return;
    }

    stream->state = NGX_AEON_STREAM_CLOSED;

    if (stream->upstream.connection != NULL) {
        ngx_close_connection(stream->upstream.connection);
        stream->upstream.connection = NULL;
    }

    if (stream->stream_id < sess->streams_size) {
        sess->streams[stream->stream_id] = NULL;
    }

    sess->active_streams--;
}


/* ═══════════════════════════════════════════════════════════════════════════
 * Inbound: Parse Aeon Flow DATA frame → HTTP request
 * ═══════════════════════════════════════════════════════════════════════════ */

ngx_int_t
ngx_flow_aeon_parse_request(ngx_flow_aeon_stream_t *stream,
    u_char *payload, size_t len)
{
    u_char  *p, *end, *line_start;
    u_char  *method_end, *uri_start, *uri_end;

    if (len < 14) {  /* "GET / HTTP/1.1\r\n" minimum */
        return NGX_ERROR;
    }

    p = payload;
    end = payload + len;

    /*
     * Parse request line: METHOD SP URI SP HTTP/1.1 CRLF
     */

    /* Find method end (first space) */
    method_end = p;
    while (method_end < end && *method_end != ' ') { method_end++; }
    if (method_end >= end) { return NGX_ERROR; }

    stream->method.data = ngx_pnalloc(stream->pool, method_end - p);
    if (stream->method.data == NULL) { return NGX_ERROR; }
    ngx_memcpy(stream->method.data, p, method_end - p);
    stream->method.len = method_end - p;

    /* Find URI (between first and second space) */
    uri_start = method_end + 1;
    uri_end = uri_start;
    while (uri_end < end && *uri_end != ' ') { uri_end++; }
    if (uri_end >= end) { return NGX_ERROR; }

    stream->uri.data = ngx_pnalloc(stream->pool, uri_end - uri_start);
    if (stream->uri.data == NULL) { return NGX_ERROR; }
    ngx_memcpy(stream->uri.data, uri_start, uri_end - uri_start);
    stream->uri.len = uri_end - uri_start;

    /* Skip past "HTTP/1.1\r\n" */
    p = uri_end;
    while (p < end - 1 && !(p[0] == '\r' && p[1] == '\n')) { p++; }
    if (p >= end - 1) { return NGX_ERROR; }
    p += 2;  /* skip CRLF */

    /*
     * Parse headers: Key: Value CRLF ... CRLF
     */
    stream->headers = ngx_array_create(stream->pool, 8,
                                        sizeof(ngx_table_elt_t));
    if (stream->headers == NULL) { return NGX_ERROR; }

    while (p < end - 1) {
        ngx_table_elt_t  *h;
        u_char           *colon, *val_start;

        /* Empty line = end of headers */
        if (p[0] == '\r' && p[1] == '\n') {
            break;
        }

        line_start = p;

        /* Find end of line */
        while (p < end - 1 && !(p[0] == '\r' && p[1] == '\n')) { p++; }
        if (p >= end - 1) { break; }

        /* Find colon separator */
        colon = line_start;
        while (colon < p && *colon != ':') { colon++; }
        if (colon >= p) { p += 2; continue; }  /* malformed, skip */

        /* Skip ": " after colon */
        val_start = colon + 1;
        while (val_start < p && *val_start == ' ') { val_start++; }

        h = ngx_array_push(stream->headers);
        if (h == NULL) { return NGX_ERROR; }

        h->key.len = colon - line_start;
        h->key.data = ngx_pnalloc(stream->pool, h->key.len);
        if (h->key.data == NULL) { return NGX_ERROR; }
        ngx_memcpy(h->key.data, line_start, h->key.len);

        h->value.len = p - val_start;
        h->value.data = ngx_pnalloc(stream->pool, h->value.len);
        if (h->value.data == NULL) { return NGX_ERROR; }
        ngx_memcpy(h->value.data, val_start, h->value.len);

        p += 2;  /* skip CRLF */
    }

    return NGX_OK;
}


/* ═══════════════════════════════════════════════════════════════════════════
 * Build HTTP/1.1 request from parsed stream fields
 * ═══════════════════════════════════════════════════════════════════════════ */

ngx_buf_t *
ngx_flow_aeon_build_http_request(ngx_flow_aeon_stream_t *stream)
{
    ngx_buf_t        *b;
    ngx_table_elt_t  *headers;
    ngx_uint_t        i;
    size_t            size;
    u_char           *p;

    /* Calculate total size */
    size = stream->method.len + 1 + stream->uri.len + 11 + 2;  /* request line + CRLF */

    if (stream->headers != NULL) {
        headers = stream->headers->elts;
        for (i = 0; i < stream->headers->nelts; i++) {
            size += headers[i].key.len + 2 + headers[i].value.len + 2;
        }
    }

    size += 2;  /* terminal CRLF */

    b = ngx_create_temp_buf(stream->pool, size);
    if (b == NULL) {
        return NULL;
    }

    p = b->pos;

    /* Request line */
    p = ngx_cpymem(p, stream->method.data, stream->method.len);
    *p++ = ' ';
    p = ngx_cpymem(p, stream->uri.data, stream->uri.len);
    p = ngx_cpymem(p, " HTTP/1.1\r\n", 11);

    /* Headers */
    if (stream->headers != NULL) {
        headers = stream->headers->elts;
        for (i = 0; i < stream->headers->nelts; i++) {
            p = ngx_cpymem(p, headers[i].key.data, headers[i].key.len);
            *p++ = ':';
            *p++ = ' ';
            p = ngx_cpymem(p, headers[i].value.data, headers[i].value.len);
            *p++ = '\r';
            *p++ = '\n';
        }
    }

    /* Terminal CRLF */
    *p++ = '\r';
    *p++ = '\n';
    b->last = p;

    return b;
}


/* ═══════════════════════════════════════════════════════════════════════════
 * Outbound: Parse HTTP/1.1 response → Aeon Flow frames
 * ═══════════════════════════════════════════════════════════════════════════ */

ngx_int_t
ngx_flow_aeon_parse_http_response(ngx_flow_aeon_stream_t *stream,
    u_char *data, size_t len, ngx_buf_t *aeon_out)
{
    ngx_aeon_flow_frame_t  frame;
    u_char                *p, *end;
    size_t                 encoded;

    p = data;
    end = data + len;

    if (!stream->headers_parsed) {
        /*
         * Parse HTTP status line: "HTTP/1.1 200 OK\r\n"
         * We pass the entire status line + headers as the first DATA frame
         * so the Aeon Flow client can reconstruct the full response.
         */
        u_char  *headers_end;

        /* Find the end of headers (double CRLF) */
        headers_end = p;
        while (headers_end < end - 3) {
            if (headers_end[0] == '\r' && headers_end[1] == '\n'
                && headers_end[2] == '\r' && headers_end[3] == '\n')
            {
                headers_end += 4;
                break;
            }
            headers_end++;
        }

        if (headers_end >= end - 3) {
            return NGX_AGAIN;  /* incomplete headers, need more data */
        }

        /* Parse status code */
        if (end - p >= 12) {
            u_char *sp = p;
            while (sp < end && *sp != ' ') { sp++; }
            if (sp < end - 3) {
                sp++;
                stream->http_status = (sp[0] - '0') * 100
                                    + (sp[1] - '0') * 10
                                    + (sp[2] - '0');
            }
        }

        /* Parse Content-Length if present */
        {
            u_char *cl = p;
            while (cl < headers_end - 16) {
                if (ngx_strncasecmp(cl, (u_char *)"Content-Length:", 15) == 0) {
                    u_char *val = cl + 15;
                    while (*val == ' ') { val++; }
                    stream->content_length = ngx_atoof(val, headers_end - val);
                    break;
                }
                /* Skip to next line */
                while (cl < headers_end && *cl != '\n') { cl++; }
                cl++;
            }
        }

        /* Encode the status+headers as the first DATA frame */
        frame.stream_id = stream->stream_id;
        frame.sequence = stream->next_sequence++;
        frame.flags = 0;
        frame.length = (uint32_t)(headers_end - p);
        frame.payload = p;

        encoded = ngx_aeon_flow_encode(aeon_out->last, &frame);
        aeon_out->last += encoded;

        stream->headers_parsed = 1;
        stream->body_started = 1;
        p = headers_end;
    }

    /* Encode remaining body data as DATA frames */
    if (p < end) {
        size_t  body_len = end - p;

        frame.stream_id = stream->stream_id;
        frame.sequence = stream->next_sequence++;
        frame.flags = 0;
        frame.length = (uint32_t)body_len;
        frame.payload = p;

        /* Check that output buffer has space */
        if ((size_t)(aeon_out->end - aeon_out->last)
            >= NGX_AEON_FLOW_HEADER_SIZE + body_len)
        {
            encoded = ngx_aeon_flow_encode(aeon_out->last, &frame);
            aeon_out->last += encoded;
        }

        stream->body_received += body_len;
        p = end;
    }

    /* Check if response is complete */
    if (stream->content_length > 0
        && stream->body_received >= stream->content_length)
    {
        /* Send FIN frame */
        frame.stream_id = stream->stream_id;
        frame.sequence = stream->next_sequence++;
        frame.flags = NGX_AEON_FLOW_FIN;
        frame.length = 0;
        frame.payload = NULL;

        if ((size_t)(aeon_out->end - aeon_out->last) >= NGX_AEON_FLOW_HEADER_SIZE) {
            encoded = ngx_aeon_flow_encode(aeon_out->last, &frame);
            aeon_out->last += encoded;
        }

        stream->state = NGX_AEON_STREAM_CLOSED;
    }

    return (ngx_int_t)(p - data);
}
