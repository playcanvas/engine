import { Debug } from '../../../core/debug.js';
import { SAMPLETYPE_FLOAT, SAMPLETYPE_UNFILTERABLE_FLOAT, SAMPLETYPE_DEPTH } from '../constants.js';

/** @typedef {import('../bind-group-format.js').BindGroupFormat} BindGroupFormat */
/** @typedef {import('./webgpu-graphics-device.js').WebgpuGraphicsDevice} WebgpuGraphicsDevice */

import { WebgpuUtils } from './webgpu-utils.js';

const samplerTypes = { };
samplerTypes[SAMPLETYPE_FLOAT] = 'filtering';
samplerTypes[SAMPLETYPE_UNFILTERABLE_FLOAT] = 'non-filtering';
samplerTypes[SAMPLETYPE_DEPTH] = 'comparison';

/**
 * A WebGPU implementation of the BindGroupFormat, which is a wrapper over GPUBindGroupLayout.
 *
 * @ignore
 */
class WebgpuBindGroupFormat {
    /**
     * @param {BindGroupFormat} bindGroupFormat -
     */
    constructor(bindGroupFormat) {

        /** @type {WebgpuGraphicsDevice} */
        const device = bindGroupFormat.device;

        /** @type {GPUBindGroupLayoutDescriptor} */
        const { key, descr } = this.createDescriptor(bindGroupFormat);

        /**
         * Unique key, used for caching
         *
         * @type {string}
         */
        this.key = key;

        /** @type {GPUBindGroupLayout} */
        this.bindGroupLayout = device.wgpu.createBindGroupLayout(descr);
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
     * @param {BindGroupFormat} bindGroupFormat -
     * @param {number} index - The index of the texture.
     * @returns {number} - The slot index.
     */
    getTextureSlot(bindGroupFormat, index) {
        // each texture takes 2 slots (texture, sampler) and those are added after uniform buffers
        return bindGroupFormat.bufferFormats.length + index * 2;
    }

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
        bindGroupFormat.bufferFormats.forEach((bufferFormat) => {

            const visibility = WebgpuUtils.shaderStage(bufferFormat.visibility);
            key += `#${index}U:${visibility}`;

            entries.push({
                binding: index++,
                visibility: visibility,

                buffer: {

                    type: 'uniform', // "uniform", "storage", "read-only-storage"

                    // whether this binding requires a dynamic offset
                    hasDynamicOffset: false

                    // defaults to 0 meaning no validation, can do early size validation using it
                    // minBindingSize
                }
            });
        });

        bindGroupFormat.textureFormats.forEach((textureFormat) => {

            const visibility = WebgpuUtils.shaderStage(textureFormat.visibility);

            // texture
            const sampleType = textureFormat.sampleType;
            const viewDimension = textureFormat.textureDimension;
            const multisampled = false;

            key += `#${index}T:${visibility}-${sampleType}-${viewDimension}-${multisampled}`;

            entries.push({
                binding: index++,
                visibility: visibility,
                texture: {
                    // Indicates the type required for texture views bound to this binding.
                    // "float", "unfilterable-float", "depth", "sint", "uint",
                    sampleType: sampleType,

                    // Indicates the required dimension for texture views bound to this binding.
                    // "1d", "2d", "2d-array", "cube", "cube-array", "3d"
                    viewDimension: viewDimension,

                    // Indicates whether or not texture views bound to this binding must be multisampled
                    multisampled: multisampled
                }
            });

            // sampler
            const type = samplerTypes[sampleType];
            Debug.assert(type);

            key += `#${index}S:${visibility}-${type}`;

            entries.push({
                binding: index++,
                visibility: visibility,
                sampler: {
                    // Indicates the required type of a sampler bound to this bindings
                    // 'filtering', 'non-filtering', 'comparison'
                    type: type
                }
            });
        });

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
