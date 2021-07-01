import { http } from '../../../net/http.js';

import { ADDRESS_CLAMP_TO_EDGE, ADDRESS_REPEAT, TEXHINT_ASSET } from '../../../graphics/constants.js';
import { Texture } from '../../../graphics/texture.js';

import { basisTranscode } from '../../basis.js';

/**
 * @private
 * @class
 * @name BasisParser
 * @implements {TextureParser}
 * @classdesc Parser for basis files.
 */
class BasisParser {
    constructor(registry, device) {
        this.device = device;
        this.maxRetries = 0;
    }

    load(url, callback, asset) {
        const device = this.device;
        const options = {
            cache: true,
            responseType: "arraybuffer",
            retry: this.maxRetries > 0,
            maxRetries: this.maxRetries
        };
        http.get(
            url.load,
            options,
            function (err, result) {
                if (err) {
                    callback(err, result);
                } else {
                    const basisModuleFound = basisTranscode(
                        device,
                        url.load,
                        result,
                        callback,
                        { isGGGR: (asset?.file?.variants?.basis?.opt & 8) !== 0 }
                    );

                    if (!basisModuleFound) {
                        callback('Basis module not found. Asset "' + asset.name + '" basis texture variant will not be loaded.');
                    }
                }
            }
        );
    }

    // our async transcode call provides the neat structure we need to create the texture instance
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
}

export { BasisParser };
