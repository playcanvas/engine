pc.extend(pc, function () {
    'use strict';

    var FontHandler = function (loader) {
        this._loader = loader;
    };

    FontHandler.prototype = {
        load: function (url, callback) {
            var self = this;
            if (pc.path.getExtension(url) === '.json') {
                // load json data then load texture of same name
                pc.http.get(url, function (err, response) {
                    if (!err) {
                        var textureUrl = url.replace('.json', '.png');

                        self._loader.load(textureUrl, "texture", function (err, texture) {
                            if (err) {
                                callback(err);
                            } else {
                                callback(null, {
                                    data: response,
                                    texture: texture
                                });
                            }
                        });
                    } else {
                        callback(pc.string.format("Error loading css resource: {0} [{1}]", url, err));
                    }
                });

            } else {
                // load texture, get data from asset block
                this._loader.load(url, "texture", function (err, texture) {
                    callback(null, texture);
                });
            }
        },

        open: function (url, data) {
            var font;
            if (data.texture) {
                // both data and texture exists
                font = new pc.Font(data.texture, data.data);
            } else {
                // only texture
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
                asset.data = font.data
            }
        }
    };

    return {
        FontHandler: FontHandler,
    };
}());
