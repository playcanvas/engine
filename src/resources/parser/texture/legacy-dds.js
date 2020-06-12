Object.assign(pc, function () {

    /**
     * @class
     * @name pc.LegacyDdsParser
     * @implements {pc.TextureParser}
     * @classdesc Legacy texture parser for dds files.
     */
    var LegacyDdsParser = function (registry, retryRequests) {
        this.retryRequests = retryRequests;
    };

    Object.assign(LegacyDdsParser.prototype, {
        load: function (url, callback, asset) {
            var options = {
                cache: true,
                responseType: "arraybuffer",
                retry: this.retryRequests
            };
            pc.http.get(url.load, options, callback);
        },

        open: function (url, data, device) {
            var header = new Uint32Array(data, 0, 128 / 4);

            var width = header[4];
            var height = header[3];
            var mips = Math.max(header[7], 1);
            var isFourCc = header[20] === 4;
            var fcc = header[21];
            var bpp = header[22];
            var isCubemap = header[28] === 65024; // TODO: check by bitflag

            var FCC_DXT1 = 827611204; // DXT1
            var FCC_DXT5 = 894720068; // DXT5
            var FCC_FP32 = 116; // RGBA32f

            // non standard
            var FCC_ETC1 = 826496069;
            var FCC_PVRTC_2BPP_RGB_1 = 825438800;
            var FCC_PVRTC_2BPP_RGBA_1 = 825504336;
            var FCC_PVRTC_4BPP_RGB_1 = 825439312;
            var FCC_PVRTC_4BPP_RGBA_1 = 825504848;

            var compressed = false;
            var floating = false;
            var etc1 = false;
            var pvrtc2 = false;
            var pvrtc4 = false;
            var format = null;

            var texture;

            if (isFourCc) {
                if (fcc === FCC_DXT1) {
                    format = pc.PIXELFORMAT_DXT1;
                    compressed = true;
                } else if (fcc === FCC_DXT5) {
                    format = pc.PIXELFORMAT_DXT5;
                    compressed = true;
                } else if (fcc === FCC_FP32) {
                    format = pc.PIXELFORMAT_RGBA32F;
                    floating = true;
                } else if (fcc === FCC_ETC1) {
                    format = pc.PIXELFORMAT_ETC1;
                    compressed = true;
                    etc1 = true;
                } else if (fcc === FCC_PVRTC_2BPP_RGB_1 || fcc === FCC_PVRTC_2BPP_RGBA_1) {
                    format = fcc === FCC_PVRTC_2BPP_RGB_1 ? pc.PIXELFORMAT_PVRTC_2BPP_RGB_1 : pc.PIXELFORMAT_PVRTC_2BPP_RGBA_1;
                    compressed = true;
                    pvrtc2 = true;
                } else if (fcc === FCC_PVRTC_4BPP_RGB_1 || fcc === FCC_PVRTC_4BPP_RGBA_1) {
                    format = fcc === FCC_PVRTC_4BPP_RGB_1 ? pc.PIXELFORMAT_PVRTC_4BPP_RGB_1 : pc.PIXELFORMAT_PVRTC_4BPP_RGBA_1;
                    compressed = true;
                    pvrtc4 = true;
                }
            } else {
                if (bpp === 32) {
                    format = pc.PIXELFORMAT_R8_G8_B8_A8;
                }
            }

            if (!format) {
                // #ifdef DEBUG
                console.error("This DDS pixel format is currently unsupported. Empty texture will be created instead.");
                // #endif
                texture = new pc.Texture(device, {
                    width: 4,
                    height: 4,
                    format: pc.PIXELFORMAT_R8_G8_B8
                });
                texture.name = 'dds-legacy-empty';
                return texture;
            }

            texture = new pc.Texture(device, {
                name: url,
                // #ifdef PROFILER
                profilerHint: pc.TEXHINT_ASSET,
                // #endif
                addressU: isCubemap ? pc.ADDRESS_CLAMP_TO_EDGE : pc.ADDRESS_REPEAT,
                addressV: isCubemap ? pc.ADDRESS_CLAMP_TO_EDGE : pc.ADDRESS_REPEAT,
                width: width,
                height: height,
                format: format,
                cubemap: isCubemap
            });

            var offset = 128;
            var faces = isCubemap ? 6 : 1;
            var mipSize;
            var DXT_BLOCK_WIDTH = 4;
            var DXT_BLOCK_HEIGHT = 4;
            var blockSize = fcc === FCC_DXT1 ? 8 : 16;
            var numBlocksAcross, numBlocksDown, numBlocks;
            for (var face = 0; face < faces; face++) {
                var mipWidth = width;
                var mipHeight = height;
                for (var i = 0; i < mips; i++) {
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

                    var mipBuff = floating ? new Float32Array(data, offset, mipSize) : new Uint8Array(data, offset, mipSize);
                    if (!isCubemap) {
                        texture._levels[i] = mipBuff;
                    } else {
                        if (!texture._levels[i]) texture._levels[i] = [];
                        texture._levels[i][face] = mipBuff;
                    }
                    offset += floating ? mipSize * 4 : mipSize;
                    mipWidth = Math.max(mipWidth * 0.5, 1);
                    mipHeight = Math.max(mipHeight * 0.5, 1);
                }
            }

            texture.upload();

            return texture;
        }
    });

    return {
        LegacyDdsParser: LegacyDdsParser
    };
}());
