import { http } from '../../../net/http.js';

import {
    ADDRESS_CLAMP_TO_EDGE, ADDRESS_REPEAT,
    PIXELFORMAT_DXT1, PIXELFORMAT_DXT5,
    PIXELFORMAT_ETC1,
    PIXELFORMAT_PVRTC_4BPP_RGB_1, PIXELFORMAT_PVRTC_2BPP_RGB_1, PIXELFORMAT_PVRTC_4BPP_RGBA_1, PIXELFORMAT_PVRTC_2BPP_RGBA_1,
    PIXELFORMAT_R8_G8_B8_A8,
    PIXELFORMAT_RGBA32F,
    TEXHINT_ASSET
} from '../../../graphics/constants.js';
import { Texture } from '../../../graphics/texture.js';

/* eslint-disable no-unused-vars */

// Defined here:
// https://docs.microsoft.com/en-us/windows/desktop/direct3ddds/dds-header
const DDSD_CAPS = 0x1;            // Required in every .dds file.
const DDSD_HEIGHT = 0x2;          // Required in every .dds file.
const DDSD_WIDTH = 0x4;           // Required in every .dds file.
const DDSD_PITCH = 0x8;           // Required when pitch is provided for an uncompressed texture.
const DDSD_PIXELFORMAT = 0x1000;  // Required in every .dds file.
const DDSD_MIPMAPCOUNT = 0x20000; // Required in a mipmapped texture.
const DDSD_LINEARSIZE = 0x80000;  // Required when pitch is provided for a compressed texture.
const DDSD_DEPTH = 0x800000;      // Required in a depth texture.

const DDSCAPS2_CUBEMAP = 0x200;
const DDSCAPS2_CUBEMAP_POSITIVEX = 0x400;
const DDSCAPS2_CUBEMAP_NEGATIVEX = 0x800;
const DDSCAPS2_CUBEMAP_POSITIVEY = 0x1000;
const DDSCAPS2_CUBEMAP_NEGATIVEY = 0x2000;
const DDSCAPS2_CUBEMAP_POSITIVEZ = 0x4000;
const DDSCAPS2_CUBEMAP_NEGATIVEZ = 0x8000;

const DDS_CUBEMAP_ALLFACES = DDSCAPS2_CUBEMAP |
      DDSCAPS2_CUBEMAP_POSITIVEX | DDSCAPS2_CUBEMAP_NEGATIVEX |
      DDSCAPS2_CUBEMAP_POSITIVEY | DDSCAPS2_CUBEMAP_NEGATIVEY |
      DDSCAPS2_CUBEMAP_POSITIVEZ | DDSCAPS2_CUBEMAP_NEGATIVEZ;

// Defined here:
// https://docs.microsoft.com/en-us/windows/desktop/direct3ddds/dds-pixelformat
const DDPF_ALPHAPIXELS = 0x1;
const DDPF_ALPHA = 0x2;
const DDPF_FOURCC = 0x4;
const DDPF_RGB = 0x40;
const DDPF_YUV = 0x200;
const DDPF_LUMINANCE = 0x20000;

/* eslint-enable no-unused-vars */

// FourCC construction
function makeFourCC(str) {
    return str.charCodeAt(0) +
           (str.charCodeAt(1) << 8) +
           (str.charCodeAt(2) << 16) +
           (str.charCodeAt(3) << 24);
}

const DDS_MAGIC = makeFourCC('DDS ');

// Standard
const FCC_DXT1 = makeFourCC('DXT1');
const FCC_DXT5 = makeFourCC('DXT5');
const FCC_DX10 = makeFourCC('DX10');
const FCC_FP32 = 116; // RGBA32f

// Non-standard
const FCC_ETC1 = makeFourCC('ETC1');
const FCC_PVRTC_2BPP_RGB_1 = makeFourCC('P231');
const FCC_PVRTC_2BPP_RGBA_1 = makeFourCC('P241');
const FCC_PVRTC_4BPP_RGB_1 = makeFourCC('P431');
const FCC_PVRTC_4BPP_RGBA_1 = makeFourCC('P441');

const fccToFormat = {};
fccToFormat[FCC_FP32] = PIXELFORMAT_RGBA32F;
fccToFormat[FCC_DXT1] = PIXELFORMAT_DXT1;
fccToFormat[FCC_DXT5] = PIXELFORMAT_DXT5;
fccToFormat[FCC_ETC1] = PIXELFORMAT_ETC1;
fccToFormat[FCC_PVRTC_2BPP_RGB_1] = PIXELFORMAT_PVRTC_2BPP_RGB_1;
fccToFormat[FCC_PVRTC_2BPP_RGBA_1] = PIXELFORMAT_PVRTC_2BPP_RGBA_1;
fccToFormat[FCC_PVRTC_4BPP_RGB_1] = PIXELFORMAT_PVRTC_4BPP_RGB_1;
fccToFormat[FCC_PVRTC_4BPP_RGBA_1] = PIXELFORMAT_PVRTC_4BPP_RGBA_1;

/**
 * @private
 * @class
 * @name DdsParser
 * @implements {TextureParser}
 * @classdesc Texture parser for dds files.
 */
class DdsParser {
    constructor(registry) {
        this.maxRetries = 0;
    }

    load(url, callback, asset) {
        const options = {
            cache: true,
            responseType: "arraybuffer",
            retry: this.maxRetries > 0,
            maxRetries: this.maxRetries
        };
        http.get(url.load, options, callback);
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
        const arrayBuffer = data;

        let headerU32 = new Uint32Array(arrayBuffer, 0, 32);

        // Check magic number
        const magic = headerU32[0];
        if (magic !== DDS_MAGIC) {
            // #if _DEBUG
            console.warn("Invalid magic number found in DDS file. Expected 0x20534444. Got " + magic + ".");
            // #endif
            return null;
        }

        const header = {
            size: headerU32[1],
            flags: headerU32[2],
            height: headerU32[3],
            width: headerU32[4],
            pitchOrLinearSize: headerU32[5],
            depth: headerU32[6],
            mipMapCount: Math.max(headerU32[7], 1),
            // DWORDSs 8 - 18 are reserved
            ddspf: {
                size: headerU32[19],
                flags: headerU32[20],
                fourCc: headerU32[21],
                rgbBitCount: headerU32[22],
                rBitMask: headerU32[23],
                gBitMask: headerU32[24],
                bBitMask: headerU32[25],
                aBitMask: headerU32[26]
            },
            caps: headerU32[27],
            caps2: headerU32[28],
            caps3: headerU32[29],
            caps4: headerU32[30]
            // DWORD 31 is reserved
        };

        // Verify DDS header size
        if (header.size !== 124) {
            // #if _DEBUG
            console.warn("Invalid size for DDS header. Expected 124. Got " + header.size + ".");
            // #endif
            return null;
        }

        // Byte offset locating the first byte of texture level data
        let offset = 4 + header.size;

        // If the ddspf.flags property is set to DDPF_FOURCC and ddspf.fourCc is set to
        // "DX10" an additional DDS_HEADER_DXT10 structure will be present.
        // https://docs.microsoft.com/en-us/windows/desktop/direct3ddds/dds-header-dxt10
        // let header10; // not used
        const isFcc = header.ddspf.flags & DDPF_FOURCC;
        const fcc = header.ddspf.fourCc;
        if (isFcc && (fcc === FCC_DX10)) {
            headerU32 = new Uint32Array(arrayBuffer, 128, 5);
            // header10 = {
            //     dxgiFormat: headerU32[0],
            //     resourceDimension: headerU32[1],
            //     miscFlag: headerU32[2],
            //     arraySize: headerU32[3],
            //     miscFlags2: headerU32[4]
            // };
            offset += 20;
        }

        // Read texture data
        // let bpp = header.ddspf.rgbBitCount; // not used
        const isCubeMap = header.caps2 === DDS_CUBEMAP_ALLFACES;
        const numFaces = isCubeMap ? 6 : 1;
        const numMips = header.flags & DDSD_MIPMAPCOUNT ? header.mipMapCount : 1;
        const levels = [];
        if (isCubeMap) {
            for (let mipCnt = 0; mipCnt < numMips; mipCnt++) {
                levels.push([]);
            }
        }
        for (let face = 0; face < numFaces; face++) {
            let mipWidth = header.width;
            let mipHeight = header.height;

            for (let mip = 0; mip < numMips; mip++) {
                let mipSize;
                if ((fcc === FCC_DXT1) || (fcc === FCC_DXT5) || (fcc === FCC_ETC1)) {
                    const bytesPerBlock = (fcc === FCC_DXT5) ? 16 : 8;
                    mipSize = Math.floor((mipWidth + 3) / 4) * Math.floor((mipHeight + 3) / 4) * bytesPerBlock;
                } else if ((fcc === FCC_PVRTC_2BPP_RGB_1 || fcc === FCC_PVRTC_2BPP_RGBA_1)) {
                    mipSize = Math.max(mipWidth, 16) * Math.max(mipHeight, 8) / 4;
                } else if ((fcc === FCC_PVRTC_4BPP_RGB_1 || fcc === FCC_PVRTC_4BPP_RGBA_1)) {
                    mipSize = Math.max(mipWidth, 8) * Math.max(mipHeight, 8) / 2;
                } else if (header.ddspf.rgbBitCount === 32) {
                    // f32 or uncompressed rgba
                    // 4 floats per texel
                    mipSize = mipWidth * mipHeight * 4;
                } else {
                    // Unsupported format
                    return null;
                }

                const mipData = (fcc === FCC_FP32) ? new Float32Array(arrayBuffer, offset, mipSize) : new Uint8Array(arrayBuffer, offset, mipSize);
                if (isCubeMap) {
                    levels[mip][face] = mipData;
                } else {
                    levels.push(mipData);
                }

                offset += (fcc === FCC_FP32) ? mipSize * 4 : mipSize;
                mipWidth = Math.max(mipWidth * 0.5, 1);
                mipHeight = Math.max(mipHeight * 0.5, 1);
            }
        }

        return {
            format: fccToFormat[fcc] || PIXELFORMAT_R8_G8_B8_A8,
            width: header.width,
            height: header.height,
            levels: levels,
            cubemap: isCubeMap
        };
    }
}

export { DdsParser };
