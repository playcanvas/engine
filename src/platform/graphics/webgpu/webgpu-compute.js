import { Debug, DebugHelper } from "../../../core/debug.js";
import { BindGroup } from "../bind-group.js";
import { Buffer } from "../buffer.js";
import { WebgpuBuffer } from "./webgpu-buffer.js";

/**
 * A WebGPU implementation of the Compute.
 *
 * @ignore
 */
class WebgpuCompute {
    constructor(compute) {
        this.compute = compute;

        const { device, shader } = compute;

        // create bind group
        const { computeBindGroupFormat } = shader.impl;
        Debug.assert(computeBindGroupFormat, 'Compute shader does not have computeBindGroupFormat specified', shader);
        this.bindGroup = new BindGroup(device, computeBindGroupFormat);
        DebugHelper.setName(this.bindGroup, `Compute-BindGroup_${this.bindGroup.id}`);

        // pipeline
        this.pipeline = device.computePipeline.get(shader, computeBindGroupFormat);
    }

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
    }

    /**
     *
     * @param {import('../texture.js').Texture} texture
     * @returns {import('../buffer.js').Buffer}
     */
    getBuffer(texture) {
        // Calculate bytes per pixel, assuming RGBA8 format (4 bytes per pixel)
        const bytesPerPixel = 4;

        // Calculate bytes per row, ensuring it's a multiple of 256
        const bytesPerRow = Math.ceil((texture.width * bytesPerPixel) / 256) * 256;

        // Calculate the size of the buffer to hold the texture data
        const bufferSize = bytesPerRow * texture.height;

        const gpuBuffer = this.compute.device.wgpu.createBuffer({
            size: bufferSize,
            usage: GPUBufferUsage.COPY_DST | GPUBufferUsage.MAP_READ
        });

        const textureCopyView = {
            texture: texture.impl.gpuTexture,
            origin: { x: 0, y: 0 },
        };
        const bufferCopyView = {
            buffer: gpuBuffer,
            bytesPerRow: bytesPerRow,
        };
        const extent = {
            width: texture.width,
            height: texture.height,
        };

        this.compute.device.copyTextureToBufferCommands.push([textureCopyView, bufferCopyView, extent]);

        const buffer = new Buffer();
        buffer.impl = new WebgpuBuffer();
        buffer.impl.buffer = gpuBuffer;

        return buffer;
    }
}

export { WebgpuCompute };
