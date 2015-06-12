pc.extend(pc, function () {
    function onTextureAssetChanged (asset, attribute, newValue, oldValue) {
        if (attribute !== 'resource') {
            return;
        }

        var cubemapAsset = this;
        var cubemap = cubemapAsset.resource;
        if (!cubemap)
            return;

        var sources = cubemap.getSource();
        var dirty = false;

        if (oldValue) {
            var oldImage = oldValue.getSource();
            for (var i = 0; i < sources.length; i++) {
                if (sources[i] === oldImage) {
                    sources[i] = newValue.getSource();
                    dirty = true;
                }
            }
        }

        if (dirty) {
            cubemap.setSource(sources);
            // fire 'change' event so dependent materials can update
            var old = cubemapAsset.resources.slice(0);
            cubemapAsset.fire('change', cubemapAsset, 'resources', cubemapAsset.resources, old);
        } else {
            asset.off('change', onTextureAssetChanged, cubemap);
        }
    }

    var CubemapHandler = function (device, assets, loader) {
        this._device = device;
        this._assets = assets;
        this._loader = loader;
    };

    CubemapHandler.prototype = {
        load: function (url, callback) {
            var count = 0;
            var data = {};
            if (pc.string.endsWith(url, ".dds")) {
                // loading prefiltered cubemap data
                this._loader.load(url, "texture", function (err, texture) {
                    count--;
                    if (!err) {
                        // store in asset data
                        data.dds = texture;
                        if (count === 0) {
                            callback(null, data);
                        }
                    } else {
                        callback(err);
                    }
                });
            } else if (pc.string.endsWith(url, ".json")) {
                // loading cubemap from file (engine-only)
            }
        },

        open: function (url, data) {
            var i;

            var resources = [];

            var cubemap = new pc.Texture(this._device, { // highest res cubemap used for skybox
                format : pc.PIXELFORMAT_R8_G8_B8_A8,
                cubemap: true,
                autoMipmap: true,
                fixCubemapSeams: !!data.dds
            });

            cubemap.name = data.name;
            cubemap.minFilter = data.minFilter;
            cubemap.magFilter = data.magFilter;
            cubemap.addressU = pc.ADDRESS_CLAMP_TO_EDGE;
            cubemap.addressV = pc.ADDRESS_CLAMP_TO_EDGE;
            cubemap.anisotropy = data.anisotropy;
            cubemap.rgbm = !!data.rgbm;

            resources.push(cubemap);

            if (data.dds) {

                data.dds.fixCubemapSeams = true;
                data.dds.minFilter = pc.FILTER_LINEAR;
                data.dds.magFilter = pc.FILTER_LINEAR;
                data.dds.addressU = pc.ADDRESS_CLAMP_TO_EDGE;
                data.dds.addressV = pc.ADDRESS_CLAMP_TO_EDGE;
                resources.push(data.dds); // unchanged mip0

                var mipSize = 64;
                for (i = 1; i < 6; i++) {
                    // create a cubemap for each mip in the prefiltered cubemap
                    var mip = new pc.gfx.Texture(this._device, {
                        cubemap: true,
                        fixCubemapSeams: true,
                        autoMipmap: true,
                        format: data.dds.format,
                        rgbm: data.dds.rgbm,
                        width: mipSize,
                        height: mipSize
                    });
                    mip.addressU = pc.ADDRESS_CLAMP_TO_EDGE;
                    mip.addressV = pc.ADDRESS_CLAMP_TO_EDGE;

                    mipSize *= 0.5;
                    mip._levels[0] = data.dds._levels[i];
                    mip.upload();
                    resources.push(mip);
                }
            }

            return resources;
        },

        patch: function (cubemapAsset, assets) {
            var i;

            var cubemap = cubemapAsset.resource;
            var textureAssets = [];
            var sources = [];
            var count = 0;
            cubemapAsset.data.textures.forEach(function (id, index) {
                var _asset = assets.get(cubemapAsset.data.textures[index]);
                if (_asset) {
                    _asset.ready(function (asset) {
                        count++;
                        sources[index] = asset.resource.getSource();
                        if (count === 6) {
                            cubemap.setSource(sources);
                        }

                        _asset.off('change', onTextureAssetChanged, cubemapAsset);
                        _asset.on('change', onTextureAssetChanged, cubemapAsset);
                    });
                    assets.load(_asset);
                } else {
                    assets.once("load:" + id, function (asset) {
                        asset.ready(function (asset) {
                            count++;
                            sources[index] = asset.resource.getSource();
                            if (count === 6) {
                                cubemap.setSource(sources);
                            }

                            asset.off('change', onTextureAssetChanged, cubemapAsset);
                            asset.on('change', onTextureAssetChanged, cubemapAsset);
                        });
                    });
                }
            });

            cubemapAsset.off('change', this._onCubemapAssetChanged, this);
            cubemapAsset.on('change', this._onCubemapAssetChanged, this);
        },

        _onCubemapAssetChanged: function (asset, attribute, newValue, oldValue) {
            var self = this;

            if (attribute === "data") {
                // refresh all sources
                var l = newValue.textures.length;
                var count = l;
                var sources = [];
                newValue.textures.forEach(function (id, index) {
                    var texture = self._assets.get(id);
                    if (texture) {
                        texture.ready(function (texture) {
                            sources[index] = texture.resource.getSource();
                            count--;
                            if (count === 0) {
                                asset.resource.setSource(sources);
                            }

                            texture.off('change', onTextureAssetChanged, asset);
                            texture.on('change', onTextureAssetChanged, asset);
                        });
                        self._assets.load(texture);
                    }
                });

                asset.resource.minFilter = newValue.minFilter;
                asset.resource.magFilter = newValue.magFilter;
                asset.resource.addressU = pc.ADDRESS_CLAMP_TO_EDGE;
                asset.resource.addressV = pc.ADDRESS_CLAMP_TO_EDGE;
                asset.resource.anisotropy = newValue.anisotropy;
                asset.resource.rgbm = newValue.rgbm ? true : false;
                asset.resource.upload();

            } else if (attribute === 'file') {
                // prefiltered file has changed
                if (asset.file && asset.file.url) {
                    this._loader.load(asset.file.url, "texture", function (err, texture) {
                        if (!err) {
                            self._loader.patch({
                                resource: texture,
                                type: "texture",
                                data: asset.data
                            }, this._assets);

                            // store in asset data
                            asset.data.dds = texture;
                            asset.resources = self._loader.open(asset.type, asset.data);
                            self._loader.patch(asset, self._assets);
                        } else {
                            console.error(err);
                        }
                    });
                } else {
                    // remove prefiltered data
                    asset.resources = [asset.resource];
                }
            }
        },
    };

    return {
        CubemapHandler: CubemapHandler
    };

}());
