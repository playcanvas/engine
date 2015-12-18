pc.extend(pc, function () {
    var CubemapHandler = function (device, assets, loader) {
        this._device = device;
        this._assets = assets;
        this._loader = loader;
    };

    CubemapHandler.prototype = {
        load: function (url, callback) { },

        open: function (url, data) { },

        patch: function (assetCubeMap, assets) {
            var self = this;
            var loaded = false;

            if (! assetCubeMap.resources[0]) {
                assetCubeMap.resources[0] = new pc.Texture(this._device, {
                    format : pc.PIXELFORMAT_R8_G8_B8_A8,
                    cubemap: true,
                    autoMipmap: true,
                    fixCubemapSeams: !! assetCubeMap._dds
                });

                loaded = true;
            }

            if (! assetCubeMap.file) {
                delete assetCubeMap._dds;
            } else if (assetCubeMap.file && ! assetCubeMap._dds) {
                assets._loader.load(assetCubeMap.file.url + '?t=' + assetCubeMap.file.hash, 'texture', function (err, texture) {
                    if (! err) {
                        assets._loader.patch({
                            resource: texture,
                            type: 'texture',
                            data: assetCubeMap.data
                        }, assets);

                        assetCubeMap._dds = texture;
                        self.patch(assetCubeMap, assets);
                    } else {
                        assets.fire("error", err, assetCubeMap);
                        assets.fire("error:" + assetCubeMap.id, err, assetCubeMap);
                        assetCubeMap.fire("error", err, assetCubeMap);
                        return;
                    }
                });
            }

            if ((! assetCubeMap.file || ! assetCubeMap._dds) && assetCubeMap.resources[1]) {
                // unset prefiltered textures
                assetCubeMap.resources = [ assetCubeMap.resources[0] ];

                loaded = true;
            } else if (assetCubeMap._dds && ! assetCubeMap.resources[1]) {
                assetCubeMap.resources = [ assetCubeMap.resources[0] ];

                // set prefiltered textures
                assetCubeMap._dds.fixCubemapSeams = true;
                assetCubeMap._dds.autoMipmap = this._device.useTexCubeLod ? false : true;
                assetCubeMap._dds.minFilter = this._device.useTexCubeLod ? pc.FILTER_LINEAR_MIPMAP_LINEAR : pc.FILTER_LINEAR;
                assetCubeMap._dds.magFilter = pc.FILTER_LINEAR;
                assetCubeMap._dds.addressU = pc.ADDRESS_CLAMP_TO_EDGE;
                assetCubeMap._dds.addressV = pc.ADDRESS_CLAMP_TO_EDGE;
                assetCubeMap.resources.push(assetCubeMap._dds);

                for (var i = 1; i < 6; i++) {
                    // create a cubemap for each mip in the prefiltered cubemap
                    var mip = new pc.gfx.Texture(this._device, {
                        cubemap: true,
                        fixCubemapSeams: true,
                        autoMipmap: true,
                        format: assetCubeMap._dds.format,
                        rgbm: assetCubeMap._dds.rgbm,
                        width: Math.pow(2, 7 - i),
                        height: Math.pow(2, 7 - i)
                    });
                    mip.addressU = pc.ADDRESS_CLAMP_TO_EDGE;
                    mip.addressV = pc.ADDRESS_CLAMP_TO_EDGE;

                    mip._levels[0] = assetCubeMap._dds._levels[i];
                    mip.upload();
                    assetCubeMap.resources.push(mip);
                }

                loaded = true;
            }

            var cubemap = assetCubeMap.resource;

            if (cubemap.name !== assetCubeMap.name)
                cubemap.name = assetCubeMap.name;

            if (assetCubeMap.data.hasOwnProperty('rgbm') && cubemap.rgbm !== !! assetCubeMap.data.rgbm)
                cubemap.rgbm = !! assetCubeMap.data.rgbm;

            cubemap.fixCubemapSeams = !! assetCubeMap._dds;

            if (assetCubeMap.data.hasOwnProperty('minFilter') && cubemap.minFilter !== assetCubeMap.data.minFilter)
                cubemap.minFilter = assetCubeMap.data.minFilter;

            if (assetCubeMap.data.hasOwnProperty('magFilter') && cubemap.magFilter !== assetCubeMap.data.magFilter)
                cubemap.magFilter = assetCubeMap.data.magFilter;

            if (assetCubeMap.data.hasOwnProperty('anisotropy') && cubemap.anisotropy !== assetCubeMap.data.anisotropy)
                cubemap.anisotropy = assetCubeMap.data.anisotropy;

            if (cubemap.addressU !== pc.ADDRESS_CLAMP_TO_EDGE)
                cubemap.addressU = pc.ADDRESS_CLAMP_TO_EDGE;

            if (cubemap.addressV !== pc.ADDRESS_CLAMP_TO_EDGE)
                cubemap.addressV = pc.ADDRESS_CLAMP_TO_EDGE;

            this._patchTextureFaces(assetCubeMap, assets);

            if (loaded) {
                // trigger load event as resource is changed
                assets.fire('load', assetCubeMap);
                assets.fire('load:' + assetCubeMap.id, assetCubeMap);
                assetCubeMap.fire('load', assetCubeMap);
            }
        },

        _patchTexture: function() {
            this.registry._loader._handlers.cubemap._patchTextureFaces(this, this.registry);
        },

        _patchTextureFaces: function(assetCubeMap, assets) {
            if (! assetCubeMap.loadFaces && assetCubeMap.file)
                return;

            var cubemap = assetCubeMap.resource;
            var sources = [ ];
            var count = 0;
            var levelsUpdated = false;
            var self = this;

            if (! assetCubeMap._levelsEvents)
                assetCubeMap._levelsEvents = [ null, null, null, null, null, null ];

            assetCubeMap.data.textures.forEach(function (id, index) {
                var assetReady = function(asset) {
                    count++;
                    sources[index] = asset && asset.resource.getSource() || null;

                    // events of texture loads
                    var evtAsset = assetCubeMap._levelsEvents[index];
                    if (evtAsset !== asset) {
                        if (evtAsset)
                            evtAsset.off('load', self._patchTexture, assetCubeMap);

                        if (asset)
                            asset.on('load', self._patchTexture, assetCubeMap);

                        assetCubeMap._levelsEvents[index] = asset || null;
                    }

                    // check if source is actually changed
                    if (sources[index] !== cubemap._levels[0][index])
                        levelsUpdated = true;

                    // when all faces checked
                    if (count === 6 && levelsUpdated) {
                        cubemap.setSource(sources);
                        // trigger load event (resource changed)
                        assets.fire('load', assetCubeMap);
                        assets.fire('load:' + assetCubeMap.id, assetCubeMap);
                        assetCubeMap.fire('load', assetCubeMap);
                    }
                };

                var asset = assets.get(assetCubeMap.data.textures[index]);
                if (asset) {
                    asset.ready(assetReady);
                    assets.load(asset);
                } else if (id) {
                    assets.once("load:" + id, assetReady);
                } else {
                    assetReady(null);
                }
            });
        },
    };

    return {
        CubemapHandler: CubemapHandler
    };

}());
