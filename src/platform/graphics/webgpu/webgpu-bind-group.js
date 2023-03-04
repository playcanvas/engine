import { Debug, DebugHelper } from '../../../core/debug.js';

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

        Debug.call(() => {
            device.wgpu.pushErrorScope('validation');
        });

        this.bindGroup = device.wgpu.createBindGroup(descr);

        Debug.call(() => {
            device.wgpu.popErrorScope().then((error) => {
                if (error) {
                    Debug.gpuError(error.message, {
                        debugFormat: this.debugFormat,
                        descr: descr,
                        format: bindGroup.format,
                        bindGroup: bindGroup
                    });
                }
            });
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
            const buffer = ub.impl.buffer;
            Debug.assert(buffer, 'NULL uniform buffer cannot be used by the bind group');
            Debug.call(() => {
                this.debugFormat += `${index}: UB\n`;
            });

            entries.push({
                binding: index++,
                resource: {
                    buffer: buffer
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

        const descr = {
            layout: bindGroup.format.impl.bindGroupLayout,
            entries: entries
        };

        DebugHelper.setLabel(descr, bindGroup.name);

        return descr;
    }
}

export { WebgpuBindGroup };
