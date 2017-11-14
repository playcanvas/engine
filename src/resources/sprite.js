pc.extend(pc, function () {
    var SpriteHandler = function (assets) {
        this._assets = assets;
    };

    SpriteHandler.prototype = {
        load: function (url, callback) {
        },

        // Create sprite resource
        open: function (url, data) {
            return new pc.Sprite();
        },

        // Set sprite data
        patch: function (asset, assets) {
            var sprite = asset.resource;
            sprite.pixelsPerUnit = asset.data.pixelsPerUnit;
            sprite.frameKeys = asset.data.frames;

            this._updateAtlas(asset);

            asset.on('change', function (asset, attribute, value) {
                if (attribute === 'data') {
                    sprite.pixelsPerUnit = value.pixelsPerUnit;
                    sprite.frameKeys = value.frames;
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
