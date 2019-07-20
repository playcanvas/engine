Object.assign(pc, function () {
    // Defined here: https://www.khronos.org/opengles/sdk/tools/KTX/file_format_spec/
    var IDENTIFIER = [0x58544BAB, 0xBB313120, 0x0A1A0A0D]; // «KTX 11»\r\n\x1A\n
    var KNOWN_FORMATS = {
        0x83F0: pc.PIXELFORMAT_DXT1,
        0x83F2: pc.PIXELFORMAT_DXT3,
        0x83F3: pc.PIXELFORMAT_DXT5,
        0x8D64: pc.PIXELFORMAT_ETC1,
        0x9274: pc.PIXELFORMAT_ETC2_RGB,
        0x9278: pc.PIXELFORMAT_ETC2_RGBA,
        0x8C00: pc.PIXELFORMAT_PVRTC_4BPP_RGB_1,
        0x8C01: pc.PIXELFORMAT_PVRTC_2BPP_RGB_1,
        0x8C02: pc.PIXELFORMAT_PVRTC_4BPP_RGBA_1,
        0x8C03: pc.PIXELFORMAT_PVRTC_2BPP_RGBA_1
    };

    var KtxParser = function (arrayBuffer) {
        var headerU32 = new Uint32Array(arrayBuffer, 0, 16);

        if (IDENTIFIER[0] !== headerU32[0] || IDENTIFIER[1] !== headerU32[1] || IDENTIFIER[2] !== headerU32[2]) {
            // #ifdef DEBUG
            console.warn("Invalid definition header found in KTX file. Expected 0xAB4B5458, 0x203131BB, 0x0D0A1A0A");
            // #endif
            return null;
        }

        var header = {
            endianness: headerU32[3], // todo: Use this information
            glType: headerU32[4],
            glTypeSize: headerU32[5],
            glFormat: headerU32[6],
            glInternalFormat: headerU32[7],
            glBaseInternalFormat: headerU32[8],
            pixelWidth: headerU32[9],
            pixelHeight: headerU32[10],
            pixelDepth: headerU32[11],
            numberOfArrayElements: headerU32[12],
            numberOfFaces: headerU32[13],
            numberOfMipmapLevels: headerU32[14],
            bytesOfKeyValueData: headerU32[15]
        };

        if (header.pixelDepth > 1) {
            // #ifdef DEBUG
            console.warn("More than 1 pixel depth not supported!");
            // #endif
            return null;
        }

        if (header.numberOfArrayElements > 1) {
            // #ifdef DEBUG
            console.warn("Array texture not supported!");
            // #endif
            return null;
        }

        if (header.glFormat !== 0) {
            // #ifdef DEBUG
            console.warn("We only support compressed formats!");
            // #endif
            return null;
        }

        if (!KNOWN_FORMATS[header.glInternalFormat]) {
            // #ifdef DEBUG
            console.warn("Unknown glInternalFormat: " + header.glInternalFormat);
            // #endif
            return null;
        }

        // Byte offset locating the first byte of texture level data
        var offset = (16 * 4) + header.bytesOfKeyValueData;

        var levels = [];
        var isCubeMap = false;
        for (var mipmapLevel = 0; mipmapLevel < (header.numberOfMipmapLevels || 1); mipmapLevel++) {
            var imageSizeInBytes = new Uint32Array(arrayBuffer.slice(offset, offset + 4))[0];
            offset += 4;
            // Currently array textures not supported. Keeping this here for referance.
            // for (var arrayElement = 0; arrayElement < (header.numberOfArrayElements || 1); arrayElement++) {
            var faceSizeInBytes = imageSizeInBytes / (header.numberOfFaces || 1);
            // Create array for cubemaps
            if (header.numberOfFaces > 1) {
                isCubeMap = true;
                levels.push([]);
            }
            for (var face = 0; face < header.numberOfFaces; face++) {
                // Currently more than 1 pixel depth not supported. Keeping this here for referance.
                // for (var  zSlice = 0; zSlice < (header.pixelDepth || 1); zSlice++) {
                var mipData = new Uint8Array(arrayBuffer, offset, faceSizeInBytes);
                // Handle cubemaps
                if (header.numberOfFaces > 1) {
                    levels[mipmapLevel].push(mipData);
                } else {
                    levels.push(mipData);
                }
                offset += faceSizeInBytes;
            // }
            }
            offset += 3 - ((offset + 3) % 4);
            // }
            // offset += 3 - ((offset + 3) % 4);
        }

        this.format = KNOWN_FORMATS[header.glInternalFormat];
        this.width = header.pixelWidth;
        this.height = header.pixelHeight;
        this.levels = levels;
        this.cubemap = isCubeMap;
    };

    return {
        KtxParser: KtxParser
    };
}());
