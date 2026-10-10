import { WebglBuffer } from './webgl-buffer.js';

/**
 * A WebGL implementation of the VertexBuffer.
 *
 * @ignore
 */
class WebglVertexBuffer extends WebglBuffer {
    // vertex array object
    vao = null;

    destroy(device) {

        // clear up bound vertex buffers, so the device does not keep the deleted vertex array bound
        device.unbindVertexArray();

        // delete the vertex array object explicitly. Left to garbage collection, it keeps this buffer
        // and the index buffer last drawn with it alive, and in Chrome its delayed release can leave a
        // stale index buffer binding behind, which sends a later index buffer upload to a deleted buffer
        if (this.vao) {
            device.gl.deleteVertexArray(this.vao);
            this.vao = null;
        }

        super.destroy(device);
    }

    loseContext() {
        super.loseContext();
        this.vao = null;
    }

    unlock(vertexBuffer, byteOffset, byteLength) {

        const device = vertexBuffer.device;
        super.unlock(device, vertexBuffer.usage, device.gl.ARRAY_BUFFER, vertexBuffer.storage, byteOffset, byteLength);
    }
}

export { WebglVertexBuffer };
