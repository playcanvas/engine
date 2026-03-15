import { Debug, DebugHelper } from '../../../core/debug.js';
import { WebgpuDebug } from './webgpu-debug.js';
import { TextureView } from '../texture-view.js';

/**
 * @import { BindGroup } from '../bind-group.js'
 * @import { WebgpuGraphicsDevice } from './webgpu-graphics-device.js'
 * @import { WebgpuTexture } from './webgpu-texture.js'
 */

/**
 * A WebGPU implementation of the BindGroup, which is a wrapper over GPUBindGroup.
 *
 * @ignore
 */
class WebgpuBindGroup {
    /**
     * @type {GPUBindGroup}
     * @private
     */
    bindGroup;

    update(bindGroup) {

        this.destroy();
        const device = bindGroup.device;

        /** @type {GPUBindGroupDescriptor} */
        const desc = this.createDescriptor(device, bindGroup);

        WebgpuDebug.validate(device);

        this.bindGroup = device.wgpu.createBindGroup(desc);

        WebgpuDebug.end(device, 'BindGroup creation', {
            debugFormat: this.debugFormat,
            desc: desc,
            format: bindGroup.format,
            bindGroup: bindGroup
        });
    }

    destroy() {
        this.bindGroup = null;
    }

    /**
     * Creates a bind group descriptor in WebGPU format
     *
     * @param {WebgpuGraphicsDevice} device - Graphics device.
     * @param {BindGroup} bindGroup - Bind group to create the
     * descriptor for.
     * @returns {object} - Returns the generated descriptor of type GPUBindGroupDescriptor, which
     * can be used to create a GPUBindGroup
     */
    createDescriptor(device, bindGroup) {

        // Note: This needs to match WebgpuBindGroupFormat.createDescriptor
        const entries = [];

        const format = bindGroup.format;

        Debug.call(() => {
            this.debugFormat = '';
        });

        // uniform buffers
        const uniformBufferFormats = bindGroup.format.uniformBufferFormats;
        bindGroup.uniformBuffers.forEach((ub, i) => {
            const slot = uniformBufferFormats[i].slot;
            const buffer = ub.persistent ? ub.impl.buffer : ub.allocation.gpuBuffer.buffer;
            Debug.assert(buffer, 'NULL uniform buffer cannot be used by the bind group');
            Debug.call(() => {
                this.debugFormat += `${slot}: UB\n`;
            });

            entries.push({
                binding: slot,
                resource: {
                    buffer: buffer,
                    offset: 0,
                    size: ub.format.byteSize
                }
            });
        });

        // textures
        const textureFormats = bindGroup.format.textureFormats;
        bindGroup.textures.forEach((value, textureIndex) => {

            // Value can be a Texture or TextureView
            const isTextureView = value instanceof TextureView;
            const texture = isTextureView ? value.texture : value;

            /** @type {WebgpuTexture} */
            const wgpuTexture = texture.impl;
            const textureFormat = format.textureFormats[textureIndex];
            const slot = textureFormats[textureIndex].slot;

            // texture - pass TextureView for mip level / array layer selection if provided
            const view = wgpuTexture.getView(device, isTextureView ? value : undefined);
            Debug.assert(view, `NULL texture view [${textureFormat.name}] (slot ${slot}) cannot be used by the bind group`);
            Debug.call(() => {
                this.debugFormat += `${slot}: ${bindGroup.format.textureFormats[textureIndex].name}\n`;
            });

            entries.push({
                binding: slot,
                resource: view
            });

            // sampler
            if (textureFormat.hasSampler) {
                const sampler = wgpuTexture.getSampler(device, textureFormat.sampleType);
                Debug.assert(sampler, `NULL sampler [${textureFormat.name}] (slot ${slot + 1}) cannot be used by the bind group`);
                Debug.call(() => {
                    this.debugFormat += `${slot + 1}: ${sampler.label}\n`;
                });

                entries.push({
                    binding: slot + 1,
                    resource: sampler
                });
            }
        });

        // storage textures
        const storageTextureFormats = bindGroup.format.storageTextureFormats;
        bindGroup.storageTextures.forEach((value, textureIndex) => {

            // Value can be a Texture or TextureView
            const isTextureView = value instanceof TextureView;
            const texture = isTextureView ? value.texture : value;

            /** @type {WebgpuTexture} */
            const wgpuTexture = texture.impl;
            const slot = storageTextureFormats[textureIndex].slot;

            // Get view - pass TextureView for mip level / array layer selection if provided
            const view = wgpuTexture.getView(device, isTextureView ? value : undefined);
            Debug.assert(view, `NULL storage texture view [${storageTextureFormats[textureIndex].name}] (slot ${slot}) cannot be used by the bind group`);
            Debug.call(() => {
                this.debugFormat += `${slot}: ${bindGroup.format.storageTextureFormats[textureIndex].name}\n`;
            });

            entries.push({
                binding: slot,
                resource: view
            });
        });

        // storage buffers
        const storageBufferFormats = bindGroup.format.storageBufferFormats;
        bindGroup.storageBuffers.forEach((buffer, bufferIndex) => {
            /** @type {GPUBuffer} */
            const wgpuBuffer = buffer.impl.buffer;
            const slot = storageBufferFormats[bufferIndex].slot;

            Debug.assert(wgpuBuffer, `NULL storage buffer [${storageBufferFormats[bufferIndex].name}] (slot ${slot}, id ${buffer.id}, size ${buffer.byteSize}) cannot be used by the bind group`);
            Debug.call(() => {
                this.debugFormat += `${slot}: SB\n`;
            });

            entries.push({
                binding: slot,
                resource: {
                    buffer: wgpuBuffer
                }
            });
        });

        const desc = {
            layout: bindGroup.format.impl.bindGroupLayout,
            entries: entries
        };

        DebugHelper.setLabel(desc, bindGroup.name);

        return desc;
    }
}

export { WebgpuBindGroup };
