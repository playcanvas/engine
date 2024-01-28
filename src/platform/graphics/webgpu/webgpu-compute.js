import { Debug, DebugHelper } from "../../../core/debug.js";
import { BindGroup } from "../bind-group.js";

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

        // TODO: currently each dispatch is a separate compute pass, which is not optimal, and we should
        // batch multiple dispatches into a single compute pass
        const device = this.compute.device;
        device.startComputePass();

        // bind group data
        const { bindGroup } = this;
        bindGroup.update();
        device.setBindGroup(0, bindGroup);

        // dispatch
        const passEncoder = device.passEncoder;
        passEncoder.setPipeline(this.pipeline);
        passEncoder.dispatchWorkgroups(x, y, z);

        device.endComputePass();
    }

    /**
     *
     * @param {GPUTexture} texture
     */
    async read(texture) {
        const device = this.compute.device;
        device.startCompute();

        // bind group data
        const { bindGroup } = this;
        bindGroup.update();
        device.setBindGroup(0, bindGroup);

        // Calculate bytes per pixel, assuming RGBA8 format (4 bytes per pixel)
        const bytesPerPixel = 4;

        // Calculate bytes per row, ensuring it's a multiple of 256
        const bytesPerRow = Math.ceil((texture.width * bytesPerPixel) / 256) * 256;

        // Calculate the size of the buffer to hold the texture data
        const bufferSize = bytesPerRow * texture.height;

        const gpuBuffer = device.wgpu.createBuffer({
            size: bufferSize,
            usage: GPUBufferUsage.COPY_DST | GPUBufferUsage.MAP_READ
        });

        const textureCopyView = {
            texture,
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

        // Encode command to copy from texture to buffer
        device.commandEncoder.copyTextureToBuffer(textureCopyView, bufferCopyView, extent);

        device.endCompute();

        await device.wgpu.queue.onSubmittedWorkDone();

        // Ensure that the GPU operations are complete
        await gpuBuffer.mapAsync(GPUMapMode.READ);

        // Read buffer contents
        const arrayBuffer = gpuBuffer.getMappedRange();
        const data = new Uint8Array(arrayBuffer); // or another typed array based on the texture format

        // Cleanup
        //gpuBuffer.unmap();
        //gpuBuffer.destroy();

        return data;
    }
}

export { WebgpuCompute };
