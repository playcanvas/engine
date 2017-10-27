pc.extend(pc, function () {
    var SpriteAtlasHandler = function (loader) {
        this._loader = loader;
    };

    SpriteAtlasHandler.prototype = {
        load: function (url, callback) {
            var handler = this._loader.getHandler("texture");
            return handler.load(url, callback);
        },

        open: function (url, data) {
            var handler = this._loader.getHandler("texture");
            var texture = handler.open(url, data);
            if (! texture) return null;

            var resource = new pc.SpriteAtlas();
            resource.texture = texture;
            return resource;
        },

        patch: function (asset, assets) {
            var texture = asset.resource.texture;
            if (texture) {
                texture.name = asset.name;
                texture.minFilter = pc.FILTER_LINEAR_MIPMAP_LINEAR;
                texture.magFilter = pc.FILTER_LINEAR;
                texture.addressU = pc.ADDRESS_CLAMP_TO_EDGE;
                texture.addressV = pc.ADDRESS_CLAMP_TO_EDGE;
                texture.mipmaps = true;
                texture.anisotropy = 1;
            }

            asset.resource.frames = asset.data.frames;

            asset.on('change', function (asset, attribute, value) {
                if (attribute === 'data') {
                    asset.resource.frames = value.frames;
                }
            });
        }
    };

    return {
        SpriteAtlasHandler: SpriteAtlasHandler
    };

}());
