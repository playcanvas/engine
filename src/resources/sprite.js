pc.extend(pc, function () {
    var SpriteHandler = function (assets, device) {
        this._assets = assets;
        this._device = device;
    };

    // The scope of this function is the sprite asset
    var onTextureAtlasLoaded = function (atlasAsset) {
        var spriteAsset = this;
        if (spriteAsset.resource) {
            spriteAsset.resource.atlas = atlasAsset.resource;
        }
    };

    // The scope of this function is the sprite asset
    var onTextureAtlasAdded = function (atlasAsset) {
        var spriteAsset = this;
        spriteAsset.registry.load(atlasAsset);
    };

    SpriteHandler.prototype = {
        load: function (url, callback) {
            // if given a json file (probably engine-only use case)
            if (pc.path.getExtension(url) === '.json') {
                pc.http.get(url, function (err, response) {
                    if (!err) {
                        callback(null, response);
                    } else {
                        callback(err);
                    }
                });
            }
        },

        // Create sprite resource
        open: function (url, data) {
            var sprite = new pc.Sprite(this._device);
            // json data loaded from file
            if (data) {
                // store data on sprite object temporarily
                sprite.__data = data;
            }

            return sprite;
        },

        // Set sprite data
        patch: function (asset, assets) {
            var sprite = asset.resource;
            if (sprite.__data) {
                // loading from a json file we have asset data store temporarily on the sprite resource
                // copy it into asset.data and delete

                asset.data.pixelsPerUnit = sprite.__data.pixelsPerUnit;
                asset.data.renderMode = sprite.__data.renderMode;
                asset.data.frameKeys = sprite.__data.frameKeys;

                var atlas = assets.getByUrl(sprite.__data.textureAtlasAsset);
                if (atlas) {
                    asset.data.textureAtlasAsset = atlas.id;
                }

                delete sprite.__data;

            }

            sprite.startUpdate();
            sprite.renderMode = asset.data.renderMode;
            sprite.pixelsPerUnit = asset.data.pixelsPerUnit;
            sprite.frameKeys = asset.data.frameKeys;
            this._updateAtlas(asset);
            sprite.endUpdate();

            asset.off('change', this._onAssetChange, this);
            asset.on('change', this._onAssetChange, this);
        },

        // Load atlas
        _updateAtlas: function (asset) {
            var sprite = asset.resource;
            if (! asset.data.textureAtlasAsset) {
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
        },

        _onAssetChange: function (asset, attribute, value, oldValue) {
            if (attribute === 'data') {
                // if the texture atlas changed, clear events for old atlas asset
                if (value && value.textureAtlasAsset && oldValue && value.textureAtlasAsset !== oldValue.textureAtlasAsset) {
                    this._assets.off('load:' + oldValue.textureAtlasAsset, onTextureAtlasLoaded, asset);
                    this._assets.off('add:' + oldValue.textureAtlasAsset, onTextureAtlasAdded, asset);
                }
            }
        }
    };

    return {
        SpriteHandler: SpriteHandler
    };

}());
