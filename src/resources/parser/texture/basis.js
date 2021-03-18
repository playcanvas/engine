import { http } from '../../../net/http.js';

import { ADDRESS_CLAMP_TO_EDGE, ADDRESS_REPEAT, TEXHINT_ASSET } from '../../../graphics/constants.js';
import { Texture } from '../../../graphics/texture.js';

import { basisTargetFormat, basisTranscode } from '../../basis.js';

/**
 * @private
 * @class
 * @name BasisParser
 * @implements {TextureParser}
 * @classdesc Parser for basis files.
 */
class BasisParser {
    constructor(registry) {
        this.maxRetries = 0;
    }

    load(url, callback, asset) {
        var options = {
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
                    // massive hack for pvr textures (i.e. apple devices)
                    // the quality of GGGR normal maps under PVR compression is still terrible
                    // so here we instruct the basis transcoder to unswizzle the normal map data
                    // and pack to 565
                    var unswizzleGGGR = basisTargetFormat() === 'pvr' &&
                                        asset && asset.file && asset.file.variants &&
                                        asset.file.variants.basis &&
                                        ((asset.file.variants.basis.opt & 8) !== 0);
                    if (unswizzleGGGR) {
                        // remove the swizzled flag from the asset
                        asset.file.variants.basis.opt &= ~8;
                    }
                    var basisModuleFound = basisTranscode(url.load, result, callback, { unswizzleGGGR: unswizzleGGGR });

                    if (!basisModuleFound) {
                        callback('Basis module not found. Asset "' + asset.name + '" basis texture variant will not be loaded.');
                    }
                }
            }
        );
    }

    // our async transcode call provides the neat structure we need to create the texture instance
    open(url, data, device) {
        var texture = new Texture(device, {
            name: url,
            // #ifdef PROFILER
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
