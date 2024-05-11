import { DebugHelper } from "../../../core/debug.js";
import { DynamicBuffer } from "../dynamic-buffer.js";

/**
 * @ignore
 */
class WebgpuDynamicBuffer extends DynamicBuffer {
    /**
     * @type {GPUBuffer}
     * @private
     */
    buffer = null;

    /**
     * CPU access over the whole buffer.
     *
     * @type {ArrayBuffer}
     */
    mappedRange = null;

    constructor(device, size, isStaging) {
        super(device);

        this.buffer = device.wgpu.createBuffer({
            size: size,
            usage: isStaging ? GPUBufferUsage.MAP_WRITE | GPUBufferUsage.COPY_SRC : GPUBufferUsage.UNIFORM | GPUBufferUsage.COPY_DST,
            mappedAtCreation: isStaging
        });

        if (isStaging) {
            this.onAvailable();
        }

        // staging buffers are not stored in vram, but add them for tracking purposes anyways
        device._vram.ub += size;

        DebugHelper.setLabel(this.buffer, `DynamicBuffer-${isStaging ? 'Staging' : 'Gpu'}`);
    }

    destroy(device) {

        device._vram.ub -= this.buffer.size;

        this.buffer.destroy();
        this.buffer = null;
    }

    /**
     * Called when the staging buffer is mapped for writing.
     */
    onAvailable() {
        // map the whole buffer
        this.mappedRange = this.buffer.getMappedRange();
    }

    alloc(offset, size) {
        return new Int32Array(this.mappedRange, offset, size / 4);
    }
}

export { WebgpuDynamicBuffer };
