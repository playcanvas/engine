import { TRACEID_RENDER_QUEUE } from '../../../core/constants.js';
import { Debug, DebugHelper } from '../../../core/debug.js';
import { math } from '../../../core/math/math.js';
import {
    pixelFormatInfo, isCompressedPixelFormat, getPixelFormatArrayType,
    ADDRESS_REPEAT, ADDRESS_CLAMP_TO_EDGE, ADDRESS_MIRRORED_REPEAT,
    PIXELFORMAT_RGBA16F, PIXELFORMAT_RGBA32F, PIXELFORMAT_DEPTHSTENCIL,
    SAMPLETYPE_UNFILTERABLE_FLOAT, SAMPLETYPE_DEPTH,
    FILTER_NEAREST, FILTER_LINEAR, FILTER_NEAREST_MIPMAP_NEAREST, FILTER_NEAREST_MIPMAP_LINEAR,
    FILTER_LINEAR_MIPMAP_NEAREST, FILTER_LINEAR_MIPMAP_LINEAR, isIntegerPixelFormat, SAMPLETYPE_INT, SAMPLETYPE_UINT,
    BUFFERUSAGE_READ,
    BUFFERUSAGE_COPY_DST
} from '../constants.js';
import { TextureUtils } from '../texture-utils.js';
import { WebgpuDebug } from './webgpu-debug.js';
import { gpuTextureFormats } from './constants.js';

/**
 * @import { Texture } from '../texture.js'
 * @import { TextureView } from '../texture-view.js'
 * @import { WebgpuGraphicsDevice } from './webgpu-graphics-device.js'
 */

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

const dummyUse = (thingOne) => {
    // so lint thinks we're doing something with thingOne
};

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
    desc;

    /**
     * @type {GPUTextureFormat}
     * @private
     */
    format;

    /**
     * A cache of texture views keyed by TextureView.key, used for storage texture bindings.
     *
     * @type {Map<number, GPUTextureView>}
     * @private
     */
    viewCache = new Map();

    constructor(texture) {
        /** @type {Texture} */
        this.texture = texture;

        this.format = gpuTextureFormats[texture.format];
        Debug.assert(this.format !== '', `WebGPU does not support texture format ${texture.format} [${pixelFormatInfo.get(texture.format)?.name}] for texture ${texture.name}`, texture);

        this.create(texture.device);
    }

    create(device) {

        const texture = this.texture;
        const wgpu = device.wgpu;
        const numLevels = texture.numLevels;

        Debug.assert(texture.width > 0 && texture.height > 0, `Invalid texture dimensions ${texture.width}x${texture.height} for texture ${texture.name}`, texture);

        this.desc = {
            size: {
                width: texture.width,
                height: texture.height,
                depthOrArrayLayers: texture.cubemap ? 6 : (texture.array ? texture.arrayLength : 1)
            },
            format: this.format,
            mipLevelCount: numLevels,
            sampleCount: 1,
            dimension: texture.volume ? '3d' : '2d',

            // TODO: use only required usage flags
            // COPY_SRC - probably only needed on render target textures, to support copyRenderTarget (grab pass needs it)
            // RENDER_ATTACHMENT - needed for mipmap generation
            usage: GPUTextureUsage.TEXTURE_BINDING | GPUTextureUsage.COPY_DST | GPUTextureUsage.COPY_SRC |
                (isCompressedPixelFormat(texture.format) ? 0 : GPUTextureUsage.RENDER_ATTACHMENT) |
                (texture.storage ? GPUTextureUsage.STORAGE_BINDING : 0)
        };

        WebgpuDebug.validate(device);

        this.gpuTexture = wgpu.createTexture(this.desc);
        DebugHelper.setLabel(this.gpuTexture, `${texture.name}${texture.cubemap ? '[cubemap]' : ''}${texture.volume ? '[3d]' : ''}`);

        WebgpuDebug.end(device, 'Texture creation', {
            desc: this.desc,
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

        // Clear any cached views since the GPU texture was recreated
        this.viewCache.clear();
    }

    destroy(device) {
        this.gpuTexture?.destroy();
        this.gpuTexture = null;
        this.view = null;
        this.viewCache.clear();
        this.samplers.length = 0;
    }

    propertyChanged(flag) {
        // samplers need to be recreated
        this.samplers.length = 0;
    }

    /**
     * Returns a texture view. If a TextureView is provided, returns a cached view for those
     * specific parameters (creating it if needed). Otherwise returns the default view.
     *
     * @param {WebgpuGraphicsDevice} device - The graphics device.
     * @param {TextureView} [textureView] - Optional TextureView specifying view parameters.
     * @returns {GPUTextureView} - Returns the view.
     * @private
     */
    getView(device, textureView) {

        this.uploadImmediate(device, this.texture);

        if (textureView) {
            // Check cache for this view configuration
            let view = this.viewCache.get(textureView.key);
            if (!view) {
                // Create and cache the view
                view = this.createView({
                    baseMipLevel: textureView.baseMipLevel,
                    mipLevelCount: textureView.mipLevelCount,
                    baseArrayLayer: textureView.baseArrayLayer,
                    arrayLayerCount: textureView.arrayLayerCount
                });
                this.viewCache.set(textureView.key, view);
            }
            return view;
        }

        Debug.assert(this.view);
        return this.view;
    }

    createView(viewDescr) {

        const options = viewDescr ?? {};
        const textureDescr = this.desc;
        const texture = this.texture;

        // '1d', '2d', '2d-array', 'cube', 'cube-array', '3d'
        const defaultViewDimension = () => {
            if (texture.cubemap) return 'cube';
            if (texture.volume) return '3d';
            if (texture.array) return '2d-array';
            return '2d';
        };

        /** @type {GPUTextureViewDescriptor} */
        const desc = {
            format: options.format ?? textureDescr.format,
            dimension: options.dimension ?? defaultViewDimension(),
            aspect: options.aspect ?? 'all',
            baseMipLevel: options.baseMipLevel ?? 0,
            mipLevelCount: options.mipLevelCount ?? textureDescr.mipLevelCount,
            baseArrayLayer: options.baseArrayLayer ?? 0,
            arrayLayerCount: options.arrayLayerCount ?? textureDescr.depthOrArrayLayers
        };

        const view = this.gpuTexture.createView(desc);
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
            const desc = {
                addressModeU: gpuAddressModes[texture.addressU],
                addressModeV: gpuAddressModes[texture.addressV],
                addressModeW: gpuAddressModes[texture.addressW]
            };

            // default for compare sampling of texture
            if (!sampleType && texture.compareOnRead) {
                sampleType = SAMPLETYPE_DEPTH;
            }

            if (sampleType === SAMPLETYPE_DEPTH || sampleType === SAMPLETYPE_INT || sampleType === SAMPLETYPE_UINT) {

                // depth compare sampling
                desc.compare = 'less';
                desc.magFilter = 'linear';
                desc.minFilter = 'linear';
                label = 'Compare';

            } else if (sampleType === SAMPLETYPE_UNFILTERABLE_FLOAT) {

                desc.magFilter = 'nearest';
                desc.minFilter = 'nearest';
                desc.mipmapFilter = 'nearest';
                label = 'Unfilterable';

            } else {

                // if the device cannot filter float textures, force nearest filtering
                const forceNearest = !device.textureFloatFilterable && (texture.format === PIXELFORMAT_RGBA32F || texture.format === PIXELFORMAT_RGBA16F);

                if (forceNearest || this.texture.format === PIXELFORMAT_DEPTHSTENCIL || isIntegerPixelFormat(this.texture.format)) {
                    desc.magFilter = 'nearest';
                    desc.minFilter = 'nearest';
                    desc.mipmapFilter = 'nearest';
                    label = 'Nearest';
                } else {
                    desc.magFilter = gpuFilterModes[texture.magFilter].level;
                    desc.minFilter = gpuFilterModes[texture.minFilter].level;
                    desc.mipmapFilter = gpuFilterModes[texture.minFilter].mip;
                    Debug.call(() => {
                        label = `Texture:${texture.magFilter}-${texture.minFilter}-${desc.mipmapFilter}`;
                    });
                }
            }

            // ensure anisotropic filtering is only set when filtering is correctly
            // set up
            const allLinear = (desc.minFilter === 'linear' &&
                               desc.magFilter === 'linear' &&
                               desc.mipmapFilter === 'linear');
            desc.maxAnisotropy = allLinear ?
                math.clamp(Math.round(texture._anisotropy), 1, device.maxTextureAnisotropy) :
                1;

            sampler = device.wgpu.createSampler(desc);
            DebugHelper.setLabel(sampler, label);
            this.samplers[sampleType] = sampler;
        }

        return sampler;
    }

    loseContext() {
    }

    /**
     * @param {WebgpuGraphicsDevice} device - The graphics device.
     * @param {Texture} texture - The texture.
     */
    uploadImmediate(device, texture) {

        if (texture._needsUpload || texture._needsMipmapsUpload) {
            this.uploadData(device);

            texture._needsUpload = false;
            texture._needsMipmapsUpload = false;
        }
    }

    /**
     * @param {WebgpuGraphicsDevice} device - The graphics
     * device.
     */
    uploadData(device) {

        const texture = this.texture;

        // If texture dimensions have changed, recreate the GPU texture (for example loading external texture
        // with different dimensions)
        if (this.desc && (this.desc.size.width !== texture.width || this.desc.size.height !== texture.height)) {
            Debug.warnOnce(`Texture '${texture.name}' is being recreated due to dimension change from ${this.desc.size.width}x${this.desc.size.height} to ${texture.width}x${texture.height}. Consider creating the texture with correct dimensions to avoid recreation.`);

            this.gpuTexture.destroy();
            this.create(device);

            // Notify bind groups that this texture has changed and needs rebinding
            texture.renderVersionDirty = device.renderVersion;
        }

        if (texture._levels) {

            // upload texture data if any
            let anyUploads = false;
            let anyLevelMissing = false;
            const requiredMipLevels = texture.numLevels;
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
                            } else {
                                anyLevelMissing = true;
                            }
                        }

                    } else if (texture._volume) {

                        Debug.warn('Volume texture data upload is not supported yet', this.texture);

                    } else if (texture.array) { // texture array

                        if (texture.arrayLength === mipObject.length) {

                            for (let index = 0; index < texture._arrayLength; index++) {
                                const arraySource = mipObject[index];

                                if (this.isExternalImage(arraySource)) {

                                    this.uploadExternalImage(device, arraySource, mipLevel, index);
                                    anyUploads = true;

                                } else if (ArrayBuffer.isView(arraySource)) { // typed array

                                    this.uploadTypedArrayData(device, arraySource, mipLevel, index);
                                    anyUploads = true;

                                } else {

                                    Debug.error('Unsupported texture source data for texture array entry', arraySource);
                                }
                            }
                        } else {
                            anyLevelMissing = true;
                        }

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
                } else {
                    anyLevelMissing = true;
                }
            }

            if (anyUploads && anyLevelMissing && texture.mipmaps && !isCompressedPixelFormat(texture.format) && !isIntegerPixelFormat(texture.format)) {
                device.mipmapRenderer.generate(this);
            }

            // update vram stats
            if (texture._gpuSize) {
                texture.adjustVramSizeTracking(device._vram, -texture._gpuSize);
            }

            texture._gpuSize = texture.gpuSize;
            texture.adjustVramSizeTracking(device._vram, texture._gpuSize);
        }
    }

    // image types supported by copyExternalImageToTexture
    isExternalImage(image) {
        return (typeof ImageBitmap !== 'undefined' && image instanceof ImageBitmap) ||
            (typeof HTMLVideoElement !== 'undefined' && image instanceof HTMLVideoElement) ||
            (typeof HTMLCanvasElement !== 'undefined' && image instanceof HTMLCanvasElement) ||
            (typeof OffscreenCanvas !== 'undefined' && image instanceof OffscreenCanvas);
    }

    uploadExternalImage(device, image, mipLevel, index) {

        Debug.assert(mipLevel < this.desc.mipLevelCount, `Accessing mip level ${mipLevel} of texture with ${this.desc.mipLevelCount} mip levels`, this);

        const src = {
            source: image,
            origin: [0, 0],
            flipY: false
        };

        const dst = {
            texture: this.gpuTexture,
            mipLevel: mipLevel,
            origin: [0, 0, index],
            aspect: 'all',  // can be: "all", "stencil-only", "depth-only"
            premultipliedAlpha: this.texture._premultiplyAlpha
        };

        const copySize = {
            width: this.desc.size.width,
            height: this.desc.size.height,
            depthOrArrayLayers: 1   // single layer
        };

        // submit existing scheduled commands to the queue before copying to preserve the order
        device.submit();

        // create 2d context so webgpu can upload the texture
        dummyUse(image instanceof HTMLCanvasElement && image.getContext('2d'));

        Debug.trace(TRACEID_RENDER_QUEUE, `IMAGE-TO-TEX: mip:${mipLevel} index:${index} ${this.texture.name}`);
        device.wgpu.queue.copyExternalImageToTexture(src, dst, copySize);
    }

    uploadTypedArrayData(device, data, mipLevel, index) {

        const texture = this.texture;
        const wgpu = device.wgpu;

        /** @type {GPUImageCopyTexture} */
        const dest = {
            texture: this.gpuTexture,
            origin: [0, 0, index],
            mipLevel: mipLevel
        };

        // texture dimensions at the specified mip level
        const width = TextureUtils.calcLevelDimension(texture.width, mipLevel);
        const height = TextureUtils.calcLevelDimension(texture.height, mipLevel);

        // data sizes
        const byteSize = TextureUtils.calcLevelGpuSize(width, height, 1, texture.format);
        Debug.assert(byteSize === data.byteLength,
            `Error uploading data to texture, the data byte size of ${data.byteLength} does not match required ${byteSize}`, texture);

        const formatInfo = pixelFormatInfo.get(texture.format);
        Debug.assert(formatInfo);

        /** @type {GPUImageDataLayout} */
        let dataLayout;
        let size;

        if (formatInfo.size) {
            // uncompressed format
            dataLayout = {
                offset: 0,
                bytesPerRow: formatInfo.size * width,
                rowsPerImage: height
            };
            size = {
                width: width,
                height: height
            };
        } else if (formatInfo.blockSize) {
            // compressed format
            const blockDim = (size) => {
                return Math.floor((size + 3) / 4);
            };
            dataLayout = {
                offset: 0,
                bytesPerRow: formatInfo.blockSize * blockDim(width),
                rowsPerImage: blockDim(height)
            };
            size = {
                width: Math.max(4, width),
                height: Math.max(4, height)
            };
        } else {
            Debug.assert(false, `WebGPU does not yet support texture format ${formatInfo.name} for texture ${texture.name}`, texture);
        }

        // submit existing scheduled commands to the queue before copying to preserve the order
        device.submit();

        Debug.trace(TRACEID_RENDER_QUEUE, `WRITE-TEX: mip:${mipLevel} index:${index} ${this.texture.name}`);
        wgpu.queue.writeTexture(dest, data, dataLayout, size);
    }

    read(x, y, width, height, options) {

        const mipLevel = options.mipLevel ?? 0;
        const face = options.face ?? 0;
        const data = options.data ?? null;
        const immediate = options.immediate ?? false;

        const texture = this.texture;
        const formatInfo = pixelFormatInfo.get(texture.format);
        Debug.assert(formatInfo);
        Debug.assert(formatInfo.size);

        const bytesPerRow = width * formatInfo.size;

        // bytesPerRow must be a multiple of 256
        const paddedBytesPerRow = math.roundUp(bytesPerRow, 256);
        const size = paddedBytesPerRow * height;

        // create a temporary staging buffer
        /** @type {WebgpuGraphicsDevice} */
        const device = texture.device;
        const stagingBuffer = device.createBufferImpl(BUFFERUSAGE_READ | BUFFERUSAGE_COPY_DST);
        stagingBuffer.allocate(device, size);

        const src = {
            texture: this.gpuTexture,
            mipLevel: mipLevel,
            origin: [x, y, face]
        };

        const dst = {
            buffer: stagingBuffer.buffer,
            offset: 0,
            bytesPerRow: paddedBytesPerRow
        };

        const copySize = {
            width,
            height,
            depthOrArrayLayers: 1   // single layer
        };

        // copy the GPU texture to the staging buffer
        const commandEncoder = device.getCommandEncoder();
        commandEncoder.copyTextureToBuffer(src, dst, copySize);

        // async read data from the staging buffer to a temporary array
        return device.readBuffer(stagingBuffer, size, null, immediate).then((temp) => {

            // determine target buffer - use user's data buffer or allocate new
            const ArrayType = getPixelFormatArrayType(texture.format);
            const targetBuffer = data?.buffer ?? new ArrayBuffer(height * bytesPerRow);
            const target = new Uint8Array(targetBuffer, data?.byteOffset ?? 0, height * bytesPerRow);

            // remove the 256 alignment padding from the end of each row
            for (let i = 0; i < height; i++) {
                const srcOffset = i * paddedBytesPerRow;
                const dstOffset = i * bytesPerRow;
                target.set(temp.subarray(srcOffset, srcOffset + bytesPerRow), dstOffset);
            }

            // return user's data or create correctly-typed array view
            return data ?? new ArrayType(targetBuffer);
        });
    }
}

export { WebgpuTexture };
