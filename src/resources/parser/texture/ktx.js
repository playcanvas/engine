import { http } from '../../../net/http.js';

import {
    ADDRESS_CLAMP_TO_EDGE, ADDRESS_REPEAT,
    PIXELFORMAT_DXT1, PIXELFORMAT_DXT3, PIXELFORMAT_DXT5,
    PIXELFORMAT_ETC1, PIXELFORMAT_ETC2_RGB, PIXELFORMAT_ETC2_RGBA,
    PIXELFORMAT_PVRTC_4BPP_RGB_1, PIXELFORMAT_PVRTC_2BPP_RGB_1, PIXELFORMAT_PVRTC_4BPP_RGBA_1, PIXELFORMAT_PVRTC_2BPP_RGBA_1,
    TEXHINT_ASSET
} from '../../../graphics/graphics.js';
import { Texture } from '../../../graphics/texture.js';

// Defined here: https://www.khronos.org/opengles/sdk/tools/KTX/file_format_spec/
var IDENTIFIER = [0x58544BAB, 0xBB313120, 0x0A1A0A0D]; // «KTX 11»\r\n\x1A\n
var KNOWN_FORMATS = {
    0x83F0: PIXELFORMAT_DXT1,
    0x83F2: PIXELFORMAT_DXT3,
    0x83F3: PIXELFORMAT_DXT5,
    0x8D64: PIXELFORMAT_ETC1,
    0x9274: PIXELFORMAT_ETC2_RGB,
    0x9278: PIXELFORMAT_ETC2_RGBA,
    0x8C00: PIXELFORMAT_PVRTC_4BPP_RGB_1,
    0x8C01: PIXELFORMAT_PVRTC_2BPP_RGB_1,
    0x8C02: PIXELFORMAT_PVRTC_4BPP_RGBA_1,
    0x8C03: PIXELFORMAT_PVRTC_2BPP_RGBA_1
};

/**
 * @class
 * @name pc.KtxParser
 * @implements {pc.TextureParser}
 * @classdesc Texture parser for ktx files.
 */
function KtxParser(registry, retryRequests) {
    this.retryRequests = !!retryRequests;
}

Object.assign(KtxParser.prototype, {

    load: function (url, callback, asset) {
        var options = {
            cache: true,
            responseType: "arraybuffer",
            retry: this.retryRequests
        };
        http.get(url.load, options, callback);
    },

    open: function (url, data, device) {
        var textureData = this.parse(data);

        if (!textureData) {
            return null;
        }

        var texture = new Texture(device, {
            name: url,
            // #ifdef PROFILER
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
    },

    parse: function (data) {
        var headerU32 = new Uint32Array(data, 0, 16);

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
            var imageSizeInBytes = new Uint32Array(data.slice(offset, offset + 4))[0];
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
                var mipData = new Uint8Array(data, offset, faceSizeInBytes);
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

        return {
            format: KNOWN_FORMATS[header.glInternalFormat],
            width: header.pixelWidth,
            height: header.pixelHeight,
            levels: levels,
            cubemap: isCubeMap
        };
    }
});

export { KtxParser };
