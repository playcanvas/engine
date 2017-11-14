pc.extend(pc, function () {
    var JSON_ADDRESS_MODE = {
        "repeat": pc.ADDRESS_REPEAT,
        "clamp":  pc.ADDRESS_CLAMP_TO_EDGE,
        "mirror": pc.ADDRESS_MIRRORED_REPEAT
    };

    var JSON_FILTER_MODE = {
        "nearest":             pc.FILTER_NEAREST,
        "linear":              pc.FILTER_LINEAR,
        "nearest_mip_nearest": pc.FILTER_NEAREST_MIPMAP_NEAREST,
        "linear_mip_nearest":  pc.FILTER_LINEAR_MIPMAP_NEAREST,
        "nearest_mip_linear":  pc.FILTER_NEAREST_MIPMAP_LINEAR,
        "linear_mip_linear":   pc.FILTER_LINEAR_MIPMAP_LINEAR
    };

    var TextureAtlasHandler = function (loader) {
        this._loader = loader;
    };

    TextureAtlasHandler.prototype = {
        // Load the texture atlas texture using the texture resource loader
        load: function (url, callback) {
            var handler = this._loader.getHandler("texture");
            return handler.load(url, callback);
        },

        // Create texture atlas resource using the texture from the texture loader
        open: function (url, data) {
            var handler = this._loader.getHandler("texture");
            var texture = handler.open(url, data);
            if (! texture) return null;

            var resource = new pc.TextureAtlas();
            resource.texture = texture;
            return resource;
        },

        patch: function (asset, assets) {
            // pass texture data
            var texture = asset.resource.texture;
            if (texture) {
                texture.name = asset.name;

                if (asset.data.hasOwnProperty('minfilter') && texture.minFilter !== JSON_FILTER_MODE[asset.data.minfilter])
                    texture.minFilter = JSON_FILTER_MODE[asset.data.minfilter];

                if (asset.data.hasOwnProperty('magfilter') && texture.magFilter !== JSON_FILTER_MODE[asset.data.magfilter])
                    texture.magFilter = JSON_FILTER_MODE[asset.data.magfilter];

                if (asset.data.hasOwnProperty('addressu') && texture.addressU !== JSON_ADDRESS_MODE[asset.data.addressu])
                    texture.addressU = JSON_ADDRESS_MODE[asset.data.addressu];

                if (asset.data.hasOwnProperty('addressv') && texture.addressV !== JSON_ADDRESS_MODE[asset.data.addressv])
                    texture.addressV = JSON_ADDRESS_MODE[asset.data.addressv];

                if (asset.data.hasOwnProperty('mipmaps') && texture.mipmaps !== asset.data.mipmaps)
                    texture.mipmaps = asset.data.mipmaps;

                if (asset.data.hasOwnProperty('anisotropy') && texture.anisotropy !== asset.data.anisotropy)
                    texture.anisotropy = asset.data.anisotropy;

                var rgbm = !!asset.data.rgbm;
                if (asset.data.hasOwnProperty('rgbm') && texture.rgbm !== rgbm)
                    texture.rgbm = rgbm;
            }

            // set frames
            asset.resource.frames = {};
            for (var key in asset.data.frames) {
                asset.resource.frames[key] = {
                    rect: new pc.Vec4(asset.data.frames[key].rect),
                    pivot: new pc.Vec2(asset.data.frames[key].pivot),
                };
            }

            asset.on('change', function (asset, attribute, value) {
                if (attribute === 'data') {
                    asset.resource.frames = value.frames;
                }
            });
        }
    };

    return {
        TextureAtlasHandler: TextureAtlasHandler
    };

}());
