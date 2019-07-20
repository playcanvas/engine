Object.assign(pc, function () {

    /* eslint-disable no-unused-vars */

    // Defined here:
    // https://docs.microsoft.com/en-us/windows/desktop/direct3ddds/dds-header
    var DDSD_CAPS = 0x1;            // Required in every .dds file.
    var DDSD_HEIGHT = 0x2;          // Required in every .dds file.
    var DDSD_WIDTH = 0x4;           // Required in every .dds file.
    var DDSD_PITCH = 0x8;           // Required when pitch is provided for an uncompressed texture.
    var DDSD_PIXELFORMAT = 0x1000;  // Required in every .dds file.
    var DDSD_MIPMAPCOUNT = 0x20000; // Required in a mipmapped texture.
    var DDSD_LINEARSIZE = 0x80000;  // Required when pitch is provided for a compressed texture.
    var DDSD_DEPTH = 0x800000;      // Required in a depth texture.

    var DDSCAPS2_CUBEMAP = 0x200;
    var DDSCAPS2_CUBEMAP_POSITIVEX = 0x400;
    var DDSCAPS2_CUBEMAP_NEGATIVEX = 0x800;
    var DDSCAPS2_CUBEMAP_POSITIVEY = 0x1000;
    var DDSCAPS2_CUBEMAP_NEGATIVEY = 0x2000;
    var DDSCAPS2_CUBEMAP_POSITIVEZ = 0x4000;
    var DDSCAPS2_CUBEMAP_NEGATIVEZ = 0x8000;

    var DDS_CUBEMAP_ALLFACES = DDSCAPS2_CUBEMAP |
        DDSCAPS2_CUBEMAP_POSITIVEX | DDSCAPS2_CUBEMAP_NEGATIVEX |
        DDSCAPS2_CUBEMAP_POSITIVEY | DDSCAPS2_CUBEMAP_NEGATIVEY |
        DDSCAPS2_CUBEMAP_POSITIVEZ | DDSCAPS2_CUBEMAP_NEGATIVEZ;

    // Defined here:
    // https://docs.microsoft.com/en-us/windows/desktop/direct3ddds/dds-pixelformat
    var DDPF_ALPHAPIXELS = 0x1;
    var DDPF_ALPHA = 0x2;
    var DDPF_FOURCC = 0x4;
    var DDPF_RGB = 0x40;
    var DDPF_YUV = 0x200;
    var DDPF_LUMINANCE = 0x20000;

    /* eslint-enable no-unused-vars */

    // FourCC construction
    var makeFourCC = function (str) {
        return str.charCodeAt(0) +
               (str.charCodeAt(1) << 8) +
               (str.charCodeAt(2) << 16) +
               (str.charCodeAt(3) << 24);
    };

    var DDS_MAGIC = makeFourCC('DDS ');

    // Standard
    var FCC_DXT1 = makeFourCC('DXT1');
    var FCC_DXT5 = makeFourCC('DXT5');
    var FCC_DX10 = makeFourCC('DX10');
    var FCC_FP32 = 116; // RGBA32f

    // Non-standard
    var FCC_ETC1 = makeFourCC('ETC1');
    var FCC_PVRTC_2BPP_RGB_1 = makeFourCC('P231');
    var FCC_PVRTC_2BPP_RGBA_1 = makeFourCC('P241');
    var FCC_PVRTC_4BPP_RGB_1 = makeFourCC('P431');
    var FCC_PVRTC_4BPP_RGBA_1 = makeFourCC('P441');

    var fccToFormat = {};
    fccToFormat[FCC_FP32] = pc.PIXELFORMAT_RGBA32F;
    fccToFormat[FCC_DXT1] = pc.PIXELFORMAT_DXT1;
    fccToFormat[FCC_DXT5] = pc.PIXELFORMAT_DXT5;
    fccToFormat[FCC_ETC1] = pc.PIXELFORMAT_ETC1;
    fccToFormat[FCC_PVRTC_2BPP_RGB_1] = pc.PIXELFORMAT_PVRTC_2BPP_RGB_1;
    fccToFormat[FCC_PVRTC_2BPP_RGBA_1] = pc.PIXELFORMAT_PVRTC_2BPP_RGBA_1;
    fccToFormat[FCC_PVRTC_4BPP_RGB_1] = pc.PIXELFORMAT_PVRTC_4BPP_RGB_1;
    fccToFormat[FCC_PVRTC_4BPP_RGBA_1] = pc.PIXELFORMAT_PVRTC_4BPP_RGBA_1;

    var DdsParser = function (arrayBuffer) {
        var headerU32 = new Uint32Array(arrayBuffer, 0, 32);

        // Check magic number
        var magic = headerU32[0];
        if (magic !== DDS_MAGIC) {
            // #ifdef DEBUG
            console.warn("Invalid magic number found in DDS file. Expected 0x20534444. Got " + magic + ".");
            // #endif
            return null;
        }

        var header = {
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
            // #ifdef DEBUG
            console.warn("Invalid size for DDS header. Expected 124. Got " + header.size + ".");
            // #endif
            return null;
        }

        // Byte offset locating the first byte of texture level data
        var offset = 4 + header.size;

        // If the ddspf.flags property is set to DDPF_FOURCC and ddspf.fourCc is set to
        // "DX10" an additional DDS_HEADER_DXT10 structure will be present.
        // https://docs.microsoft.com/en-us/windows/desktop/direct3ddds/dds-header-dxt10
        // var header10; // not used
        var isFcc = header.ddspf.flags & DDPF_FOURCC;
        var fcc = header.ddspf.fourCc;
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
        // var bpp = header.ddspf.rgbBitCount; // not used
        var isCubeMap = header.caps2 === DDS_CUBEMAP_ALLFACES;
        var numFaces = isCubeMap ? 6 : 1;
        var numMips = header.flags & DDSD_MIPMAPCOUNT ? header.mipMapCount : 1;
        var levels = [];
        if (isCubeMap) {
            for (var mipCnt = 0; mipCnt < numMips; mipCnt++) {
                levels.push([]);
            }
        }
        for (var face = 0; face < numFaces; face++) {
            var mipWidth = header.width;
            var mipHeight = header.height;

            for (var mip = 0; mip < numMips; mip++) {
                var mipSize;
                if ((fcc === FCC_DXT1) || (fcc === FCC_DXT5) || (fcc === FCC_ETC1)) {
                    var bytesPerBlock = (fcc === FCC_DXT5) ? 16 : 8;
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

                var mipData = (fcc === FCC_FP32) ? new Float32Array(arrayBuffer, offset, mipSize) : new Uint8Array(arrayBuffer, offset, mipSize);
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

        this.format = fccToFormat[fcc] || pc.PIXELFORMAT_R8_G8_B8_A8;
        this.width = header.width;
        this.height = header.height;
        this.levels = levels;
        this.cubemap = isCubeMap;
    };

    return {
        DdsParser: DdsParser
    };
}());
