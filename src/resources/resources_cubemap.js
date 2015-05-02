pc.extend(pc.resources, function () {

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

    var CubemapResourceHandler = function (device, assets, loader) {
        this._device = device;
        this._assets = assets;
    };
    CubemapResourceHandler = pc.inherits(CubemapResourceHandler, pc.resources.ResourceHandler);

    CubemapResourceHandler.prototype.load = function (request, options) {
        var self = this;
        var promise = null;
        var asset = self._getAssetFromRequest(request);

        if (pc.string.startsWith(request.canonical, "asset://")) {
            // Loading from asset (platform)
            promise = new pc.promise.Promise(function (resolve, reject) {
                if (!asset) {
                    reject(pc.string.format("Can't load cubemap, asset {0} not found", request.canonical));
                }

                var promises = [];

                // load 6 images
                promises.push(self._loadCubemapImages(asset));

                // load prefiltered data
                var url = asset.getFileUrl();
                if (url && pc.string.endsWith(url.toLowerCase(), '.dds')) {
                    promises.push(self._assets.loader.request(new pc.resources.TextureRequest(url)));
                }

                pc.promise.all(promises).then(function (resources) {
                    var data = pc.extend({}, asset.data);

                    // images
                    data.loadedTextures = resources[0];

                    // prefiltered
                    if (resources.length > 1) {
                        var prefiltered = resources[1][0];
                        data.loadedTextures.push(prefiltered);
                    }

                    resolve(data);
                }, function (error) {
                    reject(error);
                });
            });
        } else {
            // Loading from URL (engine-only)
            // Load cubemap data from a file (as opposed to from an asset)
            promise = new pc.promise.Promise(function (resolve, reject) {
                // load .json file
                pc.net.http.get(request.canonical, function(response) {
                    var data = pc.extend({}, response);

                    var textures = data.textures;
                    if (textures.length) {
                        // Create and load all referenced textures
                        var assets = [];
                        textures.forEach(function (path) {
                             var filename = pc.path.getBasename(path);
                             var url = pc.path.join(pc.path.split(request.canonical)[0], path);
                             assets.push(new pc.asset.Asset(filename, 'texture', {
                                 url: url
                             }));
                        });

                        // convert textures to asset ids
                        data.textures = assets.map(function (asset) {
                            return asset.id;
                        });

                        var promises = [];

                        promises.push(self._assets.load(assets));

                        if (data.prefiltered) {
                            var url = pc.path.join(pc.path.split(request.canonical)[0], data.prefiltered);
                            promises.push(self._assets.loader.request(new pc.resources.TextureRequest(url)));
                        }

                        pc.promise.all(promises).then(function (resources) {
                            data.loadedTextures = resources[0];
                            data.loadedTextures.push(resources[1][0]);
                            resolve(data);
                        }, function (error) {
                            reject(error);
                        });

                    } else {
                        resolve(data);
                    }
                }, {
                    error: function (error) {
                        reject('Could not load cubemap json: ' +  error);
                    }
                });
            });
        }

        return promise;
    };

    CubemapResourceHandler.prototype.open = function (data, request, options) {
        var self = this;

        var asset = self._getAssetFromRequest(request);

        var resources = [];

        // load plain cubemap
        var cubemap = new pc.Texture(self._device, {
            format: pc.PIXELFORMAT_R8_G8_B8_A8,
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

        if (data.loadedTextures) {
            cubemap.setSource(data.loadedTextures.slice(0, 6).map(function (texture) {
                return texture.getSource();
            }));
        }

        resources.push(cubemap);

        // load prefiltered cubemap
        if (data.loadedTextures && data.loadedTextures.length > 6) {
            var prefiltered = data.loadedTextures[6];
            var mipSize = 128;

            for (i = 0; i < 6; i++) {
                // create a cubemap for each mip in the prefiltered cubemap
                var mip = new pc.gfx.Texture(self._device, {
                    cubemap: true,
                    fixCubemapSeams: true,
                    autoMipmap: true,
                    format: prefiltered.format,
                    rgbm: prefiltered.rgbm,
                    width: mipSize,
                    height: mipSize
                });
                mip.addressU = pc.ADDRESS_CLAMP_TO_EDGE;
                mip.addressV = pc.ADDRESS_CLAMP_TO_EDGE;

                mipSize *= 0.5;
                mip._levels[0] = prefiltered._levels[i];
                mip.upload();
                resources.push(mip);
            }
        }

        asset.off('change', self._onCubemapAssetChanged, self);
        asset.on('change', self._onCubemapAssetChanged, self);

        return resources;
    };

    CubemapResourceHandler.prototype._onCubemapAssetChanged = function (asset, attribute, value, oldValue) {
        var self = this;

        // make sure we update the cubemap if the asset changes
        // if a cubemap changes we fire a 'change' event for
        // the cubemapAsset.resource property so materials who reference
        // this cubemap can update
        if (attribute === 'data') {
            var texturesChanged = false;
            if (value.textures.length !== oldValue.textures.length) {
                texturesChanged = true;
            } else {
                for (var i = 0; i < value.textures.length; i++) {
                    if (value.textures[i] !== oldValue.textures[i]) {
                        texturesChanged = true;
                        break;
                    }
                }
            }

            if (texturesChanged) {
                self._loadCubemapImages(asset).then(function (resources) {
                    // copy array
                    var old = asset.resources.slice(0);

                    if (resources) {
                        asset.resource.setSource(resources.map(function (texture) {
                            return texture.getSource();
                        }));
                        asset.fire('change', asset, 'resources', asset.resources, old);
                    }
                });
            }

            asset.resource.minFilter = value.minFilter;
            asset.resource.magFilter = value.magFilter;
            asset.resource.addressU = pc.ADDRESS_CLAMP_TO_EDGE;
            asset.resource.addressV = pc.ADDRESS_CLAMP_TO_EDGE;
            asset.resource.anisotropy = value.anisotropy;
            asset.resource.upload();

        } else if (attribute === 'file') {

            // Clean up asset registry. Not very nice to do this here
            if (oldValue) {
                url = oldValue.url;
                delete self._assets._urls[url];
                self._assets.loader.removeFromCache(url);
                self._assets.loader.unregisterHash(url);
            }

            if (value) {
                // Get new asset url
                url = asset.getFileUrl();

                // Register new url. Clearly asset registry stuff
                // but do it here for now.
                self._assets._urls[url] = asset.id;
                self._assets.loader.registerHash(value.hash, url);

                // reload prefiltered cubemaps
                self._assets.loader.request(new pc.resources.TextureRequest(url)).then(function (resources) {
                    var prefiltered = resources[0];

                    var mipSize = 128;

                    var old = asset.resources.slice(0);

                    asset.resources = [asset.resource];

                    for (i = 0; i < 6; i++) {
                        // create a cubemap for each mip in the prefiltered cubemap
                        var mip = new pc.gfx.Texture(self._device, {
                            cubemap: true,
                            fixCubemapSeams: true,
                            autoMipmap: true,
                            format: prefiltered.format,
                            rgbm: prefiltered.rgbm,
                            width: mipSize,
                            height: mipSize
                        });

                        mipSize *= 0.5;
                        mip._levels[0] = prefiltered._levels[i];
                        mip.upload();
                        asset.resources.push(mip);
                    }

                    asset.fire('change', asset, 'resources', asset.resources, old);
                }, function (error) {
                    console.error('Could not load prefiltered cubemap: ' + error);
                });
            } else {
                // clear old prefiltered cubemaps
                var old = asset.resources.slice(0);
                asset.resources = [asset.resource];
                asset.fire('change', asset, 'resources', asset.resources, old);
            }
        }
    };

    // Checks if there are 6 non-null images with the correct dimensions in the specified array
    CubemapResourceHandler.prototype._areValidImages = function (images) {
        var result = images && images.length === 6;
        var error;

        if (result) {
            var width = images[0] ? images[0].width : null;
            var height = images[0] ? images[0].height : null;

            for (var i = 0; i < 6; i++) {
                if (!images[i]) {
                    result = false;
                    break;
                }


                if ((!images[i] instanceof HTMLCanvasElement) ||
                    (!images[i] instanceof HTMLImageElement) ||
                    (!images[i] instanceof HTMLVideoElement)) {
                    error = 'Cubemap source is not an instance of HTMLCanvasElement, HTMLImageElement or HTMLVideoElement.';
                    result = false;
                    break;
                }

                if (images[i].width !== width  || images[i].height !== height) {
                    error = 'Cubemap sources do not all share the same dimensions.';
                    result = false;
                    break;
                }
            }

        }

        if (error) {
            alert(error);
        }

        return result;
    };

    // Loads the images of the cubemap - Returns a promise
    CubemapResourceHandler.prototype._loadCubemapImages = function (cubemapAsset) {
        var data = cubemapAsset.data;

        var self = this;

        var promise = new pc.promise.Promise(function (resolve, reject) {
            if (data.textures) {
                var assets = [];

                // check if we have 6 assets
                for (var i = 0; i < 6; i++) {
                    var id = parseInt(data.textures[i], 10);
                    if (id >= 0) {
                        var asset = self._assets.getAssetById(id);
                        if (!asset) {
                            reject(pc.string.format('Could not load cubemap - Texture {0} not found', data.textures[i]));
                            return;
                        }

                        assets.push(asset);
                    } else {
                        // one texture is missing so just return
                        resolve(null);
                        return;
                    }
                }

                self._assets.load(assets).then(function (resources) {
                    resolve(resources);

                    assets.forEach(function (asset) {
                        asset.off('change', onTextureAssetChanged, cubemapAsset);
                        asset.on('change', onTextureAssetChanged, cubemapAsset);
                    });
                }, function (error) {
                    reject(error);
                });
            } else {
                // no textures provided so just return
                resolve(null);
                return;
            }
        });

        return promise;
    };

    CubemapResourceHandler.prototype._getAssetFromRequest = function (request) {
        if (pc.string.startsWith(request.canonical, "asset://")) {
            return this._assets.getAssetById(parseInt(request.canonical.slice(8)));
        } else {
            return this._assets.getAssetByUrl(request.canonical);
        }
    };

    var CubemapRequest = function (identifier) {
    };
    CubemapRequest = pc.inherits(CubemapRequest, pc.resources.ResourceRequest);
    CubemapRequest.prototype.type = "cubemap";
    CubemapRequest.prototype.Type = pc.Texture;

    return {
        CubemapResourceHandler: CubemapResourceHandler,
        CubemapRequest: CubemapRequest
    };
}())    ;
