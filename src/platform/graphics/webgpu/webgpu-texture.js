import { TRACEID_RENDER_QUEUE } from '../../../core/constants.js';
import { Debug, DebugHelper } from '../../../core/debug.js';
import { math } from '../../../core/math/math.js';

import {
    pixelFormatInfo, isCompressedPixelFormat,
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
        Debug.assert(this.format !== '', `WebGPU does not support texture format ${texture.format} [${pixelFormatInfo.get(texture.format)?.name}] for texture ${texture.name}`, texture);

        this.create(texture.device);
    }

    create(device) {

        const texture = this.texture;
        const wgpu = device.wgpu;
        const mipLevelCount = texture.requiredMipLevels;

        Debug.assert(texture.width > 0 && texture.height > 0, `Invalid texture dimensions ${texture.width}x${texture.height} for texture ${texture.name}`, texture);

        this.descr = {
            size: {
                width: texture.width,
                height: texture.height,
                depthOrArrayLayers: texture.cubemap ? 6 : (texture.array ? texture.arrayLength : 1)
            },
            format: this.format,
            mipLevelCount: mipLevelCount,
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
            if (texture.array) return '2d-array';
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
                addressModeW: gpuAddressModes[texture.addressW]
            };

            // default for compare sampling of texture
            if (!sampleType && texture.compareOnRead) {
                sampleType = SAMPLETYPE_DEPTH;
            }

            if (sampleType === SAMPLETYPE_DEPTH || sampleType === SAMPLETYPE_INT || sampleType === SAMPLETYPE_UINT) {

                // depth compare sampling
                descr.compare = 'less';
                descr.magFilter = 'linear';
                descr.minFilter = 'linear';
                label = 'Compare';

            } else if (sampleType === SAMPLETYPE_UNFILTERABLE_FLOAT) {

                descr.magFilter = 'nearest';
                descr.minFilter = 'nearest';
                descr.mipmapFilter = 'nearest';
                label = 'Unfilterable';

            } else {

                // if the device cannot filter float textures, force nearest filtering
                const forceNearest = !device.textureFloatFilterable && (texture.format === PIXELFORMAT_RGBA32F || texture.format === PIXELFORMAT_RGBA16F);

                if (forceNearest || this.texture.format === PIXELFORMAT_DEPTHSTENCIL || isIntegerPixelFormat(this.texture.format)) {
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

            // ensure anisotropic filtering is only set when filtering is correctly
            // set up
            const allLinear = (descr.minFilter === 'linear' &&
                               descr.magFilter === 'linear' &&
                               descr.mipmapFilter === 'linear');
            descr.maxAnisotropy = allLinear ?
                math.clamp(Math.round(texture._anisotropy), 1, device.maxTextureAnisotropy) :
                1;

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
            let anyLevelMissing = false;
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

            if (anyUploads && anyLevelMissing && texture.mipmaps && !isCompressedPixelFormat(texture.format)) {
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
        return (image instanceof ImageBitmap) ||
            (image instanceof HTMLVideoElement) ||
            (image instanceof HTMLCanvasElement) ||
            (image instanceof OffscreenCanvas);
    }

    uploadExternalImage(device, image, mipLevel, index) {

        Debug.assert(mipLevel < this.descr.mipLevelCount, `Accessing mip level ${mipLevel} of texture with ${this.descr.mipLevelCount} mip levels`, this);

        const src = {
            source: image,
            origin: [0, 0],
            flipY: false
        };

        const dst = {
            texture: this.gpuTexture,
            mipLevel: mipLevel,
            origin: [0, 0, index],
            aspect: 'all'  // can be: "all", "stencil-only", "depth-only"
        };

        const copySize = {
            width: this.descr.size.width,
            height: this.descr.size.height,
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
        let data = options.data ?? null;
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
        /** @type {import('./webgpu-graphics-device.js').WebgpuGraphicsDevice} */
        const device = texture.device;
        const stagingBuffer = device.createBufferImpl(BUFFERUSAGE_READ | BUFFERUSAGE_COPY_DST);
        stagingBuffer.allocate(device, size);

        // use existing or create new encoder
        const commandEncoder = device.commandEncoder ?? device.wgpu.createCommandEncoder();

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
        commandEncoder.copyTextureToBuffer(src, dst, copySize);

        // if we created new encoder
        if (!device.commandEncoder) {
            DebugHelper.setLabel(commandEncoder, 'copyTextureToBuffer-Encoder');
            const cb = commandEncoder.finish();
            DebugHelper.setLabel(cb, 'copyTextureToBuffer-CommandBuffer');
            device.addCommandBuffer(cb);
        }

        // async read data from the staging buffer to a temporary array
        return device.readBuffer(stagingBuffer, size, null, immediate).then((temp) => {

            // remove the 256 alignment padding from the end of each row
            data ??= new Uint8Array(height * bytesPerRow);
            for (let i = 0; i < height; i++) {
                const srcOffset = i * paddedBytesPerRow;
                const dstOffset = i * bytesPerRow;
                const sub = temp.subarray(srcOffset, srcOffset + bytesPerRow);
                data.set(sub, dstOffset);
            }

            return data;
        });
    }
}

export { WebgpuTexture };
