import { path } from '../../../core/path.js';
import { http } from '../../../net/http.js';

import { PIXELFORMAT_R8_G8_B8, PIXELFORMAT_R8_G8_B8_A8, TEXHINT_ASSET } from '../../../graphics/constants.js';
import { Texture } from '../../../graphics/texture.js';

import { ABSOLUTE_URL } from '../../../asset/constants.js';

/**
 * @class
 * @name ImgParser
 * @implements {TextureParser}
 * @classdesc Parser for browser-supported image formats.
 */
class ImgParser {
    constructor(registry) {
        // by default don't try cross-origin, because some browsers send different cookies (e.g. safari) if this is set.
        this.crossOrigin = registry.prefix ? 'anonymous' : null;
        this.maxRetries = 0;
        // disable ImageBitmap
        this.useImageBitmap = false && typeof ImageBitmap !== 'undefined' && /Firefox/.test( navigator.userAgent ) === false;
    }

    load(url, callback, asset) {
        var crossOrigin;
        if (asset && asset.options && asset.options.hasOwnProperty('crossOrigin')) {
            crossOrigin = asset.options.crossOrigin;
        } else if (ABSOLUTE_URL.test(url.load)) {
            crossOrigin = this.crossOrigin;
        }
        if (this.useImageBitmap) {
            this._loadImageBitmap(url.load, url.original, crossOrigin, callback);
        } else {
            this._loadImage(url.load, url.original, crossOrigin, callback);
        }
    }

    open(url, data, device) {
        var ext = path.getExtension(url).toLowerCase();
        var format = (ext === ".jpg" || ext === ".jpeg") ? PIXELFORMAT_R8_G8_B8 : PIXELFORMAT_R8_G8_B8_A8;
        var texture = new Texture(device, {
            name: url,
            // #ifdef PROFILER
            profilerHint: TEXHINT_ASSET,
            // #endif
            width: data.width,
            height: data.height,
            format: format
        });
        texture.setSource(data);
        return texture;
    }

    _loadImage(url, originalUrl, crossOrigin, callback) {
        var image = new Image();
        if (crossOrigin) {
            image.crossOrigin = crossOrigin;
        }

        var retries = 0;
        var maxRetries = this.maxRetries;
        var retryTimeout;

        // Call success callback after opening Texture
        image.onload = function () {
            callback(null, image);
        };

        image.onerror = function () {
            // Retry a few times before failing
            if (retryTimeout) return;

            if (maxRetries > 0 && ++retries <= maxRetries) {
                var retryDelay = Math.pow(2, retries) * 100;
                console.log("Error loading Texture from: '" + originalUrl + "' - Retrying in " + retryDelay + "ms...");

                var idx = url.indexOf('?');
                var separator = idx >= 0 ? '&' : '?';

                retryTimeout = setTimeout(function () {
                    // we need to add a cache busting argument if we are trying to re-load an image element
                    // with the same URL
                    image.src = url + separator + 'retry=' + Date.now();
                    retryTimeout = null;
                }, retryDelay);
            } else {
                // Call error callback with details.
                callback("Error loading Texture from: '" + originalUrl + "'");
            }
        };

        image.src = url;
    }

    _loadImageBitmap(url, originalUrl, crossOrigin, callback) {
        var options = {
            cache: true,
            responseType: "blob",
            retry: this.maxRetries > 0,
            maxRetries: this.maxRetries
        };
        http.get(url, options, function (err, blob) {
            if (err) {
                callback(err);
            } else {
                createImageBitmap(blob, {
                    premultiplyAlpha: 'none',
                    imageOrientation: 'flipY'
                })
                    .then( function (imageBitmap) {
                        callback(null, imageBitmap);
                    })
                    .catch( function (e) {
                        callback(e);
                    });
            }
        });
    }
}

export { ImgParser };
