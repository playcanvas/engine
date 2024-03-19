import { WebgpuBuffer } from "./webgpu-buffer.js";

/**
 * A WebGPU implementation of the UniformBuffer.
 *
 * @ignore
 */
class WebgpuUniformBuffer extends WebgpuBuffer {
    constructor(uniformBuffer) {
        super();
    }

    destroy(device) {

        super.destroy(device);


        // TODO: clear up bound uniform buffers
    }

    unlock(uniformBuffer) {

        const device = uniformBuffer.device;
        super.unlock(device, undefined, GPUBufferUsage.UNIFORM, uniformBuffer.storageInt32.buffer);
    }
}

export { WebgpuUniformBuffer };
