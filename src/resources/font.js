import { path } from '../core/path.js';
import { string } from '../core/string.js';

import { http } from '../net/http.js';

import { Font } from '../font/font.js';

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
            const existing = data.chars[key];
            // key by letter instead of char code
            const newKey = existing.letter !== undefined ? existing.letter : string.fromCodePoint(key);
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
 * @name FontHandler
 * @implements {ResourceHandler}
 * @classdesc Resource handler used for loading {@link Font} resources.
 * @param {ResourceLoader} loader - The resource loader.
 */
class FontHandler {
    constructor(loader) {
        this._loader = loader;
        this.maxRetries = 0;
    }

    load(url, callback, asset) {
        if (typeof url === 'string') {
            url = {
                load: url,
                original: url
            };
        }

        const self = this;
        if (path.getExtension(url.original) === '.json') {
            // load json data then load texture of same name
            http.get(url.load, {
                retry: this.maxRetries > 0,
                maxRetries: this.maxRetries
            }, function (err, response) {
                // update asset data
                if (!err) {
                    const data = upgradeDataSchema(response);
                    self._loadTextures(url.load.replace('.json', '.png'), data, function (err, textures) {
                        if (err) return callback(err);

                        callback(null, {
                            data: data,
                            textures: textures
                        });
                    });
                } else {
                    callback(`Error loading font resource: ${url.original} [${err}]`);
                }
            });

        } else {
            // upgrade asset data
            if (asset && asset.data) {
                asset.data = upgradeDataSchema(asset.data);
            }
            this._loadTextures(url.load, asset && asset.data, callback);
        }
    }

    _loadTextures(url, data, callback) {
        const numTextures = data.info.maps.length;
        let numLoaded = 0;
        let error = null;

        const textures = new Array(numTextures);
        const loader = this._loader;

        const loadTexture = function (index) {
            const onLoaded = function (err, texture) {
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

        for (let i = 0; i < numTextures; i++)
            loadTexture(i);
    }

    open(url, data, asset) {
        let font;
        if (data.textures) {
            // both data and textures exist
            font = new Font(data.textures, data.data);
        } else {
            // only textures
            font = new Font(data, null);
        }
        return font;
    }

    patch(asset, assets) {
        // if not already set, get font data block from asset
        // and assign to font resource
        const font = asset.resource;
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
}

export { FontHandler };
