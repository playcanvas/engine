pc.extend(pc, function () {
    var SpriteHandler = function (assets, device) {
        this._assets = assets;
        this._device = device;
    };

    SpriteHandler.prototype = {
        load: function (url, callback) {
            // if given a json file (probably engine-only use case)
            if (pc.path.getExtension(url) === '.json') {
                pc.http.get(url, function (err, response) {
                    if(!err) {
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
            sprite.pixelsPerUnit = asset.data.pixelsPerUnit;
            sprite.renderMode = asset.data.renderMode;
            sprite.frameKeys = asset.data.frameKeys;
            this._updateAtlas(asset);
            sprite.endUpdate();
        },

        // Load atlas
        _updateAtlas: function (asset) {
            var sprite = asset.resource;
            if (! asset.data.textureAtlasAsset) {
                sprite.atlas = null;
                return;
            }

            var atlasAsset = this._assets.get(asset.data.textureAtlasAsset);
            if (atlasAsset && atlasAsset.resource) {
                sprite.atlas = atlasAsset.resource;
            } else {
                this._assets.once('load:' + asset.data.textureAtlasAsset, function (atlasAsset) {
                    sprite.atlas = atlasAsset.resource;
                }, this);

                if (!atlasAsset) {
                    this._assets.once('add:' + asset.data.textureAtlasAsset, function (atlasAsset) {
                        this._assets.load(atlasAsset);
                    }, this);
                } else {
                    this._assets.load(atlasAsset);
                }
            }

        }
    };

    return {
        SpriteHandler: SpriteHandler
    };

}());
