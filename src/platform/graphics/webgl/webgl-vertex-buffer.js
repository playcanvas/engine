import { WebglBuffer } from "./webgl-buffer.js";

/**
 * A WebGL implementation of the VertexBuffer.
 *
 * @ignore
 */
class WebglVertexBuffer extends WebglBuffer {
    // vertex array object
    vao = null;

    destroy(device) {

        super.destroy(device);

        // clear up bound vertex buffers
        device.unbindVertexArray();
    }

    loseContext() {
        super.loseContext();
        this.vao = null;
    }

    unlock(vertexBuffer) {

        const device = vertexBuffer.device;
        super.unlock(device, vertexBuffer.usage, device.gl.ARRAY_BUFFER, vertexBuffer.storage);
    }
}

export { WebglVertexBuffer };
