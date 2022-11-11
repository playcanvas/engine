import { Debug, DebugHelper } from '../../../core/debug.js';

/**
 * A WebGPU implementation of the BindGroup, which is a wrapper over GPUBindGroup.
 *
 * @ignore
 */
class WebgpuBindGroup {
    /** @type {GPUBindGroup} */
    bindGroup;

    update(bindGroup) {

        this.destroy();
        const device = bindGroup.device;

        /** @type {GPUBindGroupDescriptor} */
        const descr = this.createDescriptor(device, bindGroup);
        DebugHelper.setLabel(descr, bindGroup.name);

        this.bindGroup = device.wgpu.createBindGroup(descr);
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
     * @returns {GPUBindGroupDescriptor} - Returns the generated descriptor, which can be used to
     * create a GPUBindGroup
     */
    createDescriptor(device, bindGroup) {

        // Note: This needs to match WebgpuBindGroupFormat.createDescriptor
        const entries = [];

        // uniform buffers
        let index = 0;
        bindGroup.uniformBuffers.forEach((ub) => {
            const buffer = ub.impl.buffer;
            Debug.assert(buffer, 'NULL uniform buffer cannot be used by the bind group');
            entries.push({
                binding: index++,
                resource: {
                    buffer: buffer
                }
            });
        });

        // textures
        bindGroup.textures.forEach((tex) => {

            /** @type {import('./webgpu-texture.js').WebgpuTexture} */
            const wgpuTexture = tex.impl;

            // texture
            const view = wgpuTexture.getView(device);
            Debug.assert(view, 'NULL texture view cannot be used by the bind group');
            entries.push({
                binding: index++,
                resource: view
            });

            // sampler
            const sampler = wgpuTexture.getSampler(device);
            Debug.assert(sampler, 'NULL sampler cannot be used by the bind group');
            entries.push({
                binding: index++,
                resource: sampler
            });
        });

        return {
            layout: bindGroup.format.impl.bindGroupLayout,
            entries: entries
        };
    }
}

export { WebgpuBindGroup };
