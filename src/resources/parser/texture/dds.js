import { Asset } from '../../../asset/asset.js';
import { Texture } from '../../../graphics/texture.js';
import {
    ADDRESS_CLAMP_TO_EDGE, ADDRESS_REPEAT,
    PIXELFORMAT_DXT1, PIXELFORMAT_DXT5,
    PIXELFORMAT_ETC1,
    PIXELFORMAT_PVRTC_4BPP_RGB_1, PIXELFORMAT_PVRTC_2BPP_RGB_1, PIXELFORMAT_PVRTC_4BPP_RGBA_1, PIXELFORMAT_PVRTC_2BPP_RGBA_1,
    PIXELFORMAT_R8_G8_B8, PIXELFORMAT_R8_G8_B8_A8,
    PIXELFORMAT_RGBA16F, PIXELFORMAT_RGBA32F,
    TEXHINT_ASSET
} from '../../../graphics/constants.js';

/**
 * @private
 * @class
 * @name DdsParser
 * @implements {TextureParser}
 * @classdesc Legacy texture parser for dds files.
 */
class DdsParser {
    constructor(registry) {
        this.maxRetries = 0;
    }

    load(url, callback, asset) {
        Asset.fetchArrayBuffer(url.load, callback, asset, this.maxRetries);
    }

    open(url, data, device) {
        const header = new Uint32Array(data, 0, 128 / 4);

        const width = header[4];
        const height = header[3];
        const mips = Math.max(header[7], 1);
        const isFourCc = header[20] === 4;
        const fcc = header[21];
        const bpp = header[22];
        const isCubemap = header[28] === 65024; // TODO: check by bitflag

        const FCC_DXT1 = 827611204; // DXT1
        const FCC_DXT5 = 894720068; // DXT5
        const FCC_FP16 = 113;       // RGBA16f
        const FCC_FP32 = 116;       // RGBA32f

        // non standard
        const FCC_ETC1 = 826496069;
        const FCC_PVRTC_2BPP_RGB_1 = 825438800;
        const FCC_PVRTC_2BPP_RGBA_1 = 825504336;
        const FCC_PVRTC_4BPP_RGB_1 = 825439312;
        const FCC_PVRTC_4BPP_RGBA_1 = 825504848;

        let compressed = false;
        let etc1 = false;
        let pvrtc2 = false;
        let pvrtc4 = false;
        let format = null;
        let componentSize = 1;

        let texture;

        if (isFourCc) {
            if (fcc === FCC_DXT1) {
                format = PIXELFORMAT_DXT1;
                compressed = true;
            } else if (fcc === FCC_DXT5) {
                format = PIXELFORMAT_DXT5;
                compressed = true;
            } else if (fcc === FCC_FP16) {
                format = PIXELFORMAT_RGBA16F;
                componentSize = 2;
            } else if (fcc === FCC_FP32) {
                format = PIXELFORMAT_RGBA32F;
                componentSize = 4;
            } else if (fcc === FCC_ETC1) {
                format = PIXELFORMAT_ETC1;
                compressed = true;
                etc1 = true;
            } else if (fcc === FCC_PVRTC_2BPP_RGB_1 || fcc === FCC_PVRTC_2BPP_RGBA_1) {
                format = fcc === FCC_PVRTC_2BPP_RGB_1 ? PIXELFORMAT_PVRTC_2BPP_RGB_1 : PIXELFORMAT_PVRTC_2BPP_RGBA_1;
                compressed = true;
                pvrtc2 = true;
            } else if (fcc === FCC_PVRTC_4BPP_RGB_1 || fcc === FCC_PVRTC_4BPP_RGBA_1) {
                format = fcc === FCC_PVRTC_4BPP_RGB_1 ? PIXELFORMAT_PVRTC_4BPP_RGB_1 : PIXELFORMAT_PVRTC_4BPP_RGBA_1;
                compressed = true;
                pvrtc4 = true;
            }
        } else {
            if (bpp === 32) {
                format = PIXELFORMAT_R8_G8_B8_A8;
            }
        }

        if (!format) {
            // #if _DEBUG
            console.error("This DDS pixel format is currently unsupported. Empty texture will be created instead.");
            // #endif
            texture = new Texture(device, {
                width: 4,
                height: 4,
                format: PIXELFORMAT_R8_G8_B8
            });
            texture.name = 'dds-legacy-empty';
            return texture;
        }

        texture = new Texture(device, {
            name: url,
            // #if _PROFILER
            profilerHint: TEXHINT_ASSET,
            // #endif
            addressU: isCubemap ? ADDRESS_CLAMP_TO_EDGE : ADDRESS_REPEAT,
            addressV: isCubemap ? ADDRESS_CLAMP_TO_EDGE : ADDRESS_REPEAT,
            width: width,
            height: height,
            format: format,
            cubemap: isCubemap,
            mipmaps: mips > 1
        });

        let offset = 128;
        const faces = isCubemap ? 6 : 1;
        let mipSize;
        const DXT_BLOCK_WIDTH = 4;
        const DXT_BLOCK_HEIGHT = 4;
        const blockSize = fcc === FCC_DXT1 ? 8 : 16;
        let numBlocksAcross, numBlocksDown, numBlocks;
        for (let face = 0; face < faces; face++) {
            let mipWidth = width;
            let mipHeight = height;
            for (let i = 0; i < mips; i++) {
                if (compressed) {
                    if (etc1) {
                        mipSize = Math.floor((mipWidth + 3) / 4) * Math.floor((mipHeight + 3) / 4) * 8;
                    } else if (pvrtc2) {
                        mipSize = Math.max(mipWidth, 16) * Math.max(mipHeight, 8) / 4;
                    } else if (pvrtc4) {
                        mipSize = Math.max(mipWidth, 8) * Math.max(mipHeight, 8) / 2;
                    } else {
                        numBlocksAcross = Math.floor((mipWidth + DXT_BLOCK_WIDTH - 1) / DXT_BLOCK_WIDTH);
                        numBlocksDown = Math.floor((mipHeight + DXT_BLOCK_HEIGHT - 1) / DXT_BLOCK_HEIGHT);
                        numBlocks = numBlocksAcross * numBlocksDown;
                        mipSize = numBlocks * blockSize;
                    }
                } else {
                    mipSize = mipWidth * mipHeight * 4;
                }

                const mipBuff = format === PIXELFORMAT_RGBA32F ? new Float32Array(data, offset, mipSize) :
                    (format === PIXELFORMAT_RGBA16F ? new Uint16Array(data, offset, mipSize) :
                        new Uint8Array(data, offset, mipSize));

                if (!isCubemap) {
                    texture._levels[i] = mipBuff;
                } else {
                    if (!texture._levels[i]) texture._levels[i] = [];
                    texture._levels[i][face] = mipBuff;
                }
                offset += mipSize * componentSize;
                mipWidth = Math.max(mipWidth * 0.5, 1);
                mipHeight = Math.max(mipHeight * 0.5, 1);
            }
        }

        texture.upload();

        return texture;
    }
}

export { DdsParser };
