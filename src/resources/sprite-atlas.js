pc.extend(pc, function () {
    var SpriteAtlasHandler = function (loader) {
        this._loader = loader;
    };

    SpriteAtlasHandler.prototype = {
        // Load the sprite atlas texture using the texture resource loader
        load: function (url, callback) {
            var handler = this._loader.getHandler("texture");
            return handler.load(url, callback);
        },

        // Create sprite atlas resource using the texture from the texture loader
        open: function (url, data) {
            var handler = this._loader.getHandler("texture");
            var texture = handler.open(url, data);
            if (! texture) return null;

            var resource = new pc.SpriteAtlas();
            resource.texture = texture;
            return resource;
        },

        patch: function (asset, assets) {
            // pass defaults to texture
            var texture = asset.resource.texture;
            if (texture) {
                texture.name = asset.name;
                texture.minFilter = pc.FILTER_NEAREST_MIPMAP_NEAREST; //pc.FILTER_LINEAR_MIPMAP_LINEAR;
                texture.magFilter = pc.FILTER_NEAREST; //pc.FILTER_LINEAR;
                texture.addressU = pc.ADDRESS_CLAMP_TO_EDGE;
                texture.addressV = pc.ADDRESS_CLAMP_TO_EDGE;
                texture.mipmaps = true;
                texture.anisotropy = 1;
            }

            // set frames
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
