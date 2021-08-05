import { http } from '../../../net/http.js';
import { basisTranscode } from '../../basis.js';
import { Texture } from '../../../graphics/texture.js';
import { ADDRESS_CLAMP_TO_EDGE, ADDRESS_REPEAT, TEXHINT_ASSET } from '../../../graphics/constants.js';

// helper class for organized reading of memory
class ReadStream {
    constructor(arraybuffer) {
        this.arraybuffer = arraybuffer;
        this.dataView = new DataView(arraybuffer);
        this.offset = 0;
        this.stack = [];
    }

    reset(offset = 0) {
        this.offset = offset;
    }

    skip(bytes) {
        this.offset += bytes;
    }

    align(bytes) {
        this.offset = (this.offset + bytes - 1) & (~(bytes - 1));
    }

    inc(amount) {
        this.offset += amount;
        return this.offset - amount;
    }

    get u8() {
        return this.dataView.getUint8(this.inc(1));
    }

    get u16() {
        return this.dataView.getUint16(this.inc(2), true);
    }

    get u32() {
        return this.dataView.getUint32(this.inc(4), true);
    }

    get u64() {
        return this.dataView.getBigUint64(this.inc(8), true);
    }

    // big-endian helper
    get bu32() {
        return this.dataView.getUint32(this.inc(4), false);
    }

    buffer(length) {
        return new Uint8Array(this.arraybuffer, this.inc(length), length);
    }
}

const KHRConstants = {
    KHR_DF_MODEL_ETC1S: 163,
    KHR_DF_MODEL_UASTC: 166
};

/**
 * @private
 * @class
 * @name Ktx2Parser
 * @implements {TextureParser}
 * @classdesc Texture parser for ktx2 files.
 */
class Ktx2Parser {
    constructor(registry, device) {
        this.maxRetries = 0;
        this.device = device;
    }

    load(url, callback, asset) {
        const options = {
            cache: true,
            responseType: "arraybuffer",
            retry: this.maxRetries > 0,
            maxRetries: this.maxRetries
        };
        http.get(
            url.load,
            options,
            (err, result) => {
                if (err) {
                    callback(err, result);
                } else {
                    this.parse(result, url, callback, asset);
                }
            }
        );
    }

    open(url, data, device) {
        const texture = new Texture(device, {
            name: url,
            // #if _PROFILER
            profilerHint: TEXHINT_ASSET,
            // #endif
            addressU: data.cubemap ? ADDRESS_CLAMP_TO_EDGE : ADDRESS_REPEAT,
            addressV: data.cubemap ? ADDRESS_CLAMP_TO_EDGE : ADDRESS_REPEAT,
            width: data.width,
            height: data.height,
            format: data.format,
            cubemap: data.cubemap,
            levels: data.levels
        });

        texture.upload();

        return texture;
    }

    parse(arraybuffer, url, callback, asset) {
        const rs = new ReadStream(arraybuffer);

        // check magic header bits:  '«', 'K', 'T', 'X', ' ', '2', '0', '»', '\r', '\n', '\x1A', '\n'\
        const magic = [rs.bu32, rs.bu32, rs.bu32];
        if (magic[0] !== 0xAB4B5458 || magic[1] !== 0x203230BB || magic[2] !== 0x0D0A1A0A) {
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
        const levels = [];
        for (let i = 0; i < Math.max(1, header.levelCount); ++i) {
            levels.push({
                byteOffset: rs.u64,
                byteLength: rs.u64,
                uncompressedByteLength: rs.u64
            });
        }

        // unpack data format descriptor
        const dfdTotalSize = rs.u32;
        if (dfdTotalSize !== index.kvdByteOffset - index.dfdByteOffset) {
            // #if _DEBUG
            console.warn("Invalid file data encountered.");
            // #endif
            return null;
        }

        rs.skip(8);
        const colorModel = rs.u8;
        rs.skip(index.dfdByteLength - 9);

        // skip key/value pairs
        rs.skip(index.kvdByteLength);

        if (header.supercompressionScheme === 1 || colorModel === KHRConstants.KHR_DF_MODEL_UASTC) {
            // assume for now all super compressed images are basis
            const basisModuleFound = basisTranscode(
                this.device,
                url.load,
                arraybuffer,
                callback,
                {
                    isGGGR: (asset?.file?.variants?.basis?.opt & 8) !== 0,
                    isKTX2: true
                }
            );

            if (!basisModuleFound) {
                callback('Basis module not found. Asset "' + asset.name + '" basis texture variant will not be loaded.');
            }
        } else {
            // TODO: load non-supercompressed formats
            callback('unsupported KTX2 pixel formt');
        }
    }
}

export {
    Ktx2Parser
};
