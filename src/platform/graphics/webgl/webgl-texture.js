import { Debug } from '../../../core/debug.js';
import {
    PIXELFORMAT_A8, PIXELFORMAT_L8, PIXELFORMAT_LA8, PIXELFORMAT_RGB565, PIXELFORMAT_RGBA5551, PIXELFORMAT_RGBA4,
    PIXELFORMAT_RGB8, PIXELFORMAT_RGBA8, PIXELFORMAT_DXT1, PIXELFORMAT_DXT3, PIXELFORMAT_DXT5,
    PIXELFORMAT_RGB16F, PIXELFORMAT_RGBA16F, PIXELFORMAT_RGB32F, PIXELFORMAT_RGBA32F, PIXELFORMAT_R32F, PIXELFORMAT_DEPTH,
    PIXELFORMAT_DEPTHSTENCIL, PIXELFORMAT_111110F, PIXELFORMAT_SRGB8, PIXELFORMAT_SRGBA8, PIXELFORMAT_ETC1,
    PIXELFORMAT_ETC2_RGB, PIXELFORMAT_ETC2_RGBA, PIXELFORMAT_PVRTC_2BPP_RGB_1, PIXELFORMAT_PVRTC_2BPP_RGBA_1,
    PIXELFORMAT_PVRTC_4BPP_RGB_1, PIXELFORMAT_PVRTC_4BPP_RGBA_1, PIXELFORMAT_ASTC_4x4, PIXELFORMAT_ATC_RGB,
    PIXELFORMAT_ATC_RGBA, PIXELFORMAT_BGRA8, PIXELFORMAT_R8I, PIXELFORMAT_R8U, PIXELFORMAT_R16I, PIXELFORMAT_R16U,
    PIXELFORMAT_R32I, PIXELFORMAT_R32U, PIXELFORMAT_RG16I, PIXELFORMAT_RG16U, PIXELFORMAT_RG32I, PIXELFORMAT_RG32U,
    PIXELFORMAT_RG8I, PIXELFORMAT_RG8U, PIXELFORMAT_RGBA16I, PIXELFORMAT_RGBA16U, PIXELFORMAT_RGBA32I, PIXELFORMAT_RGBA32U,
    PIXELFORMAT_RGBA8I, PIXELFORMAT_RGBA8U, PIXELFORMAT_R16F, PIXELFORMAT_RG16F, PIXELFORMAT_R8, PIXELFORMAT_RG8,
    PIXELFORMAT_DXT1_SRGB, PIXELFORMAT_DXT3_SRGBA, PIXELFORMAT_DXT5_SRGBA,
    PIXELFORMAT_ETC2_SRGB, PIXELFORMAT_ETC2_SRGBA, PIXELFORMAT_ASTC_4x4_SRGB, PIXELFORMAT_SBGRA8,
    PIXELFORMAT_BC6F, PIXELFORMAT_BC6UF, PIXELFORMAT_BC7, PIXELFORMAT_BC7_SRGBA,
    PIXELFORMAT_DEPTH16, PIXELFORMAT_RG32F,
    PIXELFORMAT_RGB9E5, PIXELFORMAT_RG8S, PIXELFORMAT_RGBA8S, PIXELFORMAT_RGB10A2, PIXELFORMAT_RGB10A2U
} from '../constants.js';

/**
 * @import { Texture } from '../texture.js'
 * @import { WebglGraphicsDevice } from './webgl-graphics-device.js'
 */

/**
 * Checks that an image's width and height do not exceed the max texture size. If they do, it will
 * be scaled down to that maximum size and returned as a canvas element.
 *
 * @param {HTMLImageElement} image - The image to downsample.
 * @param {number} size - The maximum allowed size of the image.
 * @returns {HTMLImageElement|HTMLCanvasElement} The downsampled image.
 */
function downsampleImage(image, size) {
    const srcW = image.width;
    const srcH = image.height;

    if ((srcW > size) || (srcH > size)) {
        const scale = size / Math.max(srcW, srcH);
        const dstW = Math.floor(srcW * scale);
        const dstH = Math.floor(srcH * scale);

        Debug.warn(`Image dimensions larger than max supported texture size of ${size}. Resizing from ${srcW}, ${srcH} to ${dstW}, ${dstH}.`);

        const canvas = document.createElement('canvas');
        canvas.width = dstW;
        canvas.height = dstH;

        const context = canvas.getContext('2d');
        context.drawImage(image, 0, 0, srcW, srcH, 0, 0, dstW, dstH);

        return canvas;
    }

    return image;
}

/**
 * A WebGL implementation of the Texture.
 *
 * @ignore
 */
class WebglTexture {
    _glTexture = null;

    _glTarget;

    _glFormat;

    _glInternalFormat;

    _glPixelType;

    _glCreated;

    dirtyParameterFlags = 0;

    constructor(texture) {
        /** @type {Texture} */
        this.texture = texture;
    }

    destroy(device) {
        if (this._glTexture) {

            // Update shadowed texture unit state to remove texture from any units
            for (let i = 0; i < device.textureUnits.length; i++) {
                const textureUnit = device.textureUnits[i];
                for (let j = 0; j < textureUnit.length; j++) {
                    if (textureUnit[j] === this._glTexture) {
                        textureUnit[j] = null;
                    }
                }
            }

            // release WebGL texture resource
            device.gl.deleteTexture(this._glTexture);
            this._glTexture = null;
        }
    }

    loseContext() {
        this._glTexture = null;
    }

    propertyChanged(flag) {
        this.dirtyParameterFlags |= flag;
    }

    initialize(device, texture) {

        const gl = device.gl;

        this._glTexture = gl.createTexture();

        this._glTarget = texture._cubemap ? gl.TEXTURE_CUBE_MAP :
            (texture._volume ? gl.TEXTURE_3D :
                (texture.array ? gl.TEXTURE_2D_ARRAY : gl.TEXTURE_2D));

        switch (texture._format) {
            case PIXELFORMAT_A8:
                this._glFormat = gl.ALPHA;
                this._glInternalFormat = gl.ALPHA;
                this._glPixelType = gl.UNSIGNED_BYTE;
                break;
            case PIXELFORMAT_L8:
                this._glFormat = gl.LUMINANCE;
                this._glInternalFormat = gl.LUMINANCE;
                this._glPixelType = gl.UNSIGNED_BYTE;
                break;
            case PIXELFORMAT_LA8:
                this._glFormat = gl.LUMINANCE_ALPHA;
                this._glInternalFormat = gl.LUMINANCE_ALPHA;
                this._glPixelType = gl.UNSIGNED_BYTE;
                break;
            case PIXELFORMAT_R8:
                this._glFormat = gl.RED;
                this._glInternalFormat = gl.R8;
                this._glPixelType = gl.UNSIGNED_BYTE;
                break;

            case PIXELFORMAT_RG8:
                this._glFormat = gl.RG;
                this._glInternalFormat = gl.RG8;
                this._glPixelType = gl.UNSIGNED_BYTE;
                break;
            case PIXELFORMAT_RGB565:
                this._glFormat = gl.RGB;
                this._glInternalFormat = gl.RGB565;
                this._glPixelType = gl.UNSIGNED_SHORT_5_6_5;
                break;
            case PIXELFORMAT_RGBA5551:
                this._glFormat = gl.RGBA;
                this._glInternalFormat = gl.RGB5_A1;
                this._glPixelType = gl.UNSIGNED_SHORT_5_5_5_1;
                break;
            case PIXELFORMAT_RGBA4:
                this._glFormat = gl.RGBA;
                this._glInternalFormat = gl.RGBA4;
                this._glPixelType = gl.UNSIGNED_SHORT_4_4_4_4;
                break;
            case PIXELFORMAT_RGB8:
                this._glFormat = gl.RGB;
                this._glInternalFormat = gl.RGB8;
                this._glPixelType = gl.UNSIGNED_BYTE;
                break;
            case PIXELFORMAT_RGBA8:
                this._glFormat = gl.RGBA;
                this._glInternalFormat = gl.RGBA8;
                this._glPixelType = gl.UNSIGNED_BYTE;
                break;
            case PIXELFORMAT_BGRA8:
            case PIXELFORMAT_SBGRA8:
                Debug.error('BGRA8 and SBGRA8 texture formats are not supported by WebGL.');
                break;
            case PIXELFORMAT_RG32F:
                Debug.error('RG32F texture format is not supported by WebGL.');
                break;
            case PIXELFORMAT_RGB9E5:
                this._glFormat = gl.RGB;
                this._glInternalFormat = gl.RGB9_E5;
                this._glPixelType = gl.UNSIGNED_INT_5_9_9_9_REV;
                break;
            case PIXELFORMAT_RG8S:
                this._glFormat = gl.RG;
                this._glInternalFormat = gl.RG8_SNORM;
                this._glPixelType = gl.BYTE;
                break;
            case PIXELFORMAT_RGBA8S:
                this._glFormat = gl.RGBA;
                this._glInternalFormat = gl.RGBA8_SNORM;
                this._glPixelType = gl.BYTE;
                break;
            case PIXELFORMAT_RGB10A2:
                this._glFormat = gl.RGBA;
                this._glInternalFormat = gl.RGB10_A2;
                this._glPixelType = gl.UNSIGNED_INT_2_10_10_10_REV;
                break;
            case PIXELFORMAT_RGB10A2U:
                this._glFormat = gl.RGBA_INTEGER;
                this._glInternalFormat = gl.RGB10_A2UI;
                this._glPixelType = gl.UNSIGNED_INT_2_10_10_10_REV;
                break;

                // compressed formats ----

            case PIXELFORMAT_DXT1:
                this._glFormat = gl.RGB;
                this._glInternalFormat = device.extCompressedTextureS3TC.COMPRESSED_RGB_S3TC_DXT1_EXT;
                break;
            case PIXELFORMAT_DXT3:
                this._glFormat = gl.RGBA;
                this._glInternalFormat = device.extCompressedTextureS3TC.COMPRESSED_RGBA_S3TC_DXT3_EXT;
                break;
            case PIXELFORMAT_DXT5:
                this._glFormat = gl.RGBA;
                this._glInternalFormat = device.extCompressedTextureS3TC.COMPRESSED_RGBA_S3TC_DXT5_EXT;
                break;
            case PIXELFORMAT_ETC1:
                this._glFormat = gl.RGB;
                this._glInternalFormat = device.extCompressedTextureETC1.COMPRESSED_RGB_ETC1_WEBGL;
                break;
            case PIXELFORMAT_PVRTC_2BPP_RGB_1:
                this._glFormat = gl.RGB;
                this._glInternalFormat = device.extCompressedTexturePVRTC.COMPRESSED_RGB_PVRTC_2BPPV1_IMG;
                break;
            case PIXELFORMAT_PVRTC_2BPP_RGBA_1:
                this._glFormat = gl.RGBA;
                this._glInternalFormat = device.extCompressedTexturePVRTC.COMPRESSED_RGBA_PVRTC_2BPPV1_IMG;
                break;
            case PIXELFORMAT_PVRTC_4BPP_RGB_1:
                this._glFormat = gl.RGB;
                this._glInternalFormat = device.extCompressedTexturePVRTC.COMPRESSED_RGB_PVRTC_4BPPV1_IMG;
                break;
            case PIXELFORMAT_PVRTC_4BPP_RGBA_1:
                this._glFormat = gl.RGBA;
                this._glInternalFormat = device.extCompressedTexturePVRTC.COMPRESSED_RGBA_PVRTC_4BPPV1_IMG;
                break;
            case PIXELFORMAT_ETC2_RGB:
                this._glFormat = gl.RGB;
                this._glInternalFormat = device.extCompressedTextureETC.COMPRESSED_RGB8_ETC2;
                break;
            case PIXELFORMAT_ETC2_RGBA:
                this._glFormat = gl.RGBA;
                this._glInternalFormat = device.extCompressedTextureETC.COMPRESSED_RGBA8_ETC2_EAC;
                break;
            case PIXELFORMAT_ASTC_4x4:
                this._glFormat = gl.RGBA;
                this._glInternalFormat = device.extCompressedTextureASTC.COMPRESSED_RGBA_ASTC_4x4_KHR;
                break;
            case PIXELFORMAT_ATC_RGB:
                this._glFormat = gl.RGB;
                this._glInternalFormat = device.extCompressedTextureATC.COMPRESSED_RGB_ATC_WEBGL;
                break;
            case PIXELFORMAT_ATC_RGBA:
                this._glFormat = gl.RGBA;
                this._glInternalFormat = device.extCompressedTextureATC.COMPRESSED_RGBA_ATC_INTERPOLATED_ALPHA_WEBGL;
                break;
            case PIXELFORMAT_BC6F:
                this._glFormat = gl.RGB;
                this._glInternalFormat = device.extTextureCompressionBPTC.COMPRESSED_RGB_BPTC_SIGNED_FLOAT_EXT;
                break;
            case PIXELFORMAT_BC6UF:
                this._glFormat = gl.RGB;
                this._glInternalFormat = device.extTextureCompressionBPTC.COMPRESSED_RGB_BPTC_UNSIGNED_FLOAT_EXT;
                break;
            case PIXELFORMAT_BC7:
                this._glFormat = gl.RGBA;
                this._glInternalFormat = device.extTextureCompressionBPTC.COMPRESSED_RGBA_BPTC_UNORM_EXT;
                break;

                // compressed sRGB formats ----

            case PIXELFORMAT_DXT1_SRGB:
                this._glFormat = gl.SRGB;
                this._glInternalFormat = device.extCompressedTextureS3TC_SRGB.COMPRESSED_SRGB_S3TC_DXT1_EXT;
                break;
            case PIXELFORMAT_DXT3_SRGBA:
                this._glFormat = gl.SRGB_ALPHA;
                this._glInternalFormat = device.extCompressedTextureS3TC_SRGB.COMPRESSED_SRGB_ALPHA_S3TC_DXT3_EXT;
                break;
            case PIXELFORMAT_DXT5_SRGBA:
                this._glFormat = gl.SRGB_ALPHA;
                this._glInternalFormat = device.extCompressedTextureS3TC_SRGB.COMPRESSED_SRGB_ALPHA_S3TC_DXT5_EXT;
                break;
            case PIXELFORMAT_ETC2_SRGB:
                this._glFormat = gl.SRGB;
                this._glInternalFormat = device.extCompressedTextureETC.COMPRESSED_SRGB8_ETC2;
                break;
            case PIXELFORMAT_ETC2_SRGBA:
                this._glFormat = gl.SRGB_ALPHA;
                this._glInternalFormat = device.extCompressedTextureETC.COMPRESSED_SRGB8_ALPHA8_ETC2_EAC;
                break;
            case PIXELFORMAT_ASTC_4x4_SRGB:
                this._glFormat = gl.SRGB_ALPHA;
                this._glInternalFormat = device.extCompressedTextureASTC.COMPRESSED_SRGB8_ALPHA8_ASTC_4x4_KHR;
                break;
            case PIXELFORMAT_BC7_SRGBA:
                this._glFormat = gl.RGBA;
                this._glInternalFormat = device.extTextureCompressionBPTC.COMPRESSED_SRGB_ALPHA_BPTC_UNORM_EXT;
                break;

                // ------------------

            case PIXELFORMAT_R16F:
                this._glFormat = gl.RED;
                this._glInternalFormat = gl.R16F;
                this._glPixelType = gl.HALF_FLOAT;
                break;
            case PIXELFORMAT_RG16F:
                this._glFormat = gl.RG;
                this._glInternalFormat = gl.RG16F;
                this._glPixelType = gl.HALF_FLOAT;
                break;
            case PIXELFORMAT_RGB16F:
                this._glFormat = gl.RGB;
                this._glInternalFormat = gl.RGB16F;
                this._glPixelType = gl.HALF_FLOAT;
                break;
            case PIXELFORMAT_RGBA16F:
                this._glFormat = gl.RGBA;
                this._glInternalFormat = gl.RGBA16F;
                this._glPixelType = gl.HALF_FLOAT;
                break;
            case PIXELFORMAT_RGB32F:
                this._glFormat = gl.RGB;
                this._glInternalFormat = gl.RGB32F;
                this._glPixelType = gl.FLOAT;
                break;
            case PIXELFORMAT_RGBA32F:
                this._glFormat = gl.RGBA;
                this._glInternalFormat = gl.RGBA32F;
                this._glPixelType = gl.FLOAT;
                break;
            case PIXELFORMAT_R32F:
                this._glFormat = gl.RED;
                this._glInternalFormat = gl.R32F;
                this._glPixelType = gl.FLOAT;
                break;
            case PIXELFORMAT_DEPTH:
                this._glFormat = gl.DEPTH_COMPONENT;
                this._glInternalFormat = gl.DEPTH_COMPONENT32F;
                this._glPixelType = gl.FLOAT;
                break;
            case PIXELFORMAT_DEPTH16:
                this._glFormat = gl.DEPTH_COMPONENT;
                this._glInternalFormat = gl.DEPTH_COMPONENT16;
                this._glPixelType = gl.UNSIGNED_SHORT;
                break;
            case PIXELFORMAT_DEPTHSTENCIL:
                this._glFormat = gl.DEPTH_STENCIL;
                this._glInternalFormat = gl.DEPTH24_STENCIL8;
                this._glPixelType = gl.UNSIGNED_INT_24_8;
                break;
            case PIXELFORMAT_111110F:
                this._glFormat = gl.RGB;
                this._glInternalFormat = gl.R11F_G11F_B10F;
                this._glPixelType = gl.UNSIGNED_INT_10F_11F_11F_REV;
                break;
            case PIXELFORMAT_SRGB8:
                this._glFormat = gl.RGB;
                this._glInternalFormat = gl.SRGB8;
                this._glPixelType = gl.UNSIGNED_BYTE;
                break;
            case PIXELFORMAT_SRGBA8:
                this._glFormat = gl.RGBA;
                this._glInternalFormat = gl.SRGB8_ALPHA8;
                this._glPixelType = gl.UNSIGNED_BYTE;
                break;

            // Integer texture formats (R)
            case PIXELFORMAT_R8I:
                this._glFormat = gl.RED_INTEGER;
                this._glInternalFormat = gl.R8I;
                this._glPixelType = gl.BYTE;
                break;
            case PIXELFORMAT_R8U:
                this._glFormat = gl.RED_INTEGER;
                this._glInternalFormat = gl.R8UI;
                this._glPixelType = gl.UNSIGNED_BYTE;
                break;
            case PIXELFORMAT_R16I:
                this._glFormat = gl.RED_INTEGER;
                this._glInternalFormat = gl.R16I;
                this._glPixelType = gl.SHORT;
                break;
            case PIXELFORMAT_R16U:
                this._glFormat = gl.RED_INTEGER;
                this._glInternalFormat = gl.R16UI;
                this._glPixelType = gl.UNSIGNED_SHORT;
                break;
            case PIXELFORMAT_R32I:
                this._glFormat = gl.RED_INTEGER;
                this._glInternalFormat = gl.R32I;
                this._glPixelType = gl.INT;
                break;
            case PIXELFORMAT_R32U:
                this._glFormat = gl.RED_INTEGER;
                this._glInternalFormat = gl.R32UI;
                this._glPixelType = gl.UNSIGNED_INT;
                break;

            // Integer texture formats (RG)
            case PIXELFORMAT_RG8I:
                this._glFormat = gl.RG_INTEGER;
                this._glInternalFormat = gl.RG8I;
                this._glPixelType = gl.BYTE;
                break;
            case PIXELFORMAT_RG8U:
                this._glFormat = gl.RG_INTEGER;
                this._glInternalFormat = gl.RG8UI;
                this._glPixelType = gl.UNSIGNED_BYTE;
                break;
            case PIXELFORMAT_RG16I:
                this._glFormat = gl.RG_INTEGER;
                this._glInternalFormat = gl.RG16I;
                this._glPixelType = gl.SHORT;
                break;
            case PIXELFORMAT_RG16U:
                this._glFormat = gl.RG_INTEGER;
                this._glInternalFormat = gl.RG16UI;
                this._glPixelType = gl.UNSIGNED_SHORT;
                break;
            case PIXELFORMAT_RG32I:
                this._glFormat = gl.RG_INTEGER;
                this._glInternalFormat = gl.RG32I;
                this._glPixelType = gl.INT;
                break;
            case PIXELFORMAT_RG32U:
                this._glFormat = gl.RG_INTEGER;
                this._glInternalFormat = gl.RG32UI;
                this._glPixelType = gl.UNSIGNED_INT;
                break;

            // Integer texture formats (RGBA)
            case PIXELFORMAT_RGBA8I:
                this._glFormat = gl.RGBA_INTEGER;
                this._glInternalFormat = gl.RGBA8I;
                this._glPixelType = gl.BYTE;
                break;
            case PIXELFORMAT_RGBA8U:
                this._glFormat = gl.RGBA_INTEGER;
                this._glInternalFormat = gl.RGBA8UI;
                this._glPixelType = gl.UNSIGNED_BYTE;
                break;
            case PIXELFORMAT_RGBA16I:
                this._glFormat = gl.RGBA_INTEGER;
                this._glInternalFormat = gl.RGBA16I;
                this._glPixelType = gl.SHORT;
                break;
            case PIXELFORMAT_RGBA16U:
                this._glFormat = gl.RGBA_INTEGER;
                this._glInternalFormat = gl.RGBA16UI;
                this._glPixelType = gl.UNSIGNED_SHORT;
                break;
            case PIXELFORMAT_RGBA32I:
                this._glFormat = gl.RGBA_INTEGER;
                this._glInternalFormat = gl.RGBA32I;
                this._glPixelType = gl.INT;
                break;
            case PIXELFORMAT_RGBA32U:
                this._glFormat = gl.RGBA_INTEGER;
                this._glInternalFormat = gl.RGBA32UI;
                this._glPixelType = gl.UNSIGNED_INT;
                break;
        }

        this._glCreated = false;
    }

    /**
     * @param {WebglGraphicsDevice} device - The device.
     * @param {Texture} texture - The texture to update.
     */
    upload(device, texture) {

        Debug.assert(texture.device, 'Attempting to use a texture that has been destroyed.', texture);
        const gl = device.gl;

        if (!texture._needsUpload && ((texture._needsMipmapsUpload && texture._mipmapsUploaded) || !texture.pot)) {
            return;
        }

        let mipLevel = 0;
        let mipObject;
        let resMult;

        const requiredMipLevels = texture.numLevels;

        if (texture.array && !this._glCreated) {
            // for texture arrays we reserve the space in advance
            gl.texStorage3D(gl.TEXTURE_2D_ARRAY,
                requiredMipLevels,
                this._glInternalFormat,
                texture._width,
                texture._height,
                texture._arrayLength);
        }

        // Upload all existing mip levels. Initialize 0 mip anyway.
        while (texture._levels[mipLevel] || mipLevel === 0) {

            if (!texture._needsUpload && mipLevel === 0) {
                mipLevel++;
                continue;
            } else if (mipLevel && (!texture._needsMipmapsUpload || !texture._mipmaps)) {
                break;
            }

            mipObject = texture._levels[mipLevel];
            resMult = 1 / Math.pow(2, mipLevel);

            if (mipLevel === 1 && !texture._compressed && !texture._integerFormat && texture._levels.length < requiredMipLevels) {
                // We have more than one mip levels we want to assign, but we need all mips to make
                // the texture complete. Therefore first generate all mip chain from 0, then assign custom mips.
                // (this implies the call to _completePartialMipLevels above was unsuccessful)
                gl.generateMipmap(this._glTarget);
                texture._mipmapsUploaded = true;
            }

            if (texture._cubemap) {
                // ----- CUBEMAP -----
                let face;

                if (device._isBrowserInterface(mipObject[0])) {
                    // Upload the image, canvas or video
                    for (face = 0; face < 6; face++) {
                        if (!texture._levelsUpdated[0][face]) {
                            continue;
                        }

                        let src = mipObject[face];
                        // Downsize images that are too large to be used as cube maps
                        if (device._isImageBrowserInterface(src)) {
                            if (src.width > device.maxCubeMapSize || src.height > device.maxCubeMapSize) {
                                src = downsampleImage(src, device.maxCubeMapSize);
                                if (mipLevel === 0) {
                                    texture._width = src.width;
                                    texture._height = src.height;
                                }
                            }
                        }

                        device.setUnpackFlipY(false);
                        device.setUnpackPremultiplyAlpha(texture._premultiplyAlpha);

                        if (this._glCreated) {
                            gl.texSubImage2D(
                                gl.TEXTURE_CUBE_MAP_POSITIVE_X + face,
                                mipLevel,
                                0, 0,
                                this._glFormat,
                                this._glPixelType,
                                src
                            );
                        } else {
                            gl.texImage2D(
                                gl.TEXTURE_CUBE_MAP_POSITIVE_X + face,
                                mipLevel,
                                this._glInternalFormat,
                                this._glFormat,
                                this._glPixelType,
                                src
                            );
                        }
                    }
                } else {
                    // Upload the byte array
                    resMult = 1 / Math.pow(2, mipLevel);
                    for (face = 0; face < 6; face++) {
                        if (!texture._levelsUpdated[0][face]) {
                            continue;
                        }

                        const texData = mipObject[face];
                        if (texture._compressed) {
                            if (this._glCreated && texData) {
                                gl.compressedTexSubImage2D(
                                    gl.TEXTURE_CUBE_MAP_POSITIVE_X + face,
                                    mipLevel,
                                    0, 0,
                                    Math.max(texture._width * resMult, 1),
                                    Math.max(texture._height * resMult, 1),
                                    this._glInternalFormat,
                                    texData);
                            } else {
                                gl.compressedTexImage2D(
                                    gl.TEXTURE_CUBE_MAP_POSITIVE_X + face,
                                    mipLevel,
                                    this._glInternalFormat,
                                    Math.max(texture._width * resMult, 1),
                                    Math.max(texture._height * resMult, 1),
                                    0,
                                    texData
                                );
                            }
                        } else {
                            device.setUnpackFlipY(false);
                            device.setUnpackPremultiplyAlpha(texture._premultiplyAlpha);
                            // Ensure alignment is 1 for byte array uploads (see 2D texture comment)
                            device.setUnpackAlignment(1);
                            if (this._glCreated && texData) {
                                gl.texSubImage2D(
                                    gl.TEXTURE_CUBE_MAP_POSITIVE_X + face,
                                    mipLevel,
                                    0, 0,
                                    Math.max(texture._width * resMult, 1),
                                    Math.max(texture._height * resMult, 1),
                                    this._glFormat,
                                    this._glPixelType,
                                    texData
                                );
                            } else {
                                gl.texImage2D(
                                    gl.TEXTURE_CUBE_MAP_POSITIVE_X + face,
                                    mipLevel,
                                    this._glInternalFormat,
                                    Math.max(texture._width * resMult, 1),
                                    Math.max(texture._height * resMult, 1),
                                    0,
                                    this._glFormat,
                                    this._glPixelType,
                                    texData
                                );
                            }
                        }
                    }
                }
            } else if (texture._volume) {
                // ----- 3D -----
                // Image/canvas/video not supported (yet?)
                // Upload the byte array
                if (texture._compressed) {
                    gl.compressedTexImage3D(gl.TEXTURE_3D,
                        mipLevel,
                        this._glInternalFormat,
                        Math.max(texture._width * resMult, 1),
                        Math.max(texture._height * resMult, 1),
                        Math.max(texture._depth * resMult, 1),
                        0,
                        mipObject);
                } else {
                    device.setUnpackFlipY(false);
                    device.setUnpackPremultiplyAlpha(texture._premultiplyAlpha);
                    // Ensure alignment is 1 for byte array uploads (see 2D texture comment)
                    device.setUnpackAlignment(1);
                    gl.texImage3D(gl.TEXTURE_3D,
                        mipLevel,
                        this._glInternalFormat,
                        Math.max(texture._width * resMult, 1),
                        Math.max(texture._height * resMult, 1),
                        Math.max(texture._depth * resMult, 1),
                        0,
                        this._glFormat,
                        this._glPixelType,
                        mipObject);
                }
            } else if (texture.array) {
                // ----- 2D ARRAY -----
                // Only upload if mipObject is a valid array with correct length.
                // If mipObject is null or length doesn't match, skip - storage was already allocated via texStorage3D.
                if (Array.isArray(mipObject) && texture._arrayLength === mipObject.length) {
                    if (texture._compressed) {
                        for (let index = 0; index < texture._arrayLength; index++) {
                            gl.compressedTexSubImage3D(
                                gl.TEXTURE_2D_ARRAY,
                                mipLevel,
                                0,
                                0,
                                index,
                                Math.max(Math.floor(texture._width * resMult), 1),
                                Math.max(Math.floor(texture._height * resMult), 1),
                                1,
                                this._glInternalFormat,
                                mipObject[index]
                            );
                        }
                    } else {
                        // Ensure alignment is 1 for byte array uploads (see 2D texture comment)
                        device.setUnpackAlignment(1);
                        for (let index = 0; index < texture._arrayLength; index++) {
                            gl.texSubImage3D(
                                gl.TEXTURE_2D_ARRAY,
                                mipLevel,
                                0,
                                0,
                                index,
                                Math.max(Math.floor(texture._width * resMult), 1),
                                Math.max(Math.floor(texture._height * resMult), 1),
                                1,
                                this._glFormat,
                                this._glPixelType,
                                mipObject[index]
                            );
                        }
                    }
                }
            } else {
                // ----- 2D -----
                if (device._isBrowserInterface(mipObject)) {
                    // Downsize images that are too large to be used as textures
                    if (device._isImageBrowserInterface(mipObject)) {
                        if (mipObject.width > device.maxTextureSize || mipObject.height > device.maxTextureSize) {
                            mipObject = downsampleImage(mipObject, device.maxTextureSize);
                            if (mipLevel === 0) {
                                texture._width = mipObject.width;
                                texture._height = mipObject.height;
                            }
                        }
                    }

                    const w = mipObject.width || mipObject.videoWidth;
                    const h = mipObject.height || mipObject.videoHeight;

                    // Upload the image, canvas or video
                    device.setUnpackFlipY(texture._flipY);
                    device.setUnpackPremultiplyAlpha(texture._premultiplyAlpha);

                    // TEMP: disable fast path for video updates until
                    // https://bugs.chromium.org/p/chromium/issues/detail?id=1511207 is resolved
                    if (this._glCreated && texture._width === w && texture._height === h && !device._isImageVideoInterface(mipObject)) {
                        gl.texSubImage2D(
                            gl.TEXTURE_2D,
                            mipLevel,
                            0, 0,
                            this._glFormat,
                            this._glPixelType,
                            mipObject
                        );
                    } else {
                        gl.texImage2D(
                            gl.TEXTURE_2D,
                            mipLevel,
                            this._glInternalFormat,
                            this._glFormat,
                            this._glPixelType,
                            mipObject
                        );

                        if (mipLevel === 0) {
                            texture._width = w;
                            texture._height = h;
                        }
                    }
                } else {
                    // Upload the byte array
                    resMult = 1 / Math.pow(2, mipLevel);
                    if (texture._compressed) {
                        if (this._glCreated && mipObject) {
                            gl.compressedTexSubImage2D(
                                gl.TEXTURE_2D,
                                mipLevel,
                                0, 0,
                                Math.max(Math.floor(texture._width * resMult), 1),
                                Math.max(Math.floor(texture._height * resMult), 1),
                                this._glInternalFormat,
                                mipObject
                            );
                        } else {
                            gl.compressedTexImage2D(
                                gl.TEXTURE_2D,
                                mipLevel,
                                this._glInternalFormat,
                                Math.max(Math.floor(texture._width * resMult), 1),
                                Math.max(Math.floor(texture._height * resMult), 1),
                                0,
                                mipObject
                            );
                        }
                    } else {
                        device.setUnpackFlipY(false);
                        device.setUnpackPremultiplyAlpha(texture._premultiplyAlpha);
                        // Ensure alignment is 1 for byte array uploads. Other code paths (e.g.
                        // webgl-upload-stream) may change UNPACK_ALIGNMENT to match the data type's
                        // BYTES_PER_ELEMENT. For non-RGBA formats like R8/RG8/RGB8 with row widths
                        // not divisible by 4, alignment must be 1 to avoid "buffer not big enough" errors.
                        device.setUnpackAlignment(1);
                        if (this._glCreated && mipObject) {
                            gl.texSubImage2D(
                                gl.TEXTURE_2D,
                                mipLevel,
                                0, 0,
                                Math.max(texture._width * resMult, 1),
                                Math.max(texture._height * resMult, 1),
                                this._glFormat,
                                this._glPixelType,
                                mipObject
                            );
                        } else {
                            gl.texImage2D(
                                gl.TEXTURE_2D,
                                mipLevel,
                                this._glInternalFormat,
                                Math.max(texture._width * resMult, 1),
                                Math.max(texture._height * resMult, 1),
                                0,
                                this._glFormat,
                                this._glPixelType,
                                mipObject
                            );
                        }
                    }
                }

                if (mipLevel === 0) {
                    texture._mipmapsUploaded = false;
                } else {
                    texture._mipmapsUploaded = true;
                }
            }
            mipLevel++;
        }

        if (texture._needsUpload) {
            if (texture._cubemap) {
                for (let i = 0; i < 6; i++) {
                    texture._levelsUpdated[0][i] = false;
                }
            } else {
                texture._levelsUpdated[0] = false;
            }
        }

        if (!texture._compressed && !texture._integerFormat && texture._mipmaps && texture._needsMipmapsUpload && texture._levels.length === 1) {
            gl.generateMipmap(this._glTarget);
            texture._mipmapsUploaded = true;
        }

        // update vram stats
        if (texture._gpuSize) {
            texture.adjustVramSizeTracking(device._vram, -texture._gpuSize);
        }

        texture._gpuSize = texture.gpuSize;
        texture.adjustVramSizeTracking(device._vram, texture._gpuSize);

        this._glCreated = true;
    }

    /**
     * @param {WebglGraphicsDevice} device - The graphics device.
     * @param {Texture} texture - The texture.
     */
    uploadImmediate(device, texture) {

        if (texture._needsUpload || texture._needsMipmapsUpload) {

            // this uploads the texture as well
            device.setTexture(texture, 0);

            texture._needsUpload = false;
            texture._needsMipmapsUpload = false;
        }
    }

    read(x, y, width, height, options) {

        const texture = this.texture;

        /** @type {WebglGraphicsDevice} */
        const device = texture.device;
        return device.readTextureAsync(texture, x, y, width, height, options);
    }

    write(x, y, width, height, data) {
        const { texture } = this;
        const { device } = texture;
        // ensure texture is created and bound
        device.setTexture(texture, 0);
        return device.writeTextureAsync(texture, x, y, width, height, data);
    }
}

export { WebglTexture };
