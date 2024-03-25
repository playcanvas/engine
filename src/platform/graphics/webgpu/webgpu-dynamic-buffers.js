import { DebugHelper } from "../../../core/debug.js";
import { DebugGraphics } from "../debug-graphics.js";
import { DynamicBuffers } from "../dynamic-buffers.js";
import { WebgpuDynamicBuffer } from "./webgpu-dynamic-buffer.js";

class WebgpuDynamicBuffers extends DynamicBuffers {
    /**
     * Staging buffers which are getting copied over to gpu buffers in the the command buffer waiting
     * to be submitted. When those command buffers are submitted, we can mapAsync these staging
     * buffers for reuse.
     *
     * @type {WebgpuDynamicBuffer[]}
     */
    pendingStagingBuffers = [];

    createBuffer(device, size, isStaging) {
        return new WebgpuDynamicBuffer(device, size, isStaging);
    }

    /**
     * Submit all used buffers to the device.
     */
    submit() {

        super.submit();

        // submit all used buffers
        const count = this.usedBuffers.length;
        if (count) {

            const device = this.device;
            const gpuBuffers = this.gpuBuffers;

            // new command encoder, as buffer copies need to be submitted before the currently recorded
            // rendering encoder is submitted
            const commandEncoder = device.wgpu.createCommandEncoder();
            DebugHelper.setLabel(commandEncoder, 'DynamicBuffersSubmit');

            DebugGraphics.pushGpuMarker(device, 'DynamicBuffersSubmit');

            // run this loop backwards to preserve the order of buffers in gpuBuffers array
            for (let i = count - 1; i >= 0; i--) {
                const usedBuffer = this.usedBuffers[i];
                const { stagingBuffer, gpuBuffer, offset, size } = usedBuffer;

                // unmap staging buffer (we're done writing to it on CPU)
                const src = stagingBuffer.buffer;
                src.unmap();

                // schedule data copy from staging to gpu buffer
                commandEncoder.copyBufferToBuffer(src, offset, gpuBuffer.buffer, offset, size);

                // gpu buffer can be reused immediately
                gpuBuffers.push(gpuBuffer);
            }

            DebugGraphics.popGpuMarker(device);

            // schedule the command buffer to run before all currently scheduled command buffers
            const cb = commandEncoder.finish();
            DebugHelper.setLabel(cb, 'DynamicBuffers');
            device.addCommandBuffer(cb, true);

            // keep the used staging buffers in the pending list
            for (let i = 0; i < count; i++) {
                const stagingBuffer = this.usedBuffers[i].stagingBuffer;
                this.pendingStagingBuffers.push(stagingBuffer);
            }
            this.usedBuffers.length = 0;
        }
    }

    /**
     * Called when all scheduled command buffers are submitted to the device.
     */
    onCommandBuffersSubmitted() {
        // map the staging buffers for write to alow them to be reused - this resolves when the CBs
        // using them are done on the GPU
        const count = this.pendingStagingBuffers.length;
        if (count) {
            for (let i = 0; i < count; i++) {
                const stagingBuffer = this.pendingStagingBuffers[i];
                stagingBuffer.buffer.mapAsync(GPUMapMode.WRITE).then(() => {
                    // the buffer can be mapped after the device has been destroyed, so test for that
                    if (this.stagingBuffers) {
                        stagingBuffer.onAvailable();
                        this.stagingBuffers.push(stagingBuffer);
                    }
                });
            }
            this.pendingStagingBuffers.length = 0;
        }
    }
}

export { WebgpuDynamicBuffers };
