pc.extend(pc, function () {
    'use strict';

    var FontHandler = function (loader) {
        this._loader = loader;
    };

    FontHandler.prototype = {
        load: function (url, callback, asset) {
            var self = this;
            if (pc.path.getExtension(url) === '.json') {
                // load json data then load texture of same name
                pc.http.get(url, function (err, response) {
                    if (!err) {
                        self._loadTextures(url.replace('.json', '.png'), response, function (err, textures) {
                            if (err) return callback(err);

                            callback(null, {
                                data: response,
                                textures: textures
                            });
                        });
                    } else {
                        callback(pc.string.format("Error loading font resource: {0} [{1}]", url, err));
                    }
                });

            } else {
                this._loadTextures(url, asset && asset.data, callback);
            }
        },

        _loadTextures: function (url, data, callback) {
            var numTextures = 1;
            var numLoaded = 0;
            var error = null;

            if (data && data.version >= 2) {
                numTextures = data.info.maps.length;
            }

            var textures = new Array(numTextures);
            var loader = this._loader;

            var loadTexture = function (index) {
                var onLoaded = function (err, texture) {
                    if (error) return;

                    if (err) {
                        error = err;
                        return callback(err);
                    }

                    texture.upload();
                    textures[index] = texture;
                    numLoaded++;
                    if (numLoaded === numTextures) {
                        callback(null, textures);
                    }
                };

                if (index === 0) {
                    loader.load(url, "texture", onLoaded);
                } else {
                    loader.load(url.replace('.png', index + '.png'), "texture", onLoaded);
                }
            };

            for (var i = 0; i < numTextures; i++)
                loadTexture(i);
        },

        open: function (url, data, asset) {
            var font;
            if (data.textures) {
                // both data and textures exist
                font = new pc.Font(data.textures, data.data);
            } else {
                // only textures
                font = new pc.Font(data, null);
            }
            return font;
        },

        patch: function (asset, assets) {
            // if not already set, get font data block from asset
            // and assign to font resource
            var font = asset.resource;
            if (!font.data && asset.data) {
                // font data present in asset but not in font
                font.data = asset.data;
            } else if (!asset.data && font.data) {
                // font data present in font but not in asset
                asset.data = font.data;
            }
        }
    };

    return {
        FontHandler: FontHandler,
    };
}());
