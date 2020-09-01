Object.assign(pc, function () {
    'use strict';

    function upgradeDataSchema(data) {
        // convert v1 and v2 to v3 font data schema
        if (data.version < 3 || data.version == 4) { // seems upgraded schema is never saved out?
            if (data.version < 2) {
                data.info.maps = data.info.maps || [{
                    width: data.info.width,
                    height: data.info.height
                }];
            }
            data.chars = Object.keys(data.chars || {}).reduce(function (newChars, key) {
                var existing = data.chars[key];
                // key by letter instead of char code
                var newKey = existing.letter !== undefined ? existing.letter : pc.string.fromCodePoint(key);
                if (data.version < 2) {
                    existing.map = existing.map || 0;
                }
                newChars[newKey] = existing;
                return newChars;
            }, {});
            data.version = Math.max(data.version + 1, 3);
        }
        return data;
    }

    /**
     * @class
     * @name pc.FontHandler
     * @implements {pc.ResourceHandler}
     * @classdesc Resource handler used for loading {@link pc.Font} resources.
     * @param {pc.ResourceLoader} loader - The resource loader.
     */
    var FontHandler = function (loader) {
        this._loader = loader;
        this.retryRequests = false;
    };

    Object.assign(FontHandler.prototype, {
        load: function (url, callback, asset) {
            if (typeof url === 'string') {
                url = {
                    load: url,
                    original: url
                };
            }

            var self = this;
            if (pc.path.getExtension(url.original) === '.json') {
                // load json data then load texture of same name
                pc.http.get(url.load, {
                    retry: this.retryRequests
                }, function (err, response) {
                    // update asset data
                    var data = upgradeDataSchema(response);
                    if (!err) {
                        self._loadTextures(url.original.replace('.json', '.png'), data, function (err, textures) {
                            if (err) return callback(err);

                            callback(null, {
                                data: data,
                                textures: textures
                            });
                        });
                    } else {
                        callback(pc.string.format("Error loading font resource: {0} [{1}]", url.original, err));
                    }
                });

            } else {
                // upgrade asset data
                if (asset && asset.data) {
                    asset.data = upgradeDataSchema(asset.data);
                }
                this._loadTextures(url.original, asset && asset.data, callback);
            }
        },

        _loadTextures: function (url, data, callback) {
            var numTextures = data.info.maps.length;
            var numLoaded = 0;

            var error = null;

            var textures = new Array(numTextures);
            var loader = this._loader;

            var textures2 = null;

            var numLoaded2 = 0;

            var loadTexture = function (index) {
                if (data.version >= 4) {
                    textures2 = new Array(numTextures);

                    var onLoaded2 = function (err, texture) {
                        if (error) return;

                        if (err) {
                            error = err;
                            return callback(err);
                        }

                        texture.upload();
                        textures2[index] = texture;
                        numLoaded2++;
                        if (numLoaded === numTextures && numLoaded2 === numTextures) {
                            callback(null, [textures, textures2]);
                        }
                    };

                    if (index === 0) {
                        loader.load(url.replace('.png', 'A.png'), "texture", onLoaded2);
                    } else {
                        loader.load(url.replace('.png', index + 'A.png'), "texture", onLoaded2);
                    }
                }

                var onLoaded = function (err, texture) {
                    if (error) return;

                    if (err) {
                        error = err;
                        return callback(err);
                    }

                    texture.upload();
                    textures[index] = texture;
                    numLoaded++;
                    if (numLoaded === numTextures && (textures2 === null || numLoaded2 === numTextures)) {
                        callback(null, [textures, textures2]);
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

            if (asset.data) {
                asset.data = upgradeDataSchema(asset.data);
            }
        }
    });

    return {
        FontHandler: FontHandler
    };
}());
