import { path } from '../core/path.js';

import { http } from '../net/http.js';

import { Sprite } from '../scene/sprite.js';

// The scope of this function is the sprite asset
function onTextureAtlasLoaded(atlasAsset) {
    var spriteAsset = this;
    if (spriteAsset.resource) {
        spriteAsset.resource.atlas = atlasAsset.resource;
    }
}

// The scope of this function is the sprite asset
function onTextureAtlasAdded(atlasAsset) {
    var spriteAsset = this;
    spriteAsset.registry.load(atlasAsset);
}

/**
 * @class
 * @name SpriteHandler
 * @implements {pc.ResourceHandler}
 * @classdesc Resource handler used for loading {@link Sprite} resources.
 * @param {AssetRegistry} assets - The asset registry.
 * @param {GraphicsDevice} device - The graphics device.
 */
class SpriteHandler {
    constructor(assets, device) {
        this._assets = assets;
        this._device = device;
        this.maxRetries = 0;
    }

    load(url, callback) {
        if (typeof url === 'string') {
            url = {
                load: url,
                original: url
            };
        }

        // if given a json file (probably engine-only use case)
        if (path.getExtension(url.original) === '.json') {
            http.get(url.load, {
                retry: this.maxRetries > 0,
                maxRetries: this.maxRetries
            }, function (err, response) {
                if (!err) {
                    callback(null, response);
                } else {
                    callback(err);
                }
            });
        }
    }

    // Create sprite resource
    open(url, data) {
        var sprite = new Sprite(this._device);
        if (url) {
            // if url field is present json data is being loaded from file
            // store data on sprite object temporarily
            sprite.__data = data;
        }

        return sprite;
    }

    // Set sprite data
    patch(asset, assets) {
        var sprite = asset.resource;
        if (sprite.__data) {
            // loading from a json file we have asset data store temporarily on the sprite resource
            // copy it into asset.data and delete

            asset.data.pixelsPerUnit = sprite.__data.pixelsPerUnit;
            asset.data.renderMode = sprite.__data.renderMode;
            asset.data.frameKeys = sprite.__data.frameKeys;

            if (sprite.__data.textureAtlasAsset) {
                var atlas = assets.getByUrl(sprite.__data.textureAtlasAsset);
                if (atlas) {
                    asset.data.textureAtlasAsset = atlas.id;
                } else {
                    console.warn("Could not find textureatlas with url: " + sprite.__data.textureAtlasAsset);
                }
            }

            // note: we don't remove sprite.__data in case another asset is loaded from the same URL when it is fetched from the cache
            // the __data is not re-assigned and so asset.data is not set up.
        }

        sprite.startUpdate();
        sprite.renderMode = asset.data.renderMode;
        sprite.pixelsPerUnit = asset.data.pixelsPerUnit;
        sprite.frameKeys = asset.data.frameKeys;
        this._updateAtlas(asset);
        sprite.endUpdate();

        asset.off('change', this._onAssetChange, this);
        asset.on('change', this._onAssetChange, this);
    }

    // Load atlas
    _updateAtlas(asset) {
        var sprite = asset.resource;
        if (!asset.data.textureAtlasAsset) {
            sprite.atlas = null;
            return;
        }

        this._assets.off('load:' + asset.data.textureAtlasAsset, onTextureAtlasLoaded, asset);
        this._assets.on('load:' + asset.data.textureAtlasAsset, onTextureAtlasLoaded, asset);

        var atlasAsset = this._assets.get(asset.data.textureAtlasAsset);
        if (atlasAsset && atlasAsset.resource) {
            sprite.atlas = atlasAsset.resource;
        } else {
            if (!atlasAsset) {
                this._assets.off('add:' + asset.data.textureAtlasAsset, onTextureAtlasAdded, asset);
                this._assets.on('add:' + asset.data.textureAtlasAsset, onTextureAtlasAdded, asset);
            } else {
                this._assets.load(atlasAsset);
            }
        }
    }

    _onAssetChange(asset, attribute, value, oldValue) {
        if (attribute === 'data') {
            // if the texture atlas changed, clear events for old atlas asset
            if (value && value.textureAtlasAsset && oldValue && value.textureAtlasAsset !== oldValue.textureAtlasAsset) {
                this._assets.off('load:' + oldValue.textureAtlasAsset, onTextureAtlasLoaded, asset);
                this._assets.off('add:' + oldValue.textureAtlasAsset, onTextureAtlasAdded, asset);
            }
        }
    }
}

export { SpriteHandler };
