import { BUFFERUSAGE_UNIFORM } from "../constants.js";
import { WebgpuBuffer } from "./webgpu-buffer.js";

/**
 * A WebGPU implementation of the UniformBuffer.
 *
 * @ignore
 */
class WebgpuUniformBuffer extends WebgpuBuffer {
    constructor(uniformBuffer) {
        super(BUFFERUSAGE_UNIFORM);
    }

    unlock(uniformBuffer) {

        const device = uniformBuffer.device;
        super.unlock(device, uniformBuffer.storageInt32.buffer);
    }
}

export { WebgpuUniformBuffer };
