import { Debug, DebugHelper } from '../../../core/debug.js';

import {
    PIXELFORMAT_A8, PIXELFORMAT_L8, PIXELFORMAT_L8_A8, PIXELFORMAT_R5_G6_B5, PIXELFORMAT_R5_G5_B5_A1, PIXELFORMAT_R4_G4_B4_A4,
    PIXELFORMAT_R8_G8_B8, PIXELFORMAT_R8_G8_B8_A8, PIXELFORMAT_DXT1, PIXELFORMAT_DXT3, PIXELFORMAT_DXT5,
    PIXELFORMAT_RGB16F, PIXELFORMAT_RGBA16F, PIXELFORMAT_RGB32F, PIXELFORMAT_RGBA32F, PIXELFORMAT_R32F, PIXELFORMAT_DEPTH,
    PIXELFORMAT_DEPTHSTENCIL, PIXELFORMAT_111110F, PIXELFORMAT_SRGB, PIXELFORMAT_SRGBA, PIXELFORMAT_ETC1,
    PIXELFORMAT_ETC2_RGB, PIXELFORMAT_ETC2_RGBA, PIXELFORMAT_PVRTC_2BPP_RGB_1, PIXELFORMAT_PVRTC_2BPP_RGBA_1,
    PIXELFORMAT_PVRTC_4BPP_RGB_1, PIXELFORMAT_PVRTC_4BPP_RGBA_1, PIXELFORMAT_ASTC_4x4, PIXELFORMAT_ATC_RGB,
    PIXELFORMAT_ATC_RGBA
} from '../constants.js';

// map of PIXELFORMAT_*** to GPUTextureFormat
const gpuTextureFormats = [];
gpuTextureFormats[PIXELFORMAT_A8] = '';
gpuTextureFormats[PIXELFORMAT_L8] = '';
gpuTextureFormats[PIXELFORMAT_L8_A8] = '';
gpuTextureFormats[PIXELFORMAT_R5_G6_B5] = '';
gpuTextureFormats[PIXELFORMAT_R5_G5_B5_A1] = '';
gpuTextureFormats[PIXELFORMAT_R4_G4_B4_A4] = '';
gpuTextureFormats[PIXELFORMAT_R8_G8_B8] = 'bgra8unorm';
gpuTextureFormats[PIXELFORMAT_R8_G8_B8_A8] = 'bgra8unorm';
gpuTextureFormats[PIXELFORMAT_DXT1] = '';
gpuTextureFormats[PIXELFORMAT_DXT3] = '';
gpuTextureFormats[PIXELFORMAT_DXT5] = '';
gpuTextureFormats[PIXELFORMAT_RGB16F] = '';
gpuTextureFormats[PIXELFORMAT_RGBA16F] = 'rgba16float';
gpuTextureFormats[PIXELFORMAT_RGB32F] = '';
gpuTextureFormats[PIXELFORMAT_RGBA32F] = 'rgba32float';
gpuTextureFormats[PIXELFORMAT_R32F] = 'r32float';
gpuTextureFormats[PIXELFORMAT_DEPTH] = 'depth32float';
gpuTextureFormats[PIXELFORMAT_DEPTHSTENCIL] = 'depth24plus-stencil8';
gpuTextureFormats[PIXELFORMAT_111110F] = 'rg11b10ufloat';
gpuTextureFormats[PIXELFORMAT_SRGB] = '';
gpuTextureFormats[PIXELFORMAT_SRGBA] = '';
gpuTextureFormats[PIXELFORMAT_ETC1] = '';
gpuTextureFormats[PIXELFORMAT_ETC2_RGB] = '';
gpuTextureFormats[PIXELFORMAT_ETC2_RGBA] = '';
gpuTextureFormats[PIXELFORMAT_PVRTC_2BPP_RGB_1] = '';
gpuTextureFormats[PIXELFORMAT_PVRTC_2BPP_RGBA_1] = '';
gpuTextureFormats[PIXELFORMAT_PVRTC_4BPP_RGB_1] = '';
gpuTextureFormats[PIXELFORMAT_PVRTC_4BPP_RGBA_1] = '';
gpuTextureFormats[PIXELFORMAT_ASTC_4x4] = '';
gpuTextureFormats[PIXELFORMAT_ATC_RGB] = '';
gpuTextureFormats[PIXELFORMAT_ATC_RGBA] = '';

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

    /** @type {GPUTextureDescriptor} */
    descr;

    constructor(texture) {
        /** @type {import('../texture.js').Texture} */
        this.texture = texture;
    }

    create(device) {

        const texture = this.texture;
        const wgpu = device.wgpu;
        const gpuFormat = gpuTextureFormats[texture.format];
        Debug.assert(gpuFormat !== '', `WebGPU does not support texture format ${texture.format} for texture ${texture.name}`, texture);

        this.descr = {
            size: { width: texture.width, height: texture.height },
            format: gpuFormat,
            mipLevelCount: 1,
            sampleCount: 1,
            dimension: '2d',

            // TODO: use only required usage flags
            usage: GPUTextureUsage.TEXTURE_BINDING | GPUTextureUsage.COPY_DST | GPUTextureUsage.RENDER_ATTACHMENT
        };

        this.gpuTexture = wgpu.createTexture(this.descr);
        DebugHelper.setLabel(this.gpuTexture, texture.name);

        this.view = this.gpuTexture.createView();
        DebugHelper.setLabel(this.view, `DefaultView: ${this.texture.name}`);
    }

    destroy(device) {
    }

    getView(device) {

        this.uploadImmediate(device, this.texture);

        Debug.assert(this.view);
        return this.view;
    }

    getSampler(device) {
        if (!this.sampler) {

            // TODO: this is temporary and needs to be made generic
            if (this.texture.format === PIXELFORMAT_RGBA32F) {

                this.sampler = device.wgpu.createSampler({
                    magFilter: "nearest",
                    minFilter: "nearest",
                    mipmapFilter: "nearest"
                });
                DebugHelper.setLabel(this.sampler, `NearestSampler`);

            } else {

                this.sampler = device.wgpu.createSampler({
                    magFilter: "linear",
                    minFilter: "linear",
                    mipmapFilter: "linear"
                });
                DebugHelper.setLabel(this.sampler, `LinearSampler`);
            }
        }

        return this.sampler;
    }

    loseContext() {
    }

    /**
     * @param {import('./webgpu-graphics-device.js').WebgpuGraphicsDevice} device - The graphics
     * device.
     * @param {import('../texture.js').Texture} texture - The texture.
     */
    uploadImmediate(device, texture) {

        if (!this.gpuTexture) {
            this.create(device);
        }

        if (texture._needsUpload || texture._needsMipmapsUpload) {
            this.uploadData(device);

            texture._needsUpload = false;
            texture._needsMipmapsUpload = false;
        }
    }

    /**
     * @param {import('./webgpu-graphics-device.js').WebgpuGraphicsDevice} device - The graphics
     * device.
     */
    uploadData(device) {

        const texture = this.texture;
        const wgpu = device.wgpu;

        // upload texture data if any
        const mipLevel = 0;
        const mipObject = texture._levels[mipLevel];
        if (mipObject) {

            if (mipObject instanceof ImageBitmap) {

                wgpu.queue.copyExternalImageToTexture({ source: mipObject }, { texture: this.gpuTexture }, this.descr.size);

            } else if (ArrayBuffer.isView(mipObject)) { // typed array

                this.uploadTypedArrayData(wgpu, mipObject);

            } else {

                Debug.error('Unsupported texture source data', mipObject);
            }
        }
    }

    uploadTypedArrayData(wgpu, data) {

        const texture = this.texture;

        /** @type {GPUImageCopyTexture} */
        const dest = {
            texture: this.gpuTexture,
            mipLevel: 0
        };

        // TODO: RGBA only for now, needs to be more generic
        const numElementsPerPixel = 4;

        /** @type {GPUImageDataLayout} */
        const dataLayout = {
            offset: 0,
            bytesPerRow: texture.width * data.BYTES_PER_ELEMENT * numElementsPerPixel,
            rowsPerImage: texture.height
        };

        const size = {
            width: texture.width,
            height: texture.height,
            depthOrArrayLayers: 1
        };

        wgpu.queue.writeTexture(dest, data, dataLayout, size);
    }
}

export { WebgpuTexture };
