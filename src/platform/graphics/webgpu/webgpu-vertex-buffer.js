import { BUFFERUSAGE_VERTEX } from "../constants.js";
import { WebgpuBuffer } from "./webgpu-buffer.js";

/**
 * A WebGPU implementation of the VertexBuffer.
 *
 * @ignore
 */
class WebgpuVertexBuffer extends WebgpuBuffer {
    constructor(vertexBuffer, format) {
        super(BUFFERUSAGE_VERTEX);
    }

    unlock(vertexBuffer) {

        const device = vertexBuffer.device;
        super.unlock(device, vertexBuffer.storage);
    }
}

export { WebgpuVertexBuffer };
