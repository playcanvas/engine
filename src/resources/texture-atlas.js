Object.assign(pc, function () {
    var JSON_ADDRESS_MODE = {
        "repeat": pc.ADDRESS_REPEAT,
        "clamp": pc.ADDRESS_CLAMP_TO_EDGE,
        "mirror": pc.ADDRESS_MIRRORED_REPEAT
    };

    var JSON_FILTER_MODE = {
        "nearest": pc.FILTER_NEAREST,
        "linear": pc.FILTER_LINEAR,
        "nearest_mip_nearest": pc.FILTER_NEAREST_MIPMAP_NEAREST,
        "linear_mip_nearest": pc.FILTER_LINEAR_MIPMAP_NEAREST,
        "nearest_mip_linear": pc.FILTER_NEAREST_MIPMAP_LINEAR,
        "linear_mip_linear": pc.FILTER_LINEAR_MIPMAP_LINEAR
    };

    var regexFrame = /^data\.frames\.(\d+)$/;

    var TextureAtlasHandler = function (loader) {
        this._loader = loader;
        this.retryRequests = false;
    };

    Object.assign(TextureAtlasHandler.prototype, {
        // Load the texture atlas texture using the texture resource loader
        load: function (url, callback) {
            if (typeof url === 'string') {
                url = {
                    load: url,
                    original: url
                };
            }

            var self = this;
            var handler = this._loader.getHandler("texture");

            // if supplied with a json file url (probably engine-only)
            // load json data then load texture of same name
            if (pc.path.getExtension(url.original) === '.json') {
                pc.http.get(url.load, {
                    retry: this.retryRequests
                }, function (err, response) {
                    if (!err) {
                        // load texture
                        var textureUrl = url.original.replace('.json', '.png');
                        self._loader.load(textureUrl, "texture", function (err, texture) {
                            if (err) {
                                callback(err);
                            } else {
                                callback(null, {
                                    data: response,
                                    texture: texture
                                });
                            }
                        });
                    } else {
                        callback(err);
                    }
                });
            } else {
                return handler.load(url, callback);
            }
        },

        // Create texture atlas resource using the texture from the texture loader
        open: function (url, data) {
            var resource = new pc.TextureAtlas();
            if (data.texture && data.data) {
                resource.texture = data.texture;
                resource.__data = data.data; // store data temporarily to be copied into asset
            } else {
                var handler = this._loader.getHandler("texture");
                var texture = handler.open(url, data);
                if (!texture) return null;
                resource.texture = texture;
            }
            return resource;
        },

        patch: function (asset, assets) {
            if (asset.resource.__data) {
                // engine-only, so copy temporary asset data from texture atlas into asset and delete temp property
                if (asset.resource.__data.minfilter !== undefined) asset.data.minfilter = asset.resource.__data.minfilter;
                if (asset.resource.__data.magfilter !== undefined) asset.data.magfilter = asset.resource.__data.magfilter;
                if (asset.resource.__data.addressu !== undefined) asset.data.addressu = asset.resource.__data.addressu;
                if (asset.resource.__data.addressv !== undefined) asset.data.addressv = asset.resource.__data.addressv;
                if (asset.resource.__data.mipmaps !== undefined) asset.data.mipmaps = asset.resource.__data.mipmaps;
                if (asset.resource.__data.anisotropy !== undefined) asset.data.anisotropy = asset.resource.__data.anisotropy;
                if (asset.resource.__data.rgbm !== undefined) asset.data.rgbm = !!asset.resource.__data.rgbm;

                asset.data.frames = asset.resource.__data.frames;

                delete asset.resource.__data;
            }

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

            asset.resource.texture = texture;

            // set frames
            var frames = {};
            for (var key in asset.data.frames) {
                var frame = asset.data.frames[key];
                frames[key] = {
                    rect: new pc.Vec4(frame.rect),
                    pivot: new pc.Vec2(frame.pivot),
                    border: new pc.Vec4(frame.border)
                };
            }
            asset.resource.frames = frames;

            asset.off('change', this._onAssetChange, this);
            asset.on('change', this._onAssetChange, this);
        },

        _onAssetChange: function (asset, attribute, value) {
            var frame;

            if (attribute === 'data' || attribute === 'data.frames') {
                // set frames
                var frames = {};
                for (var key in value.frames) {
                    frame = value.frames[key];
                    frames[key] = {
                        rect: new pc.Vec4(frame.rect),
                        pivot: new pc.Vec2(frame.pivot),
                        border: new pc.Vec4(frame.border)
                    };
                }
                asset.resource.frames = frames;
            } else {
                var match = attribute.match(regexFrame);
                if (match) {
                    var frameKey = match[1];

                    if (value) {
                        // add or update frame
                        if (!asset.resource.frames[frameKey]) {
                            asset.resource.frames[frameKey] = {
                                rect: new pc.Vec4(value.rect),
                                pivot: new pc.Vec2(value.pivot),
                                border: new pc.Vec4(value.border)
                            };
                        } else {
                            frame = asset.resource.frames[frameKey];
                            frame.rect.set(value.rect[0], value.rect[1], value.rect[2], value.rect[3]);
                            frame.pivot.set(value.pivot[0], value.pivot[1]);
                            frame.border.set(value.border[0], value.border[1], value.border[2], value.border[3]);
                        }

                        asset.resource.fire('set:frame', frameKey, asset.resource.frames[frameKey]);

                    } else {
                        // delete frame
                        if (asset.resource.frames[frameKey]) {
                            delete asset.resource.frames[frameKey];
                            asset.resource.fire('remove:frame', frameKey);
                        }
                    }

                }
            }
        }
    });

    return {
        TextureAtlasHandler: TextureAtlasHandler
    };
}());
