import { Debug, DebugHelper } from '../../../core/debug.js';
import { WebgpuDebug } from './webgpu-debug.js';

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
        const descr = this.createDescriptor(device, bindGroup);

        WebgpuDebug.validate(device);

        this.bindGroup = device.wgpu.createBindGroup(descr);

        WebgpuDebug.end(device, {
            debugFormat: this.debugFormat,
            descr: descr,
            format: bindGroup.format,
            bindGroup: bindGroup
        });
    }

    destroy() {
        // this.bindGroup?.destroy();
        this.bindGroup = null;
    }

    /**
     * Creates a bind group descriptor in WebGPU format
     *
     * @param {import('./webgpu-graphics-device.js').WebgpuGraphicsDevice} device - Graphics device.
     * @param {import('../bind-group.js').BindGroup} bindGroup - Bind group to create the
     * descriptor for.
     * @returns {object} - Returns the generated descriptor of type
     * GPUBindGroupDescriptor, which can be used to create a GPUBindGroup
     */
    createDescriptor(device, bindGroup) {

        // Note: This needs to match WebgpuBindGroupFormat.createDescriptor
        const entries = [];

        const format = bindGroup.format;

        Debug.call(() => {
            this.debugFormat = '';
        });

        // uniform buffers
        let index = 0;
        bindGroup.uniformBuffers.forEach((ub) => {
            const buffer = ub.persistent ? ub.impl.buffer : ub.allocation.gpuBuffer.buffer;
            Debug.assert(buffer, 'NULL uniform buffer cannot be used by the bind group');
            Debug.call(() => {
                this.debugFormat += `${index}: UB\n`;
            });

            entries.push({
                binding: index++,
                resource: {
                    buffer: buffer,
                    offset: 0,
                    size: ub.format.byteSize
                }
            });
        });

        // textures
        bindGroup.textures.forEach((tex, textureIndex) => {

            /** @type {import('./webgpu-texture.js').WebgpuTexture} */
            const wgpuTexture = tex.impl;
            const textureFormat = format.textureFormats[textureIndex];

            // texture
            const view = wgpuTexture.getView(device);
            Debug.assert(view, 'NULL texture view cannot be used by the bind group');
            Debug.call(() => {
                this.debugFormat += `${index}: ${bindGroup.format.textureFormats[textureIndex].name}\n`;
            });

            entries.push({
                binding: index++,
                resource: view
            });

            // sampler
            const sampler = wgpuTexture.getSampler(device, textureFormat.sampleType);
            Debug.assert(sampler, 'NULL sampler cannot be used by the bind group');
            Debug.call(() => {
                this.debugFormat += `${index}: ${sampler.label}\n`;
            });

            entries.push({
                binding: index++,
                resource: sampler
            });
        });

        // storage textures
        bindGroup.storageTextures.forEach((tex, textureIndex) => {

            /** @type {import('./webgpu-texture.js').WebgpuTexture} */
            const wgpuTexture = tex.impl;

            // texture
            const view = wgpuTexture.getView(device);
            Debug.assert(view, 'NULL texture view cannot be used by the bind group');
            Debug.call(() => {
                this.debugFormat += `${index}: ${bindGroup.format.storageTextureFormats[textureIndex].name}\n`;
            });

            entries.push({
                binding: index++,
                resource: view
            });
        });

        const descr = {
            layout: bindGroup.format.impl.bindGroupLayout,
            entries: entries
        };

        DebugHelper.setLabel(descr, bindGroup.name);

        return descr;
    }
}

export { WebgpuBindGroup };
