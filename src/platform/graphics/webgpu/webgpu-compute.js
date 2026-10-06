import { Debug, DebugHelper } from '../../../core/debug.js';
import { BindGroup } from '../bind-group.js';
import { DebugGraphics } from '../debug-graphics.js';
import { UniformBuffer } from '../uniform-buffer.js';

/**
 * @import { Compute } from '../compute.js'
 */

// size of indirect dispatch entry in bytes, 3 x 32bit (x, y, z workgroup counts)
const _indirectDispatchEntryByteSize = 3 * 4;

/**
 * The parameters of the slots of a bind group, in the order of the slots of its format, looked up
 * once instead of by name on each dispatch. Entries are undefined for slots without a parameter.
 *
 * @ignore
 */
class SlotParameters {
    textures = [];

    storageTextures = [];

    storageBuffers = [];

    /**
     * The parameters of the uniforms of each uniform buffer of the bind group.
     *
     * @type {Array<Array<object|undefined>>}
     */
    uniforms = [];
}

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

    /**
     * The parameters of the slots of each bind group, see {@link SlotParameters}.
     *
     * @type {SlotParameters[]}
     */
    slotParameters = [];

    /**
     * The version of the parameters of the compute the slot parameters were looked up for.
     *
     * @type {number}
     */
    slotParametersVersion = -1;

    /**
     * The names of the missing parameters already reported, so that each is reported once.
     *
     * @type {Set<string>|null}
     */
    reportedMissing = null;

    /**
     * @param {Compute} compute - The compute instance.
     */
    constructor(compute) {
        this.compute = compute;

        const { device, activeShader: shader } = compute;

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
        device._computes.add(this);

        DebugGraphics.popGpuMarker(device);
    }

    destroy() {
        this.compute.device._computes.delete(this);
        this.pipeline = null;

        this.uniformBuffers.forEach(ub => ub.destroy());
        this.uniformBuffers.length = 0;

        this.bindGroups.forEach(bindGroup => bindGroup.destroy());
        this.bindGroups.length = 0;
    }

    loseContext() {
        this.pipeline = null;
    }

    restoreContext() {
        const { device, activeShader } = this.compute;
        this.pipeline = device.computePipeline.get(activeShader, this.bindGroups.map(bindGroup => bindGroup.format));
    }

    /**
     * Looks up the parameters of the slots of the bind groups.
     *
     * @private
     */
    _lookUpSlotParameters() {
        const { parameters } = this.compute;
        this.slotParameters.length = 0;
        for (let i = 0; i < this.bindGroups.length; i++) {
            const bindGroup = this.bindGroups[i];
            const { textureFormats, storageTextureFormats, storageBufferFormats } = bindGroup.format;
            const slots = new SlotParameters();
            slots.textures = textureFormats.map(format => parameters.get(format.name));
            slots.storageTextures = storageTextureFormats.map(format => parameters.get(format.name));
            slots.storageBuffers = storageBufferFormats.map(format => parameters.get(format.name));
            slots.uniforms = bindGroup.uniformBuffers.map(ub => ub.format.uniforms.map(uniform => parameters.get(uniform.name)));
            this.slotParameters.push(slots);
        }
        this.slotParametersVersion = this.compute.parametersVersion;
    }

    /**
     * Reports a uniform or resource the shader declares, but the compute has no value for.
     *
     * @param {string} name - The name of the parameter.
     * @private
     */
    _reportMissing(name) {
        Debug.call(() => {
            this.reportedMissing ??= new Set();
            if (!this.reportedMissing.has(name)) {
                this.reportedMissing.add(name);
                const { compute } = this;
                let hint = 'Set it using Compute#setParameter.';
                if (name === 'uSceneColorMap' || name === 'uSceneDepthMap') {
                    const kind = name === 'uSceneColorMap' ? 'Color' : 'Depth';
                    hint = `A compute shader does not read the scene maps from the global scope - include the scene${kind}CS chunk and attach the map using Compute#setScene${kind}Map.`;
                } else if (name === 'computeSceneDepthMap' || name === 'computeSceneDepthCameraParams' || name === 'computeSceneDepthViewProjectionInverse') {
                    hint = 'The shader includes the sceneDepthCS chunk - attach a scene depth map using Compute#setSceneDepthMap.';
                } else if (name === 'computeSceneColorMap') {
                    hint = 'The shader includes the sceneColorCS chunk - attach a scene color map using Compute#setSceneColorMap.';
                }
                Debug.assert(false, `Compute ${compute.name}: the shader uses ${name}, which has no value. ${hint}`, compute);
            }
        });
    }

    updateBindGroup() {

        const { compute } = this;
        if (this.slotParametersVersion !== compute.parametersVersion) {
            this._lookUpSlotParameters();
        }

        // the compute owns its bind groups, and assigns every slot from its own parameters
        for (let i = 0; i < this.bindGroups.length; i++) {
            const bindGroup = this.bindGroups[i];
            const slots = this.slotParameters[i];
            const { textureFormats, storageTextureFormats, storageBufferFormats } = bindGroup.format;

            // uniform buffers
            const uniformBuffers = bindGroup.uniformBuffers;
            for (let u = 0; u < uniformBuffers.length; u++) {
                const uniformBuffer = uniformBuffers[u];
                const uniformFormats = uniformBuffer.format.uniforms;
                const uniformParams = slots.uniforms[u];
                uniformBuffer.startUpdate();
                for (let k = 0; k < uniformFormats.length; k++) {
                    const value = uniformParams[k]?.value;
                    if (value !== undefined && value !== null) {
                        uniformBuffer.setUniform(uniformFormats[k], value);
                    } else {
                        this._reportMissing(uniformFormats[k].name);
                    }
                }
                uniformBuffer.endUpdate();
            }

            // textures, bound to a substitute when missing, to keep going
            for (let k = 0; k < textureFormats.length; k++) {
                let value = slots.textures[k]?.value;
                if (!value) {
                    this._reportMissing(textureFormats[k].name);
                    value = compute.device.builtInTextures[textureFormats[k].substituteTexture];
                }
                bindGroup.setTextureAt(k, value);
            }

            for (let k = 0; k < storageTextureFormats.length; k++) {
                const value = slots.storageTextures[k]?.value;
                if (value) {
                    bindGroup.setStorageTextureAt(k, value);
                } else {
                    this._reportMissing(storageTextureFormats[k].name);
                }
            }

            for (let k = 0; k < storageBufferFormats.length; k++) {
                const value = slots.storageBuffers[k]?.value;
                if (!value) {
                    this._reportMissing(storageBufferFormats[k].name);
                }
                bindGroup.setStorageBufferAt(k, value);
            }

            bindGroup.commit();
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
