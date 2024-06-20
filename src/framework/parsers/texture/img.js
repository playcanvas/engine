import {
    PIXELFORMAT_RGBA8, PIXELFORMAT_SRGBA8, TEXHINT_ASSET
} from '../../../platform/graphics/constants.js';
import { Texture } from '../../../platform/graphics/texture.js';
import { http } from '../../../platform/net/http.js';

import { ABSOLUTE_URL } from '../../asset/constants.js';
// #if _DEBUG
import { ImgAlphaTest } from './img-alpha-test.js';
import { Tracing } from '../../../core/tracing.js';
// #endif

import { TextureParser } from './texture.js';

/**
 * Parser for browser-supported image formats.
 *
 * @ignore
 */
class ImgParser extends TextureParser {
    constructor(registry, device) {
        super();
        // by default don't try cross-origin, because some browsers send different cookies (e.g. safari) if this is set.
        this.crossOrigin = registry.prefix ? 'anonymous' : null;
        this.maxRetries = 0;
        this.device = device;

        // run image alpha test
        // #if _DEBUG
        if (Tracing.get('IMG_ALPHA_TEST')) {
            ImgAlphaTest.run(this.device);
        }
        // #endif
    }

    load(url, callback, asset) {
        const hasContents = !!asset?.file?.contents;

        if (hasContents) {
            // ImageBitmap interface can load iage
            if (this.device.supportsImageBitmap) {
                this._loadImageBitmapFromBlob(new Blob([asset.file.contents]), callback);
                return;
            }
            url = {
                load: URL.createObjectURL(new Blob([asset.file.contents])),
                original: url.original
            };
        }

        const handler = (err, result) => {
            if (hasContents) {
                URL.revokeObjectURL(url.load);
            }
            callback(err, result);
        };

        let crossOrigin;
        if (asset && asset.options && asset.options.hasOwnProperty('crossOrigin')) {
            crossOrigin = asset.options.crossOrigin;
        } else if (ABSOLUTE_URL.test(url.load)) {
            crossOrigin = this.crossOrigin;
        }

        if (this.device.supportsImageBitmap) {
            this._loadImageBitmap(url.load, url.original, crossOrigin, handler);
        } else {
            this._loadImage(url.load, url.original, crossOrigin, handler);
        }
    }

    open(url, data, device, textureOptions = {}) {
        const texture = new Texture(device, {
            name: url,
            // #if _PROFILER
            profilerHint: TEXHINT_ASSET,
            // #endif
            width: data.width,
            height: data.height,
            format: textureOptions.srgb ? PIXELFORMAT_SRGBA8 : PIXELFORMAT_RGBA8,

            ...textureOptions
        });

        texture.setSource(data);
        return texture;
    }

    _loadImage(url, originalUrl, crossOrigin, callback) {
        const image = new Image();
        if (crossOrigin) {
            image.crossOrigin = crossOrigin;
        }

        let retries = 0;
        const maxRetries = this.maxRetries;
        let retryTimeout;

        // Call success callback after opening Texture
        image.onload = function () {
            callback(null, image);
        };

        image.onerror = function () {
            // Retry a few times before failing
            if (retryTimeout) return;

            if (maxRetries > 0 && ++retries <= maxRetries) {
                const retryDelay = Math.pow(2, retries) * 100;
                console.log(`Error loading Texture from: '${originalUrl}' - Retrying in ${retryDelay}ms...`);

                const idx = url.indexOf('?');
                const separator = idx >= 0 ? '&' : '?';

                retryTimeout = setTimeout(function () {
                    // we need to add a cache busting argument if we are trying to re-load an image element
                    // with the same URL
                    image.src = url + separator + 'retry=' + Date.now();
                    retryTimeout = null;
                }, retryDelay);
            } else {
                // Call error callback with details.
                callback(`Error loading Texture from: '${originalUrl}'`);
            }
        };

        image.src = url;
    }

    _loadImageBitmap(url, originalUrl, crossOrigin, callback) {
        const options = {
            cache: true,
            responseType: 'blob',
            retry: this.maxRetries > 0,
            maxRetries: this.maxRetries
        };
        http.get(url, options, (err, blob) => {
            if (err) {
                callback(err);
            } else {
                this._loadImageBitmapFromBlob(blob, callback);
            }
        });
    }

    _loadImageBitmapFromBlob(blob, callback) {
        createImageBitmap(blob, {
            premultiplyAlpha: 'none',
            colorSpaceConversion: 'none'
        })
            .then(imageBitmap => callback(null, imageBitmap))
            .catch(e => callback(e));
    }
}

export { ImgParser };
