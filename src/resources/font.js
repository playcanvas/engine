import { path } from '../core/path.js';
import { string } from '../core/string.js';

import { http } from '../net/http.js';

import { Font } from '../framework/components/text/font.js';

function upgradeDataSchema(data) {
    // convert v1 and v2 to v3 font data schema
    if (data.version < 3) {
        if (data.version < 2) {
            data.info.maps = data.info.maps || [{
                width: data.info.width,
                height: data.info.height
            }];
        }
        data.chars = Object.keys(data.chars || {}).reduce(function (newChars, key) {
            var existing = data.chars[key];
            // key by letter instead of char code
            var newKey = existing.letter !== undefined ? existing.letter : string.fromCodePoint(key);
            if (data.version < 2) {
                existing.map = existing.map || 0;
            }
            newChars[newKey] = existing;
            return newChars;
        }, {});
        data.version = 3;
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
function FontHandler(loader) {
    this._loader = loader;
    this.retryRequests = false;
}

Object.assign(FontHandler.prototype, {
    load: function (url, callback, asset) {
        if (typeof url === 'string') {
            url = {
                load: url,
                original: url
            };
        }

        var self = this;
        if (path.getExtension(url.original) === '.json') {
            // load json data then load texture of same name
            http.get(url.load, {
                retry: this.retryRequests
            }, function (err, response) {
                // update asset data
                if (!err) {
                    var data = upgradeDataSchema(response);
                    self._loadTextures(url.load.replace('.json', '.png'), data, function (err, textures) {
                        if (err) return callback(err);

                        callback(null, {
                            data: data,
                            textures: textures
                        });
                    });
                } else {
                    callback("Error loading font resource: " + url.original + " [" + err + "]");
                }
            });

        } else {
            // upgrade asset data
            if (asset && asset.data) {
                asset.data = upgradeDataSchema(asset.data);
            }
            this._loadTextures(url.load, asset && asset.data, callback);
        }
    },

    _loadTextures: function (url, data, callback) {
        var numTextures = data.info.maps.length;
        var numLoaded = 0;
        var error = null;

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
            font = new Font(data.textures, data.data);
        } else {
            // only textures
            font = new Font(data, null);
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

export { FontHandler };
