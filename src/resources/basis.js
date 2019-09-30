Object.assign(pc, function () {

    var BASIS_FORMAT = {
        cTFETC1: 0,                         // etc1
        cTFETC2: 1,                         // etc2
        cTFBC1: 2,                          // dxt1
        cTFBC3: 3,                          // dxt5
        cTFPVRTC1_4_RGB: 8,                 // PVRTC1 rgb
        cTFPVRTC1_4_RGBA: 9,                // PVRTC1 rgba
        cTFASTC_4x4: 10,                    // ASTC
        cTFATC_RGB: 11,                     // ATC rgb
        cTFATC_RGBA_INTERPOLATED_ALPHA: 12, // ATC rgba

        // uncompressed (fallback) formats
        cTFRGB565: 14,          // rgb 565
        cTFRGBA4444: 16         // rgbq 4444
    };

    var DXT_FORMAT_MAP = {};
    DXT_FORMAT_MAP[BASIS_FORMAT.cTFETC1] = pc.PIXELFORMAT_ETC1;
    DXT_FORMAT_MAP[BASIS_FORMAT.cTFETC2] = pc.PIXELFORMAT_ETC2_RGBA;
    DXT_FORMAT_MAP[BASIS_FORMAT.cTFBC1] = pc.PIXELFORMAT_DXT1;
    DXT_FORMAT_MAP[BASIS_FORMAT.cTFBC3] = pc.PIXELFORMAT_DXT5;
    DXT_FORMAT_MAP[BASIS_FORMAT.cTFPVRTC1_4_RGB] = pc.PIXELFORMAT_PVRTC_4BPP_RGB_1;
    DXT_FORMAT_MAP[BASIS_FORMAT.cTFPVRTC1_4_RGBA] = pc.PIXELFORMAT_PVRTC_4BPP_RGBA_1;
    DXT_FORMAT_MAP[BASIS_FORMAT.cTFASTC_4x4] = pc.PIXELFORMAT_ASTC_4x4;
    DXT_FORMAT_MAP[BASIS_FORMAT.cTFATC_RGB] = pc.PIXELFORMAT_ATC_RGB;
    DXT_FORMAT_MAP[BASIS_FORMAT.cTFATC_RGBA_INTERPOLATED_ALPHA] = pc.PIXELFORMAT_ATC_RGBA;
    DXT_FORMAT_MAP[BASIS_FORMAT.cTFRGB565] = pc.PIXELFORMAT_R5_G6_B5;
    DXT_FORMAT_MAP[BASIS_FORMAT.cTFRGBA4444] = pc.PIXELFORMAT_R4_G4_B4_A4;

    var chooseBasisFormat = function (device, hasAlpha) {
        if (device.extCompressedTextureASTC) {
            return BASIS_FORMAT.cTFASTC_4x4;
        } else if (device.extCompressedTextureS3TC) {
            return hasAlpha ? BASIS_FORMAT.cTFBC3 : BASIS_FORMAT.cTFBC1;
        } else if (device.extCompressedTextureETC) {                            // TODO: does the presence of etc support imply etc1 support?
            return hasAlpha ? BASIS_FORMAT.cTFETC2 : BASIS_FORMAT.cTFETC1;
        } else if (device.extCompressedTextureETC1) {
            return hasAlpha ? BASIS_FORMAT.cTFRGBA4444 : BASIS_FORMAT.cTFETC1;  // TODO: fallback to 4444 or 8888?
        } else if (device.extCompressedTexturePVRTC) {
            return hasAlpha ? BASIS_FORMAT.cTFPVRTC1_4_RGBA : BASIS_FORMAT.cTFPVRTC1_4_RGB;
        } else if (device.extCompressedTextureATC) {
            return hasAlpha ? BASIS_FORMAT.cTFATC_RGBA_INTERPOLATED_ALPHA : BASIS_FORMAT.cTFATC_RGB;
        }
        return hasAlpha ? BASIS_FORMAT.cTFRGBA4444 : BASIS_FORMAT.cTFRGB565;
    };

    var initialized = false;
    var width, height, images, levels, hasAlpha, alignedWidth, alignedHeight, format;

    var BasisParser = function (data) {
        var BASIS = window.BASIS;

        if (!BASIS) {
            return;
        }

        if (!initialized) {
            BASIS.initializeBasis();
            initialized = true;
        }

        var basisFile = new BASIS.BasisFile(new Uint8Array(data));

        width = basisFile.getImageWidth(0, 0);
        height = basisFile.getImageHeight(0, 0);
        images = basisFile.getNumImages();
        levels = basisFile.getNumLevels(0);
        hasAlpha = !!basisFile.getHasAlpha();

        if (!width || !height || !images || !levels) {
            basisFile.close();
            basisFile.delete();
            return;
        }

        // select format based on supported formats
        // TODO: is this the correct place to get the graphicsDevice?
        format = chooseBasisFormat(pc.app.graphicsDevice, hasAlpha);

        if (!basisFile.startTranscoding()) {
            basisFile.close();
            basisFile.delete();
            return;
        }

        var levelData = [];
        for (var mip = 0; mip < levels; ++mip) {
            var dstSize = basisFile.getImageTranscodedSizeInBytes(0, mip, format);
            var dst = new Uint8Array(dstSize);

            if (!basisFile.transcodeImage(dst, 0, mip, format, 1, 0)) {
                basisFile.close();
                basisFile.delete();
                return;
            }

            var i;
            if (format === BASIS_FORMAT.cTFRGB565 || format === BASIS_FORMAT.cTFRGBA4444) {
                // 16 bit formats require Uint16 typed array
                var dst16 = new Uint16Array(dstSize / 2);
                for (i = 0; i < dstSize / 2; ++i) {
                    dst16[i] = dst[i * 2] + dst[i * 2 + 1] * 256;
                }
                dst = dst16;
            }

            levelData.push(dst);
        }

        basisFile.close();
        basisFile.delete();

        alignedWidth = (width + 3) & ~3;
        alignedHeight = (height + 3) & ~3;

        this.format = DXT_FORMAT_MAP[format];
        this.width = alignedWidth;
        this.height = alignedHeight;
        this.levels = levelData;
        this.cubemap = false;   // isCubeMap;
        this.mipmaps = true;
    };

    return {
        BasisParser: BasisParser
    };
}());
