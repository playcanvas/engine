import { TRACEID_RENDER_QUEUE } from '../../../core/constants.js';
import { Debug, DebugHelper } from '../../../core/debug.js';
import { math } from '../../../core/math/math.js';

import {
    pixelFormatInfo,
    ADDRESS_REPEAT, ADDRESS_CLAMP_TO_EDGE, ADDRESS_MIRRORED_REPEAT,
    PIXELFORMAT_A8, PIXELFORMAT_L8, PIXELFORMAT_LA8, PIXELFORMAT_RGB565, PIXELFORMAT_RGBA5551, PIXELFORMAT_RGBA4,
    PIXELFORMAT_RGB8, PIXELFORMAT_RGBA8, PIXELFORMAT_DXT1, PIXELFORMAT_DXT3, PIXELFORMAT_DXT5,
    PIXELFORMAT_RGB16F, PIXELFORMAT_RGBA16F, PIXELFORMAT_RGB32F, PIXELFORMAT_RGBA32F, PIXELFORMAT_R32F, PIXELFORMAT_DEPTH,
    PIXELFORMAT_DEPTHSTENCIL, PIXELFORMAT_111110F, PIXELFORMAT_SRGB, PIXELFORMAT_SRGBA, PIXELFORMAT_ETC1,
    PIXELFORMAT_ETC2_RGB, PIXELFORMAT_ETC2_RGBA, PIXELFORMAT_PVRTC_2BPP_RGB_1, PIXELFORMAT_PVRTC_2BPP_RGBA_1,
    PIXELFORMAT_PVRTC_4BPP_RGB_1, PIXELFORMAT_PVRTC_4BPP_RGBA_1, PIXELFORMAT_ASTC_4x4, PIXELFORMAT_ATC_RGB,
    PIXELFORMAT_ATC_RGBA, PIXELFORMAT_BGRA8, SAMPLETYPE_UNFILTERABLE_FLOAT, SAMPLETYPE_DEPTH,
    FILTER_NEAREST, FILTER_LINEAR, FILTER_NEAREST_MIPMAP_NEAREST, FILTER_NEAREST_MIPMAP_LINEAR, FILTER_LINEAR_MIPMAP_NEAREST, FILTER_LINEAR_MIPMAP_LINEAR
} from '../constants.js';
import { TextureUtils } from '../texture-utils.js';
import { WebgpuDebug } from './webgpu-debug.js';

// map of PIXELFORMAT_*** to GPUTextureFormat
const gpuTextureFormats = [];
gpuTextureFormats[PIXELFORMAT_A8] = '';
gpuTextureFormats[PIXELFORMAT_L8] = 'r8unorm';
gpuTextureFormats[PIXELFORMAT_LA8] = 'rg8unorm';
gpuTextureFormats[PIXELFORMAT_RGB565] = '';
gpuTextureFormats[PIXELFORMAT_RGBA5551] = '';
gpuTextureFormats[PIXELFORMAT_RGBA4] = '';
gpuTextureFormats[PIXELFORMAT_RGB8] = 'rgba8unorm';
gpuTextureFormats[PIXELFORMAT_RGBA8] = 'rgba8unorm';
gpuTextureFormats[PIXELFORMAT_DXT1] = 'bc1-rgba-unorm';
gpuTextureFormats[PIXELFORMAT_DXT3] = 'bc2-rgba-unorm';
gpuTextureFormats[PIXELFORMAT_DXT5] = 'bc3-rgba-unorm';
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
gpuTextureFormats[PIXELFORMAT_ETC2_RGB] = 'etc2-rgb8unorm';
gpuTextureFormats[PIXELFORMAT_ETC2_RGBA] = 'etc2-rgba8unorm';
gpuTextureFormats[PIXELFORMAT_PVRTC_2BPP_RGB_1] = '';
gpuTextureFormats[PIXELFORMAT_PVRTC_2BPP_RGBA_1] = '';
gpuTextureFormats[PIXELFORMAT_PVRTC_4BPP_RGB_1] = '';
gpuTextureFormats[PIXELFORMAT_PVRTC_4BPP_RGBA_1] = '';
gpuTextureFormats[PIXELFORMAT_ASTC_4x4] = 'astc-4x4-unorm';
gpuTextureFormats[PIXELFORMAT_ATC_RGB] = '';
gpuTextureFormats[PIXELFORMAT_ATC_RGBA] = '';
gpuTextureFormats[PIXELFORMAT_BGRA8] = 'bgra8unorm';

// map of ADDRESS_*** to GPUAddressMode
const gpuAddressModes = [];
gpuAddressModes[ADDRESS_REPEAT] = 'repeat';
gpuAddressModes[ADDRESS_CLAMP_TO_EDGE] = 'clamp-to-edge';
gpuAddressModes[ADDRESS_MIRRORED_REPEAT] = 'mirror-repeat';

// map of FILTER_*** to GPUFilterMode for level and mip sampling
const gpuFilterModes = [];
gpuFilterModes[FILTER_NEAREST] = { level: 'nearest', mip: 'nearest' };
gpuFilterModes[FILTER_LINEAR] = { level: 'linear', mip: 'nearest' };
gpuFilterModes[FILTER_NEAREST_MIPMAP_NEAREST] = { level: 'nearest', mip: 'nearest' };
gpuFilterModes[FILTER_NEAREST_MIPMAP_LINEAR] = { level: 'nearest', mip: 'linear' };
gpuFilterModes[FILTER_LINEAR_MIPMAP_NEAREST] = { level: 'linear', mip: 'nearest' };
gpuFilterModes[FILTER_LINEAR_MIPMAP_LINEAR] = { level: 'linear', mip: 'linear' };

/**
 * A WebGPU implementation of the Texture.
 *
 * @ignore
 */
class WebgpuTexture {
    /**
     * @type {GPUTexture}
     * @private
     */
    gpuTexture;

    /**
     * @type {GPUTextureView}
     * @private
     */
    view;

    /**
     * An array of samplers, addressed by SAMPLETYPE_*** constant, allowing texture to be sampled
     * using different samplers. Most textures are sampled as interpolated floats, but some can
     * additionally be sampled using non-interpolated floats (raw data) or compare sampling
     * (shadow maps).
     *
     * @type {GPUSampler[]}
     * @private
     */
    samplers = [];

    /**
     * @type {GPUTextureDescriptor}
     * @private
     */
    descr;

    /**
     * @type {GPUTextureFormat}
     * @private
     */
    format;

    constructor(texture) {
        /** @type {import('../texture.js').Texture} */
        this.texture = texture;

        this.format = gpuTextureFormats[texture.format];
        Debug.assert(this.format !== '', `WebGPU does not support texture format ${texture.format} for texture ${texture.name}`, texture);

        this.create(texture.device);
    }

    create(device) {

        const texture = this.texture;
        const wgpu = device.wgpu;
        const mipLevelCount = texture.requiredMipLevels;

        this.descr = {
            size: {
                width: texture.width,
                height: texture.height,
                depthOrArrayLayers: texture.cubemap ? 6 : 1
            },
            format: this.format,
            mipLevelCount: mipLevelCount,
            sampleCount: 1,
            dimension: texture.volume ? '3d' : '2d',

            // TODO: use only required usage flags
            // COPY_SRC - probably only needed on render target textures, to support copyRenderTarget (grab pass needs it)
            // RENDER_ATTACHMENT - needed for mipmap generation
            usage: GPUTextureUsage.TEXTURE_BINDING | GPUTextureUsage.COPY_DST | GPUTextureUsage.RENDER_ATTACHMENT | GPUTextureUsage.COPY_SRC
        };

        WebgpuDebug.validate(device);

        this.gpuTexture = wgpu.createTexture(this.descr);
        DebugHelper.setLabel(this.gpuTexture, `${texture.name}${texture.cubemap ? '[cubemap]' : ''}${texture.volume ? '[3d]' : ''}`);

        WebgpuDebug.end(device, {
            descr: this.descr,
            texture
        });

        // default texture view descriptor
        let viewDescr;

        // some format require custom default texture view
        if (this.texture.format === PIXELFORMAT_DEPTHSTENCIL) {
            // we expose the depth part of the format
            viewDescr = {
                format: 'depth24plus',
                aspect: 'depth-only'
            };
        }

        this.view = this.createView(viewDescr);
    }

    destroy(device) {
    }

    propertyChanged(flag) {
        // samplers need to be recreated
        this.samplers.length = 0;
    }

    /**
     * @param {any} device - The Graphics Device.
     * @returns {any} - Returns the view.
     */
    getView(device) {

        this.uploadImmediate(device, this.texture);

        Debug.assert(this.view);
        return this.view;
    }

    createView(viewDescr) {

        const options = viewDescr ?? {};
        const textureDescr = this.descr;
        const texture = this.texture;

        // '1d', '2d', '2d-array', 'cube', 'cube-array', '3d'
        const defaultViewDimension = () => {
            if (texture.cubemap) return 'cube';
            if (texture.volume) return '3d';
            return '2d';
        };

        /** @type {GPUTextureViewDescriptor} */
        const descr = {
            format: options.format ?? textureDescr.format,
            dimension: options.dimension ?? defaultViewDimension(),
            aspect: options.aspect ?? 'all',
            baseMipLevel: options.baseMipLevel ?? 0,
            mipLevelCount: options.mipLevelCount ?? textureDescr.mipLevelCount,
            baseArrayLayer: options.baseArrayLayer ?? 0,
            arrayLayerCount: options.arrayLayerCount ?? textureDescr.depthOrArrayLayers
        };

        const view = this.gpuTexture.createView(descr);
        DebugHelper.setLabel(view, `${viewDescr ? `CustomView${JSON.stringify(viewDescr)}` : 'DefaultView'}:${this.texture.name}`);

        return view;
    }

    // TODO: share a global map of samplers. Possibly even use shared samplers for bind group,
    // or maybe even have some attached in view bind group and use globally

    /**
     * @param {any} device - The Graphics Device.
     * @param {number} [sampleType] - A sample type for the sampler, SAMPLETYPE_*** constant. If not
     * specified, the sampler type is based on the texture format / texture sampling type.
     * @returns {any} - Returns the sampler.
     */
    getSampler(device, sampleType) {
        let sampler = this.samplers[sampleType];
        if (!sampler) {

            const texture = this.texture;
            let label;

            /** @type GPUSamplerDescriptor */
            const descr = {
                addressModeU: gpuAddressModes[texture.addressU],
                addressModeV: gpuAddressModes[texture.addressV],
                addressModeW: gpuAddressModes[texture.addressW],
                maxAnisotropy: math.clamp(Math.round(texture._anisotropy), 1, device.maxTextureAnisotropy)
            };

            // default for compare sampling of texture
            if (!sampleType && texture.compareOnRead) {
                sampleType = SAMPLETYPE_DEPTH;
            }

            if (sampleType === SAMPLETYPE_DEPTH) {

                // depth compare sampling
                descr.compare = 'less';
                descr.magFilter = 'linear';
                descr.minFilter = 'linear';
                label = 'Compare';

            } else if (sampleType === SAMPLETYPE_UNFILTERABLE_FLOAT) {

                // webgpu cannot currently filter float / half float textures
                descr.magFilter = 'nearest';
                descr.minFilter = 'nearest';
                descr.mipmapFilter = 'nearest';
                label = 'Unfilterable';

            } else {

                // TODO: this is temporary and needs to be made generic
                if (this.texture.format === PIXELFORMAT_RGBA32F ||
                    this.texture.format === PIXELFORMAT_DEPTHSTENCIL ||
                    this.texture.format === PIXELFORMAT_RGBA16F) {
                    descr.magFilter = 'nearest';
                    descr.minFilter = 'nearest';
                    descr.mipmapFilter = 'nearest';
                    label = 'Nearest';
                } else {
                    descr.magFilter = gpuFilterModes[texture.magFilter].level;
                    descr.minFilter = gpuFilterModes[texture.minFilter].level;
                    descr.mipmapFilter = gpuFilterModes[texture.minFilter].mip;
                    Debug.call(() => {
                        label = `Texture:${texture.magFilter}-${texture.minFilter}-${descr.mipmapFilter}`;
                    });
                }
            }

            sampler = device.wgpu.createSampler(descr);
            DebugHelper.setLabel(sampler, label);
            this.samplers[sampleType] = sampler;
        }

        return sampler;
    }

    loseContext() {
    }

    /**
     * @param {import('./webgpu-graphics-device.js').WebgpuGraphicsDevice} device - The graphics
     * device.
     * @param {import('../texture.js').Texture} texture - The texture.
     */
    uploadImmediate(device, texture) {

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
        if (texture._levels) {

            // upload texture data if any
            let anyUploads = false;
            const requiredMipLevels = texture.requiredMipLevels;
            for (let mipLevel = 0; mipLevel < requiredMipLevels; mipLevel++) {

                const mipObject = texture._levels[mipLevel];
                if (mipObject) {

                    if (texture.cubemap) {

                        for (let face = 0; face < 6; face++) {

                            const faceSource = mipObject[face];
                            if (faceSource) {
                                if (this.isExternalImage(faceSource)) {

                                    this.uploadExternalImage(device, faceSource, mipLevel, face);
                                    anyUploads = true;

                                } else if (ArrayBuffer.isView(faceSource)) { // typed array

                                    this.uploadTypedArrayData(device, faceSource, mipLevel, face);
                                    anyUploads = true;

                                } else {

                                    Debug.error('Unsupported texture source data for cubemap face', faceSource);
                                }
                            }
                        }

                    } else if (texture._volume) {

                        Debug.warn('Volume texture data upload is not supported yet', this.texture);

                    } else { // 2d texture

                        if (this.isExternalImage(mipObject)) {

                            this.uploadExternalImage(device, mipObject, mipLevel, 0);
                            anyUploads = true;

                        } else if (ArrayBuffer.isView(mipObject)) { // typed array

                            this.uploadTypedArrayData(device, mipObject, mipLevel, 0);
                            anyUploads = true;

                        } else {

                            Debug.error('Unsupported texture source data', mipObject);
                        }
                    }
                }
            }

            if (anyUploads && texture.mipmaps) {
                device.mipmapRenderer.generate(this);
            }
        }
    }

    // image types supported by copyExternalImageToTexture
    isExternalImage(image) {
        return (image instanceof ImageBitmap) ||
            (image instanceof HTMLVideoElement) ||
            (image instanceof HTMLCanvasElement) ||
            (image instanceof OffscreenCanvas);
    }

    uploadExternalImage(device, image, mipLevel, face) {

        Debug.assert(mipLevel < this.descr.mipLevelCount, `Accessing mip level ${mipLevel} of texture with ${this.descr.mipLevelCount} mip levels`, this);

        const src = {
            source: image,
            origin: [0, 0],
            flipY: false
        };

        const dst = {
            texture: this.gpuTexture,
            mipLevel: mipLevel,
            origin: [0, 0, face],
            aspect: 'all'  // can be: "all", "stencil-only", "depth-only"
        };

        const copySize = {
            width: this.descr.size.width,
            height: this.descr.size.height,
            depthOrArrayLayers: 1   // single layer
        };

        // submit existing scheduled commands to the queue before copying to preserve the order
        device.submit();

        Debug.trace(TRACEID_RENDER_QUEUE, `IMAGE-TO-TEX: mip:${mipLevel} face:${face} ${this.texture.name}`);
        device.wgpu.queue.copyExternalImageToTexture(src, dst, copySize);
    }

    uploadTypedArrayData(device, data, mipLevel, face) {

        const texture = this.texture;
        const wgpu = device.wgpu;

        /** @type {GPUImageCopyTexture} */
        const dest = {
            texture: this.gpuTexture,
            origin: [0, 0, face],
            mipLevel: mipLevel
        };

        // texture dimensions at the specified mip level
        const width = TextureUtils.calcLevelDimension(texture.width, mipLevel);
        const height = TextureUtils.calcLevelDimension(texture.height, mipLevel);

        // data sizes
        const byteSize = TextureUtils.calcLevelGpuSize(width, height, 1, texture.format);
        Debug.assert(byteSize === data.byteLength,
                     `Error uploading data to texture, the data byte size of ${data.byteLength} does not match required ${byteSize}`, texture);

        // this does not handle compressed formats
        const formatInfo = pixelFormatInfo.get(texture.format);
        Debug.assert(formatInfo);

        const pixelSize = formatInfo.size ?? 0;
        Debug.assert(pixelSize, `WebGPU does not yet support texture format ${formatInfo.name} for texture ${texture.name}`, texture);
        const bytesPerRow = pixelSize * width;

        /** @type {GPUImageDataLayout} */
        const dataLayout = {
            offset: 0,
            bytesPerRow: bytesPerRow,
            rowsPerImage: height
        };

        const size = {
            width: width,
            height: height,
            depthOrArrayLayers: 1
        };

        // submit existing scheduled commands to the queue before copying to preserve the order
        device.submit();

        Debug.trace(TRACEID_RENDER_QUEUE, `WRITE-TEX: mip:${mipLevel} face:${face} ${this.texture.name}`);
        wgpu.queue.writeTexture(dest, data, dataLayout, size);
    }
}

export { WebgpuTexture };
