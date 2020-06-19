Object.assign(pc, function () {

    /**
     * @class
     * @name pc.ImgParser
     * @implements {pc.TextureParser}
     * @classdesc Parser for browser-supported image formats.
     */
    var ImgParser = function (registry, retryRequests) {
        // by default don't try cross-origin, because some browsers send different cookies (e.g. safari) if this is set.
        this.crossOrigin = registry.prefix ? 'anonymous' : null;
        this.retryRequests = !!retryRequests;
    };

    Object.assign(ImgParser.prototype, {
        load: function (url, callback, asset) {
            var crossOrigin;
            if (asset && asset.options && asset.options.hasOwnProperty('crossOrigin')) {
                crossOrigin = asset.options.crossOrigin;
            } else if (pc.ABSOLUTE_URL.test(url.load)) {
                crossOrigin = this.crossOrigin;
            }
            this._loadImage(url.load, url.original, crossOrigin, callback);
        },

        open: function (url, data, device) {
            var ext = pc.path.getExtension(url).toLowerCase();
            var format = (ext === ".jpg" || ext === ".jpeg") ? pc.PIXELFORMAT_R8_G8_B8 : pc.PIXELFORMAT_R8_G8_B8_A8;
            var texture = new pc.Texture(device, {
                name: url,
                // #ifdef PROFILER
                profilerHint: pc.TEXHINT_ASSET,
                // #endif
                width: data.width,
                height: data.height,
                format: format
            });
            texture.setSource(data);
            return texture;
        },

        _loadImage: function (url, originalUrl, crossOrigin, callback) {
            var image = new Image();
            if (crossOrigin) {
                image.crossOrigin = crossOrigin;
            }

            var retries = 0;
            var maxRetries = 5;
            var retryTimeout;
            var retryRequests = this.retryRequests;

            // Call success callback after opening Texture
            image.onload = function () {
                callback(null, image);
            };

            image.onerror = function () {
                // Retry a few times before failing
                if (retryTimeout) return;

                if (retryRequests && ++retries <= maxRetries) {
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
    });

    return {
        ImgParser: ImgParser
    };
}());
