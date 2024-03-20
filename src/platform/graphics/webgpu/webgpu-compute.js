import { Debug, DebugHelper } from "../../../core/debug.js";
import { BindGroup } from "../bind-group.js";
import { UniformBuffer } from "../uniform-buffer.js";

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
        const { computeBindGroupFormat, computeUniformBufferFormat } = shader.impl;
        Debug.assert(computeBindGroupFormat, 'Compute shader does not have computeBindGroupFormat specified', shader);

        if (computeUniformBufferFormat) {
            // TODO: investigate implications of using a non-persistent uniform buffer
            this.uniformBuffer = new UniformBuffer(device, computeUniformBufferFormat, true);
        }

        this.bindGroup = new BindGroup(device, computeBindGroupFormat, this.uniformBuffer);
        DebugHelper.setName(this.bindGroup, `Compute-BindGroup_${this.bindGroup.id}`);

        // pipeline
        this.pipeline = device.computePipeline.get(shader, computeBindGroupFormat);
    }

    updateBindGroup() {

        // bind group data
        const { bindGroup } = this;
        bindGroup.defaultUniformBuffer?.update();
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
