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

    /**
     * Bind groups, indexed by bind group index. A caller-provided format occupies group 0;
     * auto-reflected resources occupy their own group (0 when no caller format, otherwise 1).
     * The array is dense (no gaps), as required by WebGPU pipeline layouts.
     *
     * @type {BindGroup[]}
     */
    bindGroups = [];

    constructor(compute) {
        this.compute = compute;

        const { device, shader } = compute;

        DebugGraphics.pushGpuMarker(device, `Compute:${compute.name}`);

        const {
            computeBindGroupFormat, computeUniformBufferFormats,
            computeReflectedBindGroupFormat, computeReflectedUniformBufferFormat,
            computeReflectedGroupIndex
        } = shader.impl;

        // caller uniform buffers are bound into the caller bind group, so the format is required
        Debug.assert(!computeUniformBufferFormats || computeBindGroupFormat,
            'Compute shader specifies computeUniformBufferFormats but no computeBindGroupFormat to bind them into', shader);

        // ordered, gapless array of bind group formats (array index === bind group index)
        const formats = [];

        // group 0: caller-provided resources (if any)
        if (computeBindGroupFormat) {
            const bindGroup = new BindGroup(device, computeBindGroupFormat);
            DebugHelper.setName(bindGroup, `Compute-BindGroup_${bindGroup.id}`);

            if (computeUniformBufferFormats) {
                for (const name in computeUniformBufferFormats) {
                    if (computeUniformBufferFormats.hasOwnProperty(name)) {
                        // TODO: investigate implications of using a non-persistent uniform buffer
                        const ub = new UniformBuffer(device, computeUniformBufferFormats[name], true);
                        this.uniformBuffers.push(ub);
                        bindGroup.setUniformBuffer(name, ub);
                    }
                }
            }

            formats[0] = computeBindGroupFormat;
            this.bindGroups[0] = bindGroup;
        }

        // auto-reflected resources, at their own bind group (0 when no caller format, otherwise 1)
        if (computeReflectedBindGroupFormat) {
            const reflectedBindGroup = new BindGroup(device, computeReflectedBindGroupFormat);
            DebugHelper.setName(reflectedBindGroup, `Compute-ReflectedBindGroup_${reflectedBindGroup.id}`);

            if (computeReflectedUniformBufferFormat) {
                // matches the generated 'ub_compute' uniform buffer (see WebgpuShaderProcessorWGSL.runCompute)
                const ub = new UniformBuffer(device, computeReflectedUniformBufferFormat, true);
                this.uniformBuffers.push(ub);
                reflectedBindGroup.setUniformBuffer('ub_compute', ub);
            }

            formats[computeReflectedGroupIndex] = computeReflectedBindGroupFormat;
            this.bindGroups[computeReflectedGroupIndex] = reflectedBindGroup;
        }

        // pipeline
        this.pipeline = device.computePipeline.get(shader, formats);

        DebugGraphics.popGpuMarker(device);
    }

    destroy() {

        this.uniformBuffers.forEach(ub => ub.destroy());
        this.uniformBuffers.length = 0;

        this.bindGroups.forEach(bindGroup => bindGroup.destroy());
        this.bindGroups.length = 0;
    }

    updateBindGroup() {

        // bind group data
        for (let i = 0; i < this.bindGroups.length; i++) {
            const bindGroup = this.bindGroups[i];
            bindGroup.updateUniformBuffers();
            bindGroup.update();
        }
    }

    dispatch(x, y, z) {

        // bind groups
        const device = this.compute.device;
        for (let i = 0; i < this.bindGroups.length; i++) {
            device.setBindGroup(i, this.bindGroups[i]);
        }

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
