import { WebgpuBuffer } from "./webgpu-buffer.js";

/**
 * A WebGPU implementation of the VertexBuffer.
 *
 * @ignore
 */
class WebgpuVertexBuffer extends WebgpuBuffer {
    constructor(vertexBuffer, format) {
        super();
    }

    destroy(device) {

        super.destroy(device);

        // TODO: clear up bound vertex buffers
    }

    unlock(vertexBuffer) {

        const device = vertexBuffer.device;
        super.unlock(device, vertexBuffer.usage, GPUBufferUsage.VERTEX, vertexBuffer.storage);
    }
}

export { WebgpuVertexBuffer };
