import {
    INDEXFORMAT_UINT8, INDEXFORMAT_UINT16, INDEXFORMAT_UINT32,
    BUFFER_DYNAMIC, BUFFER_GPUDYNAMIC, BUFFER_STATIC, BUFFER_STREAM
} from '../constants.js';

/**
 * A WebGl implementation of the IndexBuffer.
 */
class WebglIndexBuffer {
    bufferId = null;

    constructor(indexBuffer) {
        const gl = indexBuffer.device.gl;

        const format = indexBuffer.format;
        if (format === INDEXFORMAT_UINT8) {
            this.glFormat = gl.UNSIGNED_BYTE;
        } else if (format === INDEXFORMAT_UINT16) {
            this.glFormat = gl.UNSIGNED_SHORT;
        } else if (format === INDEXFORMAT_UINT32) {
            this.glFormat = gl.UNSIGNED_INT;
        }
    }

    destroy(device) {
        if (this.bufferId) {
            device.gl.deleteBuffer(this.bufferId);
            this.bufferId = null;
        }
    }

    loseContext() {
        this.bufferId = null;
    }

    unlock(indexBuffer) {

        const gl = indexBuffer.device.gl;

        if (!this.bufferId) {
            this.bufferId = gl.createBuffer();
        }

        let glUsage;
        switch (indexBuffer.usage) {
            case BUFFER_STATIC:
                glUsage = gl.STATIC_DRAW;
                break;
            case BUFFER_DYNAMIC:
                glUsage = gl.DYNAMIC_DRAW;
                break;
            case BUFFER_STREAM:
                glUsage = gl.STREAM_DRAW;
                break;
            case BUFFER_GPUDYNAMIC:
                if (indexBuffer.device.webgl2) {
                    glUsage = gl.DYNAMIC_COPY;
                } else {
                    glUsage = gl.STATIC_DRAW;
                }
                break;
        }

        gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, this.bufferId);
        gl.bufferData(gl.ELEMENT_ARRAY_BUFFER, indexBuffer.storage, glUsage);
    }
}

export { WebglIndexBuffer };
