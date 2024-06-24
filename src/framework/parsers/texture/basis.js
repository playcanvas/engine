import { ADDRESS_CLAMP_TO_EDGE, ADDRESS_REPEAT, TEXHINT_ASSET, pixelFormatLinearToGamma } from '../../../platform/graphics/constants.js';
import { Texture } from '../../../platform/graphics/texture.js';

import { Asset } from '../../asset/asset.js';
import { basisTranscode } from '../../handlers/basis.js';

import { TextureParser } from './texture.js';

/**
 * Parser for basis files.
 *
 * @ignore
 */
class BasisParser extends TextureParser {
    constructor(registry, device) {
        super();
        this.device = device;
        this.maxRetries = 0;
    }

    load(url, callback, asset) {
        const device = this.device;

        const transcode = (data) => {
            const basisModuleFound = basisTranscode(
                device,
                url.load,
                data,
                callback,
                { isGGGR: (asset?.file?.variants?.basis?.opt & 8) !== 0 }
            );

            if (!basisModuleFound) {
                callback(`Basis module not found. Asset '${asset.name}' basis texture variant will not be loaded.`);
            }
        };

        Asset.fetchArrayBuffer(url.load, (err, result) => {
            if (err) {
                callback(err);
            } else {
                transcode(result);
            }
        }, asset, this.maxRetries);
    }

    // our async transcode call provides the neat structure we need to create the texture instance
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
}

export { BasisParser };
