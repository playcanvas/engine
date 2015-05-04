pc.extend(pc, function () {
    // function onTextureAssetChanged (asset, attribute, newValue, oldValue) {
    //     if (attribute !== 'resource') {
    //         return;
    //     }

    //     var cubemapAsset = this;
    //     var cubemap = cubemapAsset.resource;
    //     if (!cubemap)
    //         return;

    //     var sources = cubemap.getSource();
    //     var dirty = false;

    //     if (oldValue) {
    //         var oldImage = oldValue.getSource();
    //         for (var i = 0; i < sources.length; i++) {
    //             if (sources[i] === oldImage) {
    //                 sources[i] = newValue.getSource();
    //                 dirty = true;
    //             }
    //         }
    //     }

    //     if (dirty) {
    //         cubemap.setSource(sources);
    //         // fire 'change' event so dependent materials can update
    //         var old = cubemapAsset.resources.slice(0);
    //         cubemapAsset.fire('change', cubemapAsset, 'resources', cubemapAsset.resources, old);
    //     } else {
    //         asset.off('change', onTextureAssetChanged, cubemap);
    //     }
    // }

    var CubemapHandler = function (device, assets, loader) {
        this._device = device;
        this._assets = assets;
        this._loader = loader;
    };

    CubemapHandler.prototype = {
        load: function (url, callback) {
            var count = 0;
            // var data = pc.extend({}, asset.data);
            var data = {};
            if (pc.string.endsWith(url, ".dds")) {
                // loading prefiltered cubemap data
                this._loader.load(url, "texture", function (err, texture) {
                    count--;
                    if (!err) {
                        // store in asset data
                        data.dds = texture;
                        if (count === 0) {
                            callback(null, data)
                        }
                    } else {
                        callback(err);
                    }
                });
            } else if (pc.string.endsWith(url, ".json")) {
                // loading cubemap from file (engine-only)
            }

            // var self = this;
            // var promise = null;
            // var asset = self._getAssetFromRequest(request);

            // if (pc.string.startsWith(request.canonical, "asset://")) {
            //     // Loading from asset (platform)
            //     promise = new pc.promise.Promise(function (resolve, reject) {
            //         if (!asset) {
            //             reject(pc.string.format("Can't load cubemap, asset {0} not found", request.canonical));
            //         }

            //         var promises = [];

            //         // load 6 images
            //         promises.push(self._loadCubemapImages(asset));

            //         // load prefiltered data
            //         var url = asset.getFileUrl();
            //         if (url && pc.string.endsWith(url.toLowerCase(), '.dds')) {
            //             promises.push(self._assets.loader.request(new pc.resources.TextureRequest(url)));
            //         }

            //         pc.promise.all(promises).then(function (resources) {
            //             var data = pc.extend({}, asset.data);

            //             // images
            //             data.loadedTextures = resources[0];

            //             // prefiltered
            //             if (resources.length > 1) {
            //                 var prefiltered = resources[1][0];
            //                 data.loadedTextures.push(prefiltered);
            //             }

            //             resolve(data);
            //         }, function (error) {
            //             reject(error);
            //         });
            //     });
            // } else {
            //     // Loading from URL (engine-only)
            //     // Load cubemap data from a file (as opposed to from an asset)
            //     promise = new pc.promise.Promise(function (resolve, reject) {
            //         // load .json file
            //         pc.net.http.get(request.canonical, function(response) {
            //             var data = pc.extend({}, response);

            //             var textures = data.textures;
            //             if (textures.length) {
            //                 // Create and load all referenced textures
            //                 var assets = [];
            //                 textures.forEach(function (path) {
            //                      var filename = pc.path.getBasename(path);
            //                      var url = pc.path.join(pc.path.split(request.canonical)[0], path);
            //                      assets.push(new pc.asset.Asset(filename, 'texture', {
            //                          url: url
            //                      }));
            //                 });

            //                 // convert textures to asset ids
            //                 data.textures = assets.map(function (asset) {
            //                     return asset.id;
            //                 });

            //                 var promises = [];

            //                 promises.push(self._assets.load(assets));

            //                 if (data.prefiltered) {
            //                     var url = pc.path.join(pc.path.split(request.canonical)[0], data.prefiltered);
            //                     promises.push(self._assets.loader.request(new pc.resources.TextureRequest(url)));
            //                 }

            //                 pc.promise.all(promises).then(function (resources) {
            //                     data.loadedTextures = resources[0];
            //                     data.loadedTextures.push(resources[1][0]);
            //                     resolve(data);
            //                 }, function (error) {
            //                     reject(error);
            //                 });

            //             } else {
            //                 resolve(data);
            //             }
            //         }, {
            //             error: function (error) {
            //                 reject('Could not load cubemap json: ' +  error);
            //             }
            //         });
            //     });
            // }

            // return promise;
        },

        open: function (url, data) {
            var i;

            var resources = [];

            var cubemap = new pc.Texture(this._device, {
                format : pc.PIXELFORMAT_R8_G8_B8_A8,
                cubemap: true,
                autoMipmap: true,
                fixCubemapSeams: true
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
                var mipSize = 128;

                for (i = 0; i < 6; i++) {
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

        patch: function (asset, assets) {
            var i;

            var cubemap = asset.resource;
            var textureAssets = [];
            var sources = [];
            var count = 0;
            asset.data['textures'].forEach(function (id, index) {
                var _asset = assets.get(asset.data['textures'][index]);
                if (_asset) {
                    _asset.ready(function (asset) {
                        count++;
                        sources[index] = asset.resource.getSource();
                        if (count === 6) {
                            cubemap.setSource(sources);
                        }
                    });
                    assets.load(_asset);
                } else {
                    assets.on("load:" + id, function (asset) {
                        asset.ready(function (asset) {
                            count++;
                            sources[index] = asset.resource.getSource();
                            if (count === 6) {
                                cubemap.setSource(sources);
                            }
                        });
                    });
                }
            });

            asset.off('change', this._onCubemapAssetChanged, this);
            asset.on('change', this._onCubemapAssetChanged, this);
        },

        // open: function (url, data) {
        //     var self = this;

        //     var asset = self._getAssetFromRequest(request);

        //     var resources = [];

        //     // load plain cubemap
        //     var cubemap = new pc.Texture(self._device, {
        //         format: pc.PIXELFORMAT_R8_G8_B8_A8,
        //         cubemap: true,
        //         autoMipmap: true,
        //         fixCubemapSeams: true
        //     });

        //     cubemap.name = data.name;
        //     cubemap.minFilter = data.minFilter;
        //     cubemap.magFilter = data.magFilter;
        //     cubemap.addressU = pc.ADDRESS_CLAMP_TO_EDGE;
        //     cubemap.addressV = pc.ADDRESS_CLAMP_TO_EDGE;
        //     cubemap.anisotropy = data.anisotropy;
        //     cubemap.rgbm = !!data.rgbm;

        //     if (data.loadedTextures) {
        //         cubemap.setSource(data.loadedTextures.slice(0, 6).map(function (texture) {
        //             return texture.getSource();
        //         }));
        //     }

        //     resources.push(cubemap);

        //     // load prefiltered cubemap
        //     if (data.loadedTextures && data.loadedTextures.length > 6) {
        //         var prefiltered = data.loadedTextures[6];
        //         var mipSize = 128;

        //         for (i = 0; i < 6; i++) {
        //             // create a cubemap for each mip in the prefiltered cubemap
        //             var mip = new pc.gfx.Texture(self._device, {
        //                 cubemap: true,
        //                 fixCubemapSeams: true,
        //                 autoMipmap: true,
        //                 format: prefiltered.format,
        //                 rgbm: prefiltered.rgbm,
        //                 width: mipSize,
        //                 height: mipSize
        //             });
        //             mip.addressU = pc.ADDRESS_CLAMP_TO_EDGE;
        //             mip.addressV = pc.ADDRESS_CLAMP_TO_EDGE;

        //             mipSize *= 0.5;
        //             mip._levels[0] = prefiltered._levels[i];
        //             mip.upload();
        //             resources.push(mip);
        //         }
        //     }

        //     asset.off('change', self._onCubemapAssetChanged, self);
        //     asset.on('change', self._onCubemapAssetChanged, self);

        //     return resources;
        // },

        _onCubemapAssetChanged: function (asset, attribute, newValue, oldValue) {
            var self = this;

            if (attribute === "data") {
                // refresh all sources
                var l = newValue['textures'].length;
                var count = l;
                var sources = [];
                newValue['textures'].forEach(function (id, index) {
                    var texture = self._assets.get(id);
                    if (texture) {
                        texture.ready(function (texture) {
                            sources[index] = texture.resource.getSource();
                            count--;
                            if (count === 0) {
                                asset.resource.setSource(sources);
                            }
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
