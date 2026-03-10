/*
 * ngx_aeon_flow_codec.c — Binary frame encoder/decoder
 *
 * Pure C implementation of the Aeon Flow wire format.
 * Zerocopy decode: payload pointer aims into the receive buffer.
 *
 * Wire format (10-byte header):
 *   [0..1]  stream_id  u16 big-endian
 *   [2..5]  sequence   u32 big-endian
 *   [6]     flags      u8
 *   [7..9]  length     u24 big-endian
 *   [10..]  payload    raw bytes
 */

#include "ngx_aeon_flow.h"


size_t
ngx_aeon_flow_encode(u_char *buf, ngx_aeon_flow_frame_t *frame)
{
    /* stream_id: u16 big-endian */
    buf[0] = (u_char)((frame->stream_id >> 8) & 0xFF);
    buf[1] = (u_char)(frame->stream_id & 0xFF);

    /* sequence: u32 big-endian */
    buf[2] = (u_char)((frame->sequence >> 24) & 0xFF);
    buf[3] = (u_char)((frame->sequence >> 16) & 0xFF);
    buf[4] = (u_char)((frame->sequence >> 8) & 0xFF);
    buf[5] = (u_char)(frame->sequence & 0xFF);

    /* flags: u8 */
    buf[6] = frame->flags;

    /* length: u24 big-endian */
    buf[7] = (u_char)((frame->length >> 16) & 0xFF);
    buf[8] = (u_char)((frame->length >> 8) & 0xFF);
    buf[9] = (u_char)(frame->length & 0xFF);

    /* payload */
    if (frame->length > 0 && frame->payload != NULL) {
        ngx_memcpy(buf + NGX_AEON_FLOW_HEADER_SIZE, frame->payload,
                   frame->length);
    }

    return NGX_AEON_FLOW_HEADER_SIZE + frame->length;
}


ngx_int_t
ngx_aeon_flow_decode(u_char *buf, size_t len,
    ngx_aeon_flow_frame_t *frame, size_t *bytes_consumed)
{
    uint32_t    payload_len;

    if (len < NGX_AEON_FLOW_HEADER_SIZE) {
        return NGX_AGAIN;  /* need more data */
    }

    /* stream_id: u16 big-endian */
    frame->stream_id = (uint16_t)((buf[0] << 8) | buf[1]);

    /* sequence: u32 big-endian */
    frame->sequence = ((uint32_t)buf[2] << 24)
                    | ((uint32_t)buf[3] << 16)
                    | ((uint32_t)buf[4] << 8)
                    | (uint32_t)buf[5];

    /* flags: u8 */
    frame->flags = buf[6];

    /* length: u24 big-endian */
    payload_len = ((uint32_t)buf[7] << 16)
                | ((uint32_t)buf[8] << 8)
                | (uint32_t)buf[9];

    if (payload_len > NGX_AEON_FLOW_MAX_PAYLOAD) {
        return NGX_ERROR;  /* frame too large */
    }

    frame->length = payload_len;

    /* Check if we have the full payload */
    if (len < NGX_AEON_FLOW_HEADER_SIZE + payload_len) {
        return NGX_AGAIN;  /* need more data */
    }

    /* Zerocopy: payload points into the buffer */
    if (payload_len > 0) {
        frame->payload = buf + NGX_AEON_FLOW_HEADER_SIZE;
    } else {
        frame->payload = NULL;
    }

    *bytes_consumed = NGX_AEON_FLOW_HEADER_SIZE + payload_len;

    return NGX_OK;
}


ngx_chain_t *
ngx_aeon_flow_encode_chain(ngx_pool_t *pool, ngx_aeon_flow_frame_t *frame)
{
    ngx_buf_t      *b;
    ngx_chain_t    *cl;
    size_t          total;

    total = NGX_AEON_FLOW_HEADER_SIZE + frame->length;

    b = ngx_create_temp_buf(pool, total);
    if (b == NULL) {
        return NULL;
    }

    b->last = b->pos + ngx_aeon_flow_encode(b->pos, frame);
    b->memory = 1;

    cl = ngx_alloc_chain_link(pool);
    if (cl == NULL) {
        return NULL;
    }

    cl->buf = b;
    cl->next = NULL;

    return cl;
}
