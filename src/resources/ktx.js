Object.assign(pc, function () {
    var IDENTIFIER = [0x58544BAB, 0xBB313120, 0x0A1A0A0D]; // «KTX 11»\r\n\x1A\n
    var KNOWN_FORMATS = {
        0x83F3 : {format: pc.PIXELFORMAT_DXT5, numberOfBytes: 4}
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
            endianness: headerU32[3],
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
            bytesOfKeyValueData: headerU32[15],
        };

        // Byte offset locating the first byte of texture level data
        var offset = (16 * 4) + header.bytesOfKeyValueData;

        var levels = [];
        var numberOfBytes = KNOWN_FORMATS[header.glInternalFormat] ? KNOWN_FORMATS[header.glInternalFormat].numberOfBytes : 4;
        for (var mipmapLevel = 0; mipmapLevel < (header.numberOfMipmapLevels || 1); mipmapLevel++) {
            var imageSize = new Uint32Array(arrayBuffer.slice(offset, offset + 4))[0];
            offset += 4;
            for (var arrayElement = 0; arrayElement < (header.numberOfArrayElements || 1); arrayElement++) {
                for (var face = 0; face < header.numberOfFaces; face++) {
                    for (var  zSlice = 0; zSlice < (header.pixelDepth || 1); zSlice++) {
                        var mipData = new Uint8Array(arrayBuffer, offset, imageSize);
                        // todo merih.taze: What if multiple faces. Do we put an array or what?
                        levels.push(mipData);
                        offset += imageSize;
                    }
                }
                offset += 3 - ((offset + 3) % 4);
            }
            offset += 3 - ((offset + 3) % 4);
        }

        this.format = KNOWN_FORMATS[header.glInternalFormat] ? KNOWN_FORMATS[header.glInternalFormat].format : pc.PIXELFORMAT_R8_G8_B8_A8,
        this.width = header.pixelWidth,
        this.height = header.pixelHeight,
        this.levels = levels;
	};

    return {
        KtxParser: KtxParser
    };
}());
