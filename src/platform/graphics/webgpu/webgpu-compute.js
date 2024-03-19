import { Debug, DebugHelper } from "../../../core/debug.js";
import { BindGroup } from "../bind-group.js";
import { Buffer } from "../buffer.js";
import { pixelFormatInfo, BUFFER_USAGE_COPY_DST, BUFFER_USAGE_MAP_READ } from "../constants.js";

/**
 * A WebGPU implementation of the Compute.
 *
 * @ignore
 */
class WebgpuCompute {
    /**
     * @ignore
     */
    copyTextureToBufferCommands = [];

    /**
     * @ignore
     */
    copyBufferToBufferCommands = [];

    constructor(compute) {
        this.compute = compute;

        const { device, shader } = compute;

        // create bind group
        const { computeBindGroupFormat } = shader;
        Debug.assert(computeBindGroupFormat, 'Compute shader does not have computeBindGroupFormat specified', shader);
        this.bindGroup = new BindGroup(device, computeBindGroupFormat);
        DebugHelper.setName(this.bindGroup, `Compute-BindGroup_${this.bindGroup.id}`);

        // pipeline
        this.pipeline = device.computePipeline.get(shader, computeBindGroupFormat);
    }

    /**
     * Dispatch the compute work.
     *
     * @param {number} x - X dimension of the grid of work-groups to dispatch.
     * @param {number} [y] - Y dimension of the grid of work-groups to dispatch.
     * @param {number} [z] - Z dimension of the grid of work-groups to dispatch.
     */
    dispatch(x, y, z) {
        const device = this.compute.device;

        // bind group data
        const { bindGroup } = this;
        bindGroup.update();
        device.setBindGroup(0, bindGroup);

        // dispatch
        const passEncoder = device.passEncoder;
        passEncoder.setPipeline(this.pipeline);
        passEncoder.dispatchWorkgroups(x, y, z);

        this.compute.device.copyTextureToBufferCommands.push(...this.copyTextureToBufferCommands);
        this.copyTextureToBufferCommands.length = 0;

        this.compute.device.copyBufferToBufferCommands.push(...this.copyBufferToBufferCommands);
        this.copyBufferToBufferCommands.length = 0;
    }

    /**
     * Get a buffer that contains the data of the specified storage texture.
     * This needs to be called before dispatch! But can be called before device.startComputePass().
     *
     * @param {import('../texture.js').Texture} texture - The texture to get the buffer for.
     * @returns {import('../buffer.js').Buffer} The buffer.
     */
    getTextureBuffer(texture) {
        const formatInfo = pixelFormatInfo.get(texture.format);
        const bytesPerPixel = formatInfo.size;

        // Calculate bytes per row, ensuring it's a multiple of 256
        const bytesPerRow = Math.ceil((texture.width * bytesPerPixel) / 256) * 256;

        // Calculate the size of the buffer to hold the texture data
        const bufferSize = bytesPerRow * texture.height;

        const buffer = new Buffer(this.compute.device, {
            size: bufferSize,
            usage: BUFFER_USAGE_COPY_DST | BUFFER_USAGE_MAP_READ
        });

        const textureCopyView = {
            texture: texture.impl.gpuTexture,
            origin: { x: 0, y: 0 }
        };
        const bufferCopyView = {
            buffer: buffer.impl.buffer,
            bytesPerRow: bytesPerRow
        };
        const extent = {
            width: texture.width,
            height: texture.height
        };

        this.copyTextureToBufferCommands.push([textureCopyView, bufferCopyView, extent]);

        return buffer;
    }

    /**
     * Get a buffer that contains the data of the specified buffer.
     * This needs to be called before dispatch! But can be called before device.startComputePass().
     *
     * @param {import('../buffer.js').Buffer} buffer - The buffer to get the data from.
     * @returns {import('../buffer.js').Buffer} The buffer.
     */
    getBuffer(buffer) {
        const gpuBuffer = new Buffer(this.compute.device, {
            size: buffer.size,
            usage: BUFFER_USAGE_COPY_DST | BUFFER_USAGE_MAP_READ
        });

        this.copyBufferToBufferCommands.push([buffer.impl.buffer, gpuBuffer.impl.buffer, buffer.size]);

        return gpuBuffer;
    }
}

export { WebgpuCompute };
