import { ADDRESS_CLAMP_TO_EDGE, ADDRESS_REPEAT, TEXHINT_ASSET } from '../../../platform/graphics/constants.js';
import { Texture } from '../../../platform/graphics/texture.js';
import { Http } from '../../../platform/net/http.js';

import { basisTranscode } from '../../handlers/basis.js';

import { TextureParser } from './texture.js';

/**
 * Parser for basis files.
 */
class BasisParser extends TextureParser {
    constructor(device) {
        super();
        this.device = device;
    }

    canParse(context) {
        return context.ext === 'basis';
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
                callback(`Basis module not found. Asset [${asset.name}](${asset.getFileUrl()}) basis texture variant will not be loaded.`);
            }
        };

        this.handler.fetch(url, Http.ResponseType.ARRAY_BUFFER, (err, result) => {
            if (err) {
                callback(err);
            } else {
                transcode(result);
            }
        }, asset);
    }

    // our async transcode call provides the neat structure we need to create the texture instance
    open(url, data, device, textureOptions = {}) {
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
            levels: data.levels,

            // derive mipmaps from the actual level count, so a single-level file isn't treated as an
            // incomplete mip chain (which renders black); matches the dds parser
            mipmaps: data.levels.length > 1,

            ...textureOptions
        });
        texture.upload();

        return texture;
    }
}

export { BasisParser };
