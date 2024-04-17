import { Debug, DebugHelper } from "../../../core/debug.js";
import { BindGroup } from "../bind-group.js";
import { DebugGraphics } from "../debug-graphics.js";
import { UniformBuffer } from "../uniform-buffer.js";

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

        // dispatch
        const passEncoder = device.passEncoder;
        passEncoder.setPipeline(this.pipeline);
        passEncoder.dispatchWorkgroups(x, y, z);
    }
}

export { WebgpuCompute };
