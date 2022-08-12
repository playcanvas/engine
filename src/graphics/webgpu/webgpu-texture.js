import { Debug, DebugHelper } from '../../core/debug.js';

/** @typedef {import('./webgpu-graphics-device.js').WebgpuGraphicsDevice} WebgpuGraphicsDevice */
/** @typedef {import('../texture.js').Texture} Texture */

/**
 * A WebGPU implementation of the Texture.
 *
 * @ignore
 */
class WebgpuTexture {
    /** @type {GPUTexture} */
    gpuTexture;

    /** @type {GPUTextureView} */
    view;

    /** @type {GPUSampler} */
    sampler;

    constructor(texture) {
        /** @type {Texture} */
        this.texture = texture;
    }

    destroy(device) {
    }

    getView(device) {

        if (!this.gpuTexture) {

            this.upload(device);

            this.view = this.gpuTexture.createView();
            DebugHelper.setLabel(this.view, `DefaultView: ${this.texture.name}`);
        }

        return this.view;
    }

    getSampler(device) {
        if (!this.sampler) {
            this.sampler = device.wgpu.createSampler({
                magFilter: "linear",
                minFilter: "linear",
                mipmapFilter: "linear"
            });
        }

        return this.sampler;
    }

    loseContext() {
    }

    /**
     * @param {WebgpuGraphicsDevice} device - The graphics device.
     */
    upload(device) {

        const texture = this.texture;
        const wgpu = device.wgpu;

        const textureDescriptor = {
            size: { width: texture.width, height: texture.height },
            format: 'bgra8unorm',

            // TODO: use only required usage flags
            usage: GPUTextureUsage.TEXTURE_BINDING | GPUTextureUsage.COPY_DST | GPUTextureUsage.RENDER_ATTACHMENT
        };

        this.gpuTexture = wgpu.createTexture(textureDescriptor);

        // load texture data if any
        const mipLevel = 0;
        const mipObject = texture._levels[mipLevel];
        if (mipObject) {
            // this needs to be ImageBitmap for now
            Debug.assert(mipObject instanceof ImageBitmap);
            wgpu.queue.copyExternalImageToTexture({ source: mipObject }, { texture: this.gpuTexture }, textureDescriptor.size);
        }
    }
}

export { WebgpuTexture };
