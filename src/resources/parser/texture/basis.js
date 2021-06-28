import { http } from '../../../net/http.js';

import {
    ADDRESS_CLAMP_TO_EDGE,
    ADDRESS_REPEAT, TEXHINT_ASSET,
    PIXELFORMAT_ETC1,
    PIXELFORMAT_ETC2_RGBA,
    PIXELFORMAT_DXT1,
    PIXELFORMAT_DXT5,
    PIXELFORMAT_PVRTC_4BPP_RGB_1,
    PIXELFORMAT_PVRTC_4BPP_RGBA_1,
    PIXELFORMAT_ASTC_4x4,
    PIXELFORMAT_ATC_RGB,
    PIXELFORMAT_ATC_RGBA,
    PIXELFORMAT_R8_G8_B8_A8,
    PIXELFORMAT_R5_G6_B5,
    PIXELFORMAT_R4_G4_B4_A4
} from '../../../graphics/constants.js';
import { Texture } from '../../../graphics/texture.js';

import { basisTranscode } from '../../basis.js';

const appStartTime = performance.now();

console.log('start,download,transcode,url');

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
        const options = {
            cache: true,
            responseType: "arraybuffer",
            retry: this.maxRetries > 0,
            maxRetries: this.maxRetries
        };
        const startTime = performance.now();
        http.get(
            url.load,
            options,
            function (err, result) {
                if (err) {
                    callback(err, result);
                } else {
                    const downloadTime = performance.now();
                    const basisModuleFound = basisTranscode(
                        url.load,
                        result,
                        // callback,
                        (err, result) => {
                            const finishedTime = performance.now();
                            console.log(Math.floor(finishedTime - appStartTime) +
                                        ',' + Math.floor(startTime - appStartTime) +
                                        ',' + Math.floor(downloadTime - startTime) +
                                        ',' + Math.floor(finishedTime - downloadTime) +
                                        ',' + url.load);
                            callback(err, result);
                        },
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

        const mapping = {
            [PIXELFORMAT_ETC1]: 'etc1',
            [PIXELFORMAT_ETC2_RGBA]: 'etc2',
            [PIXELFORMAT_DXT1]: 'dxt1',
            [PIXELFORMAT_DXT5]: 'dxt5',
            [PIXELFORMAT_PVRTC_4BPP_RGB_1]: 'pvrtc',
            [PIXELFORMAT_PVRTC_4BPP_RGBA_1]: 'pvrtc_a',
            [PIXELFORMAT_ASTC_4x4]: 'astc',
            [PIXELFORMAT_ATC_RGB]: 'atc',
            [PIXELFORMAT_ATC_RGBA]: 'atc_a',
            [PIXELFORMAT_R8_G8_B8_A8]: 'rgba8',
            [PIXELFORMAT_R5_G6_B5]: 'rgb565',
            [PIXELFORMAT_R4_G4_B4_A4]: 'rgba4'
        };

        console.log(`${data.width} x ${data.height} x ${data.levels.length} x ${mapping[data.format]}`);

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
