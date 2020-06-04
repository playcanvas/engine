Object.assign(pc, function () {

    /**
     * @class
     * @name pc.ImgParser
     * @implements {pc.TextureParser}
     * @classdesc Parser for browser-supported image formats.
     */
    var ImgParser = function (registry, retryRequests) {
        // by default don't try cross-origin, because some browsers send different cookies (e.g. safari) if this is set.
        this.crossOrigin = registry.prefix ? 'anonymous' : undefined;
        this.retryRequests = !!retryRequests;
    };

    Object.assign(ImgParser.prototype, {
        load: function (url, callback, asset) {
            var crossOrigin;

            // only apply cross-origin setting if this is an absolute URL, relative URLs can never be cross-origin
            if (this.crossOrigin !== undefined && pc.ABSOLUTE_URL.test(url.load)) {
                crossOrigin = self.crossOrigin;
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
                    console.log(pc.string.format("Error loading Texture from: '{0}' - Retrying in {1}ms...", originalUrl, retryDelay));

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
                    callback(pc.string.format("Error loading Texture from: '{0}'", originalUrl));
                }
            };

            image.src = url;
        }
    });

    return {
        ImgParser: ImgParser
    };
}());
