import {
    PIXELFORMAT_RGBA8, TEXHINT_ASSET
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
 */
class ImgParser extends TextureParser {
    constructor(registry, device) {
        super();
        // by default don't try cross-origin, because some browsers send different cookies (e.g. safari) if this is set.
        this.crossOrigin = registry.prefix ? 'anonymous' : null;
        this.device = device;

        // run image alpha test
        // #if _DEBUG
        if (Tracing.get('IMG_ALPHA_TEST')) {
            ImgAlphaTest.run(this.device);
        }
        // #endif
    }

    canParse() {
        // the browser can decode any image format, so this parser acts as the catch-all; it is
        // registered first, letting the format-specific parsers take precedence
        return true;
    }

    load(url, callback, asset) {
        const hasContents = !!asset?.file?.contents;

        if (hasContents) {
            // ImageBitmap interface can load image
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
            this._loadImageBitmap(url.load, url.original, crossOrigin, handler, asset);
        } else {
            this._loadImage(url.load, url.original, crossOrigin, handler, asset);
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
            format: PIXELFORMAT_RGBA8,

            ...textureOptions
        });

        texture.setSource(data);
        return texture;
    }

    _loadImage(url, originalUrl, crossOrigin, callback, asset) {
        const image = new Image();
        if (http.withCredentials) {
            // an <img> element cannot use the XHR `withCredentials` flag, so 'use-credentials' is
            // the equivalent way to send credentials with a cross-origin image request
            image.crossOrigin = 'use-credentials';
        } else if (crossOrigin) {
            image.crossOrigin = crossOrigin;
        }

        let retries = 0;
        const maxRetries = this.handler.maxRetries;
        let retryTimeout;

        const dummySize = 1024 * 1024;

        // HTMLImageElement doesn't support progress events, so we emulate it instead
        asset?.fire('progress', 0, dummySize);

        // Call success callback after opening Texture
        image.onload = function () {
            asset?.fire('progress', dummySize, dummySize);
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

                retryTimeout = setTimeout(() => {
                    // we need to add a cache busting argument if we are trying to re-load an image element
                    // with the same URL
                    image.src = `${url + separator}retry=${Date.now()}`;
                    retryTimeout = null;
                }, retryDelay);
            } else {
                // Call error callback with details.
                callback(`Error loading Texture from: '${originalUrl}'`);
            }
        };

        image.src = url;
    }

    _loadImageBitmap(url, originalUrl, crossOrigin, callback, asset) {
        const options = {
            cache: true,
            responseType: 'blob',
            retry: this.handler.maxRetries > 0,
            maxRetries: this.handler.maxRetries,
            progress: asset
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
