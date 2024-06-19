import { BUFFERUSAGE_STORAGE, BUFFERUSAGE_VERTEX } from "../constants.js";
import { WebgpuBuffer } from "./webgpu-buffer.js";

/**
 * A WebGPU implementation of the VertexBuffer.
 *
 * @ignore
 */
class WebgpuVertexBuffer extends WebgpuBuffer {
    constructor(vertexBuffer, format, options) {
        super(BUFFERUSAGE_VERTEX | (options?.storage ? BUFFERUSAGE_STORAGE : 0));
    }

    unlock(vertexBuffer) {

        const device = vertexBuffer.device;
        super.unlock(device, vertexBuffer.storage);
    }
}

export { WebgpuVertexBuffer };
