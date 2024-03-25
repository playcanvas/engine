import { Debug, DebugHelper } from '../../../core/debug.js';
import { StringIds } from '../../../core/string-ids.js';
import { SAMPLETYPE_FLOAT, SAMPLETYPE_UNFILTERABLE_FLOAT, SAMPLETYPE_DEPTH, SAMPLETYPE_INT, SAMPLETYPE_UINT } from '../constants.js';

import { WebgpuUtils } from './webgpu-utils.js';
import { gpuTextureFormats } from './constants.js';

const samplerTypes = [];
samplerTypes[SAMPLETYPE_FLOAT] = 'filtering';
samplerTypes[SAMPLETYPE_UNFILTERABLE_FLOAT] = 'non-filtering';
samplerTypes[SAMPLETYPE_DEPTH] = 'comparison';

// Using 'comparison' instead of 'non-filtering' may seem unusual, but currently we will get a
// validation error if we use 'non-filtering' along with texelFetch/textureLoad. 'comparison' works
// very well for the most common use-case of integer textures, texelFetch. We may be able to change
// how we initialize the sampler elsewhere to support 'non-filtering' in the future.
samplerTypes[SAMPLETYPE_INT] = 'comparison';
samplerTypes[SAMPLETYPE_UINT] = 'comparison';

const sampleTypes = [];
sampleTypes[SAMPLETYPE_FLOAT] = 'float';
sampleTypes[SAMPLETYPE_UNFILTERABLE_FLOAT] = 'unfilterable-float';
sampleTypes[SAMPLETYPE_DEPTH] = 'depth';
sampleTypes[SAMPLETYPE_INT] = 'sint';
sampleTypes[SAMPLETYPE_UINT] = 'uint';

const stringIds = new StringIds();

/**
 * A WebGPU implementation of the BindGroupFormat, which is a wrapper over GPUBindGroupLayout.
 *
 * @ignore
 */
class WebgpuBindGroupFormat {
    /**
     * @param {import('../bind-group-format.js').BindGroupFormat} bindGroupFormat - Bind group format.
     */
    constructor(bindGroupFormat) {

        /** @type {import('./webgpu-graphics-device.js').WebgpuGraphicsDevice} */
        const device = bindGroupFormat.device;

        const { key, descr } = this.createDescriptor(bindGroupFormat);

        /**
         * Unique key, used for caching
         *
         * @type {number}
         */
        this.key = stringIds.get(key);

        // keep descr in debug mode
        Debug.call(() => {
            this.descr = descr;
        });

        /**
         * @type {GPUBindGroupLayout}
         * @private
         */
        this.bindGroupLayout = device.wgpu.createBindGroupLayout(descr);
        DebugHelper.setLabel(this.bindGroupLayout, bindGroupFormat.name);
    }

    destroy() {
        this.bindGroupLayout = null;
    }

    loseContext() {
        // this.bindGroupLayout = null;
    }

    /**
     * Returns texture binding slot.
     *
     * @param {import('../bind-group-format.js').BindGroupFormat} bindGroupFormat - Bind group format.
     * @param {number} index - The index of the texture.
     * @returns {number} - The slot index.
     */
    getTextureSlot(bindGroupFormat, index) {
        // each texture takes 2 slots (texture, sampler) and those are added after uniform buffers
        return bindGroupFormat.bufferFormats.length + index * 2;
    }

    /**
     * @param {any} bindGroupFormat - The format of the bind group.
     * @returns {any} Returns the bind group descriptor.
     */
    createDescriptor(bindGroupFormat) {

        // all WebGPU bindings:
        // - buffer: GPUBufferBindingLayout, resource type is GPUBufferBinding
        // - sampler: GPUSamplerBindingLayout, resource type is GPUSampler
        // - texture: GPUTextureBindingLayout, resource type is GPUTextureView
        // - storageTexture: GPUStorageTextureBindingLayout, resource type is GPUTextureView
        // - externalTexture: GPUExternalTextureBindingLayout, resource type is GPUExternalTexture
        const entries = [];

        // generate unique key
        let key = '';
        let index = 0;

        // buffers
        bindGroupFormat.bufferFormats.forEach((bufferFormat) => {

            const visibility = WebgpuUtils.shaderStage(bufferFormat.visibility);
            key += `#${index}U:${visibility}`;

            entries.push({
                binding: index++,
                visibility: visibility,

                buffer: {

                    type: 'uniform', // "uniform", "storage", "read-only-storage"

                    // whether this binding requires a dynamic offset
                    // currently all UBs are dynamic and need the offset
                    hasDynamicOffset: true

                    // defaults to 0 meaning no validation, can do early size validation using it
                    // minBindingSize
                }
            });
        });

        // textures
        bindGroupFormat.textureFormats.forEach((textureFormat) => {

            const visibility = WebgpuUtils.shaderStage(textureFormat.visibility);

            // texture
            const sampleType = textureFormat.sampleType;
            const viewDimension = textureFormat.textureDimension;
            const multisampled = false;

            const gpuSampleType = sampleTypes[sampleType];
            Debug.assert(gpuSampleType);

            key += `#${index}T:${visibility}-${gpuSampleType}-${viewDimension}-${multisampled}`;

            // texture
            entries.push({
                binding: index++,
                visibility: visibility,
                texture: {
                    // Indicates the type required for texture views bound to this binding.
                    // "float", "unfilterable-float", "depth", "sint", "uint",
                    sampleType: gpuSampleType,

                    // Indicates the required dimension for texture views bound to this binding.
                    // "1d", "2d", "2d-array", "cube", "cube-array", "3d"
                    viewDimension: viewDimension,

                    // Indicates whether or not texture views bound to this binding must be multisampled
                    multisampled: multisampled
                }
            });

            // sampler
            const gpuSamplerType = samplerTypes[sampleType];
            Debug.assert(gpuSamplerType);

            key += `#${index}S:${visibility}-${gpuSamplerType}`;

            entries.push({
                binding: index++,
                visibility: visibility,
                sampler: {
                    // Indicates the required type of a sampler bound to this bindings
                    // 'filtering', 'non-filtering', 'comparison'
                    type: gpuSamplerType
                }
            });
        });

        // storage textures
        bindGroupFormat.storageTextureFormats.forEach((textureFormat) => {

            const { format, textureDimension } = textureFormat;
            key += `#${index}ST:${format}-${textureDimension}`;

            // storage texture
            entries.push({
                binding: index++,
                visibility: GPUShaderStage.COMPUTE,
                storageTexture: {

                    // The access mode for this binding, indicating readability and writability.
                    access: 'write-only', // only single option currently, more in the future

                    // The required format of texture views bound to this binding.
                    format: gpuTextureFormats[format],

                    // Indicates the required dimension for texture views bound to this binding.
                    // "1d", "2d", "2d-array", "cube", "cube-array", "3d"
                    viewDimension: textureDimension
                }
            });
        });

        /** @type {GPUBindGroupLayoutDescriptor} */
        const descr = {
            entries: entries
        };

        return {
            key,
            descr
        };
    }
}

export { WebgpuBindGroupFormat };
