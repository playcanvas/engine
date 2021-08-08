import { Asset } from '../../../asset/asset.js';
import { Texture } from '../../../graphics/texture.js';
import {
    ADDRESS_CLAMP_TO_EDGE, ADDRESS_REPEAT,
    PIXELFORMAT_DXT1, PIXELFORMAT_DXT3, PIXELFORMAT_DXT5,
    PIXELFORMAT_ETC1, PIXELFORMAT_ETC2_RGB, PIXELFORMAT_ETC2_RGBA,
    PIXELFORMAT_PVRTC_4BPP_RGB_1, PIXELFORMAT_PVRTC_2BPP_RGB_1, PIXELFORMAT_PVRTC_4BPP_RGBA_1, PIXELFORMAT_PVRTC_2BPP_RGBA_1,
    PIXELFORMAT_R8_G8_B8, PIXELFORMAT_R8_G8_B8_A8, PIXELFORMAT_SRGB, PIXELFORMAT_SRGBA,
    PIXELFORMAT_111110F, PIXELFORMAT_RGB16F, PIXELFORMAT_RGBA16F,
    TEXHINT_ASSET
} from '../../../graphics/constants.js';

// Defined here: https://www.khronos.org/opengles/sdk/tools/KTX/file_format_spec/
const IDENTIFIER = [0x58544BAB, 0xBB313120, 0x0A1A0A0D]; // «KTX 11»\r\n\x1A\n

const KNOWN_FORMATS = {
    // compressed formats
    0x83F0: PIXELFORMAT_DXT1,
    0x83F2: PIXELFORMAT_DXT3,
    0x83F3: PIXELFORMAT_DXT5,
    0x8D64: PIXELFORMAT_ETC1,
    0x9274: PIXELFORMAT_ETC2_RGB,
    0x9278: PIXELFORMAT_ETC2_RGBA,
    0x8C00: PIXELFORMAT_PVRTC_4BPP_RGB_1,
    0x8C01: PIXELFORMAT_PVRTC_2BPP_RGB_1,
    0x8C02: PIXELFORMAT_PVRTC_4BPP_RGBA_1,
    0x8C03: PIXELFORMAT_PVRTC_2BPP_RGBA_1,

    // uncompressed formats
    0x8051: PIXELFORMAT_R8_G8_B8,       // GL_RGB8
    0x8058: PIXELFORMAT_R8_G8_B8_A8,    // GL_RGBA8
    0x8C41: PIXELFORMAT_SRGB,           // GL_SRGB8
    0x8C43: PIXELFORMAT_SRGBA,          // GL_SRGB8_ALPHA8
    0x8C3A: PIXELFORMAT_111110F,        // GL_R11F_G11F_B10F
    0x881B: PIXELFORMAT_RGB16F,         // GL_RGB16F
    0x881A: PIXELFORMAT_RGBA16F         // GL_RGBA16F
};

function createContainer(pixelFormat, buffer, byteOffset, byteSize) {
    return (pixelFormat === PIXELFORMAT_111110F) ?
        new Uint32Array(buffer, byteOffset, byteSize / 4) :
        new Uint8Array(buffer, byteOffset, byteSize);
}

/**
 * @private
 * @class
 * @name KtxParser
 * @implements {TextureParser}
 * @classdesc Texture parser for ktx files.
 */
class KtxParser {
    constructor(registry) {
        this.maxRetries = 0;
    }

    load(url, callback, asset) {
        Asset.fetchArrayBuffer(url.load, callback, asset, this.maxRetries);
    }

    open(url, data, device) {
        const textureData = this.parse(data);

        if (!textureData) {
            return null;
        }

        const texture = new Texture(device, {
            name: url,
            // #if _PROFILER
            profilerHint: TEXHINT_ASSET,
            // #endif
            addressU: textureData.cubemap ? ADDRESS_CLAMP_TO_EDGE : ADDRESS_REPEAT,
            addressV: textureData.cubemap ? ADDRESS_CLAMP_TO_EDGE : ADDRESS_REPEAT,
            width: textureData.width,
            height: textureData.height,
            format: textureData.format,
            cubemap: textureData.cubemap,
            levels: textureData.levels
        });

        texture.upload();

        return texture;
    }

    parse(data) {
        const dataU32 = new Uint32Array(data);

        // check magic bits
        if (IDENTIFIER[0] !== dataU32[0] ||
            IDENTIFIER[1] !== dataU32[1] ||
            IDENTIFIER[2] !== dataU32[2]) {
            // #if _DEBUG
            console.warn("Invalid definition header found in KTX file. Expected 0xAB4B5458, 0x203131BB, 0x0D0A1A0A");
            // #endif
            return null;
        }

        // unpack header info
        const header = {
            endianness: dataU32[3], // todo: Use this information
            glType: dataU32[4],
            glTypeSize: dataU32[5],
            glFormat: dataU32[6],
            glInternalFormat: dataU32[7],
            glBaseInternalFormat: dataU32[8],
            pixelWidth: dataU32[9],
            pixelHeight: dataU32[10],
            pixelDepth: dataU32[11],
            numberOfArrayElements: dataU32[12],
            numberOfFaces: dataU32[13],
            numberOfMipmapLevels: dataU32[14],
            bytesOfKeyValueData: dataU32[15]
        };

        // don't support volume textures
        if (header.pixelDepth > 1) {
            // #if _DEBUG
            console.warn("More than 1 pixel depth not supported!");
            // #endif
            return null;
        }

        // don't support texture arrays
        if (header.numberOfArrayElements !== 0) {
            // #if _DEBUG
            console.warn("Array texture not supported!");
            // #endif
            return null;
        }

        const format = KNOWN_FORMATS[header.glInternalFormat];

        // only support subset of pixel formats
        if (format === undefined) {
            // #if _DEBUG
            console.warn("Unknown glInternalFormat: " + header.glInternalFormat);
            // #endif
            return null;
        }

        // offset locating the first byte of texture level data
        let offset = 16 + header.bytesOfKeyValueData / 4;

        const isCubemap = (header.numberOfFaces > 1);
        const levels = [];
        for (let mipmapLevel = 0; mipmapLevel < (header.numberOfMipmapLevels || 1); mipmapLevel++) {
            const imageSizeInBytes = dataU32[offset++];

            if (isCubemap) {
                levels.push([]);
            }

            const target = isCubemap ? levels[mipmapLevel] : levels;

            for (let face = 0; face < (isCubemap ? 6 : 1); ++face) {
                target.push(createContainer(format, data, offset * 4, imageSizeInBytes));
                offset += (imageSizeInBytes + 3) >> 2;
            }
        }

        return {
            format: format,
            width: header.pixelWidth,
            height: header.pixelHeight,
            levels: levels,
            cubemap: isCubemap
        };
    }
}

export { KtxParser };
