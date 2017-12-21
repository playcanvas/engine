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
                asset.data.frames = sprite.__data.frames;

                var atlas = assets.getByUrl(sprite.__data.textureAtlasAsset);
                if (atlas) {
                    asset.data.textureAtlasAsset = atlas.id;
                }

                delete sprite.__data;

            }

            sprite.pixelsPerUnit = asset.data.pixelsPerUnit;
            sprite.frames = asset.data.frames;;

            this._updateAtlas(asset);

            asset.on('change', function (asset, attribute, value) {
                if (attribute === 'data') {
                    sprite.pixelsPerUnit = value.pixelsPerUnit;
                    sprite.frames = value.frames;
                    this._updateAtlas(asset);
                }
            }, this);
        },

        // Load atlas
        _updateAtlas: function (asset) {
            var sprite = asset.resource;
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
