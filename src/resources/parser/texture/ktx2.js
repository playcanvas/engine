import { http } from '../../../net/http.js';

// helper class for organized reading of memory
class ReadStream {
    constructor(arraybuffer) {
        this.arraybuffer = arraybuffer;
        this.dataView = new DataView(arraybuffer);
        this.offset = 0;
        this.tmp = 0;
    }

    reset() {
        this.offset = 0;
    }

    skip(bytes) {
        this.offset += bytes;
    }

    align(bytes) {
        this.offset = (this.offset + bytes - 1) & (~(bytes - 1));
    }

    get u32() {
        const tmp = this.offset;
        this.offset += 4;
        return this.dataView.getUint32(tmp);
    }

    get u64() {
        const tmp = this.offset;
        this.offset += 8;
        return this.dataView.getBigUint64(tmp);
    }

    buffer(length) {
        const tmp = this.offset;
        this.offset += length;
        return new Uint8Array(this.arraybuffer, tmp, length);
    }
}

/**
 * @private
 * @class
 * @name Ktx2Parser
 * @implements {TextureParser}
 * @classdesc Texture parser for ktx2 files.
 */
class Ktx2Parser {
    constructor(registry) {
        this.maxRetries = 0;
    }

    load(url, callback, asset) {
        http.get(url.load, {
            cache: true,
            responseType: "arraybuffer",
            retry: this.maxRetries > 0,
            maxRetries: this.maxRetries
        }, callback);
    }

    open(url, data, device) {
        const textureData = this.parse(data);

        if (!textureData) {
            return null;
        }
    }

    parse(arraybuffer) {
        const rs = new ReadStream(arraybuffer);

        // check magic header bits:  '«', 'K', 'T', 'X', ' ', '2', '0', '»', '\r', '\n', '\x1A', '\n'
        if (rs.u32 !== 0x58544BAB ||
            rs.u32 !== 0xBB303220 ||
            rs.u32 !== 0x0A1A0A0D) {
            // #if _DEBUG
            console.warn("Invalid definition header found in KTX2 file. Expected 0xAB4B5458, 0x203131BB, 0x0D0A1A0A");
            // #endif
            return null;
        }

        // unpack header
        const header = {
            vkFormat: rs.u32,
            typeSize: rs.u32,
            pixelWidth: rs.u32,
            pixelHeight: rs.u32,
            pixelDepth: rs.u32,
            layerCount: rs.u32,
            faceCount: rs.u32,
            levelCount: rs.u32,
            supercompressionScheme: rs.u32
        };

        // unpack index
        const index = {
            dfdByteOffset: rs.u32,
            dfdByteLength: rs.u32,
            kvdByteOffset: rs.u32,
            kvdByteLength: rs.u32,
            sgdByteOffset: rs.u64,
            sgdByteLength: rs.u64
        };

        // unpack levels
        const levels = new Array(Math.max(1, header.levelCount)).map(() => {
            return {
                byteOffset: rs.u64,
                byteLength: rs.u64,
                uncompressedByteLength: rs.u64
            };
        });

        // data format descriptor
        const dfdTotalSize = rs.u32;
        rs.skip(index.dfdByteLength);
        rs.skip(index.kvdByteLength);

        // supercompressed global data
        let superCompressionGlobalData = null;
        if (index.sgdByteLength > 0) {
            rs.align(8);
            rs.skip(index.sgdByteLength);
            superCompressionGlobalData = new Uint8Array(arraybuffer, index.sgdByteOffset, index.sgdByteLength);
        }

        // mip level array
        for (let level = 0; level < Math.max(1, header.levelCount); ++level) {

        }

    }
}

export {
    Ktx2Parser
};
