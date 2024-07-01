import { Debug } from '../../../core/debug.js';
import { ReadStream } from '../../../core/read-stream.js';

import { ADDRESS_CLAMP_TO_EDGE, ADDRESS_REPEAT, TEXHINT_ASSET, pixelFormatLinearToGamma } from '../../../platform/graphics/constants.js';
import { Texture } from '../../../platform/graphics/texture.js';

import { Asset } from '../../asset/asset.js';
import { basisTranscode } from '../../handlers/basis.js';

import { TextureParser } from './texture.js';

const KHRConstants = {
    KHR_DF_MODEL_ETC1S: 163,
    KHR_DF_MODEL_UASTC: 166
};

/**
 * Texture parser for ktx2 files.
 *
 * @ignore
 */
class Ktx2Parser extends TextureParser {
    constructor(registry, device) {
        super();
        this.maxRetries = 0;
        this.device = device;
    }

    load(url, callback, asset) {
        Asset.fetchArrayBuffer(url.load, (err, result) => {
            if (err) {
                callback(err, result);
            } else {
                this.parse(result, url, callback, asset);
            }
        }, asset, this.maxRetries);
    }

    open(url, data, device, textureOptions = {}) {
        const format = textureOptions.srgb ? pixelFormatLinearToGamma(data.format) : data.format;
        const texture = new Texture(device, {
            name: url,
            // #if _PROFILER
            profilerHint: TEXHINT_ASSET,
            // #endif
            addressU: data.cubemap ? ADDRESS_CLAMP_TO_EDGE : ADDRESS_REPEAT,
            addressV: data.cubemap ? ADDRESS_CLAMP_TO_EDGE : ADDRESS_REPEAT,
            width: data.width,
            height: data.height,
            format: format,
            cubemap: data.cubemap,
            levels: data.levels,

            ...textureOptions
        });

        texture.upload();

        return texture;
    }

    parse(arraybuffer, url, callback, asset) {
        const rs = new ReadStream(arraybuffer);

        // check magic header bits:  '«', 'K', 'T', 'X', ' ', '2', '0', '»', '\r', '\n', '\x1A', '\n'\
        const magic = [rs.readU32be(), rs.readU32be(), rs.readU32be()];
        if (magic[0] !== 0xAB4B5458 || magic[1] !== 0x203230BB || magic[2] !== 0x0D0A1A0A) {
            Debug.warn('Invalid definition header found in KTX2 file. Expected 0xAB4B5458, 0x203131BB, 0x0D0A1A0A');
            return null;
        }

        // unpack header
        const header = {
            vkFormat: rs.readU32(),
            typeSize: rs.readU32(),
            pixelWidth: rs.readU32(),
            pixelHeight: rs.readU32(),
            pixelDepth: rs.readU32(),
            layerCount: rs.readU32(),
            faceCount: rs.readU32(),
            levelCount: rs.readU32(),
            supercompressionScheme: rs.readU32()
        };

        // unpack index
        const index = {
            dfdByteOffset: rs.readU32(),
            dfdByteLength: rs.readU32(),
            kvdByteOffset: rs.readU32(),
            kvdByteLength: rs.readU32(),
            sgdByteOffset: rs.readU64(),
            sgdByteLength: rs.readU64()
        };

        // unpack levels
        const levels = [];
        for (let i = 0; i < Math.max(1, header.levelCount); ++i) {
            levels.push({
                byteOffset: rs.readU64(),
                byteLength: rs.readU64(),
                uncompressedByteLength: rs.readU64()
            });
        }

        // unpack data format descriptor
        const dfdTotalSize = rs.readU32();
        if (dfdTotalSize !== index.kvdByteOffset - index.dfdByteOffset) {
            Debug.warn('Invalid file data encountered.');
            return null;
        }

        rs.skip(8);
        const colorModel = rs.readU8();
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
            callback('unsupported KTX2 pixel format');
        }
    }
}

export {
    Ktx2Parser
};
