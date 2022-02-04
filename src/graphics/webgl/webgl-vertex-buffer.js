import { BUFFER_DYNAMIC, BUFFER_GPUDYNAMIC, BUFFER_STATIC, BUFFER_STREAM } from '../constants.js';

/**
 * A WebGl implementation of the VertexBuffer.
 */
class WebglVertexBuffer {
    // vertex array object
    vao = null;

    bufferId = null;

    destroy(device) {

        if (this.bufferId) {

            // clear up bound vertex buffers
            const gl = device.gl;
            device.boundVao = null;
            gl.bindVertexArray(null);

            // delete buffer
            gl.deleteBuffer(this.bufferId);
            this.bufferId = null;
        }
    }

    loseContext() {
        this.bufferId = null;
        this.vao = null;
    }

    unlock(vertexBuffer) {

        // Upload the new vertex data
        const gl = vertexBuffer.device.gl;

        if (!this.bufferId) {
            this.bufferId = gl.createBuffer();
        }

        let glUsage;
        switch (vertexBuffer.usage) {
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
                if (vertexBuffer.device.webgl2) {
                    glUsage = gl.DYNAMIC_COPY;
                } else {
                    glUsage = gl.STATIC_DRAW;
                }
                break;
        }

        gl.bindBuffer(gl.ARRAY_BUFFER, this.bufferId);
        gl.bufferData(gl.ARRAY_BUFFER, vertexBuffer.storage, glUsage);
    }
}

export { WebglVertexBuffer };
