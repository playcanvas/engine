import { Debug, DebugHelper } from '../../../core/debug.js';
import { BindGroup } from '../bind-group.js';
import { DebugGraphics } from '../debug-graphics.js';
import { UniformBuffer } from '../uniform-buffer.js';

// size of indirect dispatch entry in bytes, 3 x 32bit (x, y, z workgroup counts)
const _indirectDispatchEntryByteSize = 3 * 4;

/**
 * A WebGPU implementation of the Compute.
 *
 * @ignore
 */
class WebgpuCompute {
    /** @type {UniformBuffer[]} */
    uniformBuffers = [];

    /** @type {BindGroup} */
    bindGroup = null;

    constructor(compute) {
        this.compute = compute;

        const { device, shader } = compute;

        DebugGraphics.pushGpuMarker(device, `Compute:${compute.name}`);

        // create bind group
        const { computeBindGroupFormat, computeUniformBufferFormats } = shader.impl;
        Debug.assert(computeBindGroupFormat, 'Compute shader does not have computeBindGroupFormat specified', shader);

        // this.bindGroup = new BindGroup(device, computeBindGroupFormat, this.uniformBuffer);
        this.bindGroup = new BindGroup(device, computeBindGroupFormat);
        DebugHelper.setName(this.bindGroup, `Compute-BindGroup_${this.bindGroup.id}`);

        if (computeUniformBufferFormats) {
            for (const name in computeUniformBufferFormats) {
                if (computeUniformBufferFormats.hasOwnProperty(name)) {
                    // TODO: investigate implications of using a non-persistent uniform buffer
                    const ub = new UniformBuffer(device, computeUniformBufferFormats[name], true);
                    this.uniformBuffers.push(ub);
                    this.bindGroup.setUniformBuffer(name, ub);
                }
            }
        }

        // pipeline
        this.pipeline = device.computePipeline.get(shader, computeBindGroupFormat);

        DebugGraphics.popGpuMarker(device);
    }

    destroy() {

        this.uniformBuffers.forEach(ub => ub.destroy());
        this.uniformBuffers.length = 0;

        this.bindGroup.destroy();
        this.bindGroup = null;
    }

    updateBindGroup() {

        // bind group data
        const { bindGroup } = this;
        bindGroup.updateUniformBuffers();
        bindGroup.update();
    }

    dispatch(x, y, z) {

        // bind group
        const device = this.compute.device;
        device.setBindGroup(0, this.bindGroup);

        // compute pipeline
        const passEncoder = device.passEncoder;
        passEncoder.setPipeline(this.pipeline);

        // dispatch
        const { indirectSlotIndex, indirectBuffer, indirectFrameStamp } = this.compute;
        if (indirectSlotIndex >= 0) {
            let gpuBuffer;
            if (indirectBuffer) {
                // custom buffer - user owns lifetime, no frame validation
                gpuBuffer = indirectBuffer.impl.buffer;
            } else {
                // built-in buffer - validate frame stamp
                Debug.assert(indirectFrameStamp === device.renderVersion, 'Indirect dispatch slot must be set each frame using setupIndirectDispatch()');
                gpuBuffer = device.indirectDispatchBuffer.impl.buffer;
            }
            const offset = indirectSlotIndex * _indirectDispatchEntryByteSize;
            passEncoder.dispatchWorkgroupsIndirect(gpuBuffer, offset);
        } else {
            passEncoder.dispatchWorkgroups(x, y, z);
        }
    }
}

export { WebgpuCompute };
