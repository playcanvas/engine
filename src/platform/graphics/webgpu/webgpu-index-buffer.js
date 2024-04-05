import { Debug } from '../../../core/debug.js';
import { INDEXFORMAT_UINT8, INDEXFORMAT_UINT16, BUFFERUSAGE_INDEX, BUFFERUSAGE_STORAGE } from '../constants.js';
import { WebgpuBuffer } from "./webgpu-buffer.js";

/**
 * A WebGPU implementation of the IndexBuffer.
 *
 * @ignore
 */
class WebgpuIndexBuffer extends WebgpuBuffer {
    format = null;

    constructor(indexBuffer, options) {
        super(BUFFERUSAGE_INDEX | (options?.storage ? BUFFERUSAGE_STORAGE : 0));

        Debug.assert(indexBuffer.format !== INDEXFORMAT_UINT8, "WebGPU does not support 8-bit index buffer format");
        this.format = indexBuffer.format === INDEXFORMAT_UINT16 ? "uint16" : "uint32";
    }

    unlock(indexBuffer) {
        const device = indexBuffer.device;
        super.unlock(device, indexBuffer.storage);
    }
}

export { WebgpuIndexBuffer };
