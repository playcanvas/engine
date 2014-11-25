pc.extend(pc.resources, function () {
    var jsonToAddressMode = {
        "repeat": pc.gfx.ADDRESS_REPEAT,
        "clamp":  pc.gfx.ADDRESS_CLAMP_TO_EDGE,
        "mirror": pc.gfx.ADDRESS_MIRRORED_REPEAT
    };

    var jsonToFilterMode = {
        "nearest":             pc.gfx.FILTER_NEAREST,
        "linear":              pc.gfx.FILTER_LINEAR,
        "nearest_mip_nearest": pc.gfx.FILTER_NEAREST_MIPMAP_NEAREST,
        "linear_mip_nearest":  pc.gfx.FILTER_LINEAR_MIPMAP_NEAREST,
        "nearest_mip_linear":  pc.gfx.FILTER_NEAREST_MIPMAP_LINEAR,
        "linear_mip_linear":   pc.gfx.FILTER_LINEAR_MIPMAP_LINEAR
    };

    var MaterialResourceHandler = function (device, assets) {
        this._assets = assets;
        this._device = device;
    };
    MaterialResourceHandler = pc.inherits(MaterialResourceHandler, pc.resources.ResourceHandler);

    MaterialResourceHandler.prototype.load = function (request, options) {
        var promise = null;

        if (pc.string.startsWith(request.canonical, "asset://")) {
            // Loading from asset (platform)
            promise = new pc.promise.Promise(function (resolve, reject) {
                var asset = this._getAssetFromRequest(request);
                if (!asset) {
                    reject(pc.string("Can't load material, asset %s not found", request.canonical));
                }
                resolve(asset.data);
            }.bind(this));
        } else {
            // Loading from URL (engine-only)
            // Load material data from a file (as opposed to from an asset)
            promise = new pc.promise.Promise(function (resolve, reject) {
                pc.net.http.get(request.canonical, function(response) {
                    if (response.mapping_format === "path") {
                        var referencedAssets = this._listReferencedAssets(response);
                        var assets = [];

                        if (referencedAssets.length) {
                            // Create and load all referenced assets
                            referencedAssets.forEach(function (referencedAsset) {
                                var path = referencedAsset.data;
                                var filename = pc.path.getBasename(path);
                                var url = pc.path.join(pc.path.split(request.canonical)[0], path);
                                assets.push(new pc.asset.Asset(filename, referencedAsset.type, {
                                    url: url
                                }));
                            });

                            this._assets.load(assets).then(function (responses) {
                                // Only when referenced assets are loaded do we resolve the material load
                                resolve(response);
                            });
                        } else {
                            resolve(response);
                        }
                    } else {
                        resolve(response);
                    }

                }.bind(this), {
                    error: function () {
                        reject();
                    }
                });
            }.bind(this));
        }

        return promise;
    };

    MaterialResourceHandler.prototype.open = function (data, request, options) {
        var material = new pc.scene.PhongMaterial();
        this._updatePhongMaterial(material, data, request);

        var asset = this._getAssetFromRequest(request);

        asset.on('change', function (asset, attribute, value) {
            if (attribute === 'data') {
                this._updatePhongMaterial(material, value);
            }
        }, this);

        return material;
    };

    MaterialResourceHandler.prototype._listReferencedAssets = function (data) {
        // Get all asset parameters from the material
        var i, n = data.parameters.length;
        var param;
        var results = [];

        return data.parameters.filter(function (param) {
            return (param.type === 'texture' || param.type === 'cubemap') && param.data;
        });
    };

    MaterialResourceHandler.prototype._updatePhongMaterial = function (material, data, request) {
        var requests = [];

        // Replace texture ids with actual textures
        // Should we copy 'data' here instead of updating in place?
        for (var i = 0; i < data.parameters.length; i++) {
            var param = data.parameters[i];
            if (param.type === 'texture' && param.data && !(param.data instanceof pc.gfx.Texture)) {
                this._loadTextureParam(param, request);
            } else if (param.type === 'cubemap' && param.data && !(param.data instanceof pc.gfx.Texture)) {
                var cubemapAsset = this._getTextureAssetFromRegistry(param.data, request);
                this._loadCubemapParamFromCache(param, cubemapAsset);
                if (!(param.data instanceof pc.gfx.Texture) && cubemapAsset) {
                    requests.push(this._loadCubemapParamPromise(param, cubemapAsset));
                }
            }
        }

        if (requests.length) {
            pc.promise.all(requests).then(function () {
                material.init(data);
            }, function (error) {
                pc.log.error(error);
                material.init(data);
            });
        } else {
            material.init(data);
        }

    };

    MaterialResourceHandler.prototype._getTextureAssetFromRegistry = function(textureId, request) {
        var asset = this._assets.getAssetById(textureId);
        if (!asset && request) {
            url = pc.path.join(pc.path.split(request.canonical)[0], textureId);
            asset = this._assets.getAssetByUrl(url);
        }

        return asset;
    };

    // Loads a texture asset and sets param.data to it
    MaterialResourceHandler.prototype._loadTextureParam = function(param, request) {
        var url;
        var textureId = param.data;

        param.data = null;

        var asset = this._getTextureAssetFromRegistry(textureId, request);

        if (asset) {
            if (asset.resource) {
                // Asset already loaded, use cached texture
                param.data = asset.resource;
            } else {
                // Asset needs to be loaded
                url = asset.getFileUrl();
                if (url) {
                    var textureData = asset.data;

                    var texture = this._assets.loader.getFromCache(url);
                    if (!texture) {
                        texture = new pc.gfx.Texture(this._device, {
                            format: pc.gfx.PIXELFORMAT_R8_G8_B8_A8
                        });

                        texture.name = textureData.name;
                        texture.addressU = jsonToAddressMode[textureData.addressu];
                        texture.addressV = jsonToAddressMode[textureData.addressv];
                        texture.magFilter = jsonToFilterMode[textureData.magfilter];
                        texture.minFilter = jsonToFilterMode[textureData.minfilter];
                    }

                    this._assets.load([asset], [texture], {});

                    param.data = texture;
                }
            }
        }
    };

    // Try to load a cubemap from the cache and set param.data to it.
    MaterialResourceHandler.prototype._loadCubemapParamFromCache = function(param, cubemapAsset) {
        if (cubemapAsset) {
            if (cubemapAsset.resource) {
                param.data = cubemapAsset.resource;
            }
        } else {
            pc.log.error(pc.string.format('Could not load cubemap. Asset {0} not found', param.data));
            param.data = null;
        }
    };

    // Return a promise which loads the cubemap asset and sets it to param.data if successful
    MaterialResourceHandler.prototype._loadCubemapParamPromise = function(param, cubemapAsset) {
        // Create new texture and set it to param.data so that the cubemap
        // resource loader will use the pre-existing texture instead of creating a new one.
        // That way if another request comes in at the same time for this parameter, it will
        // not create another load request but rather wait until this texture has finished loading.
        // (Useful in the Designer if the same material is loading multiple times simultaneously)
        param.data = new pc.gfx.Texture(this._device, {
            format: pc.gfx.PIXELFORMAT_R8_G8_B8,
            cubemap: true
        });

        return new pc.promise.Promise(function (resolve, reject) {
            this._assets.load([cubemapAsset], [param.data], {}).then(function (resources) {
                resolve();
            }, function (error) {
                param.data = null;
                reject(error);
            });
        }.bind(this));
    };

    MaterialResourceHandler.prototype._getAssetFromRequest = function (request) {
        if (pc.string.startsWith(request.canonical, "asset://")) {
            return this._assets.getAssetById(parseInt(request.canonical.slice(8)));
        } else {
            return this._assets.getAssetByUrl(request.canonical);
        }
    };

    /**
    * @param {String} identifier Either URL in format `asset://resource_id` to load material from data block, or regular path to load material from file (engine-only)
    */
    var MaterialRequest = function MaterialRequest(identifier) {
    };
    MaterialRequest = pc.inherits(MaterialRequest, pc.resources.ResourceRequest);
    MaterialRequest.prototype.type = "material";
    MaterialRequest.prototype.Type = pc.scene.Material;

    return {
        MaterialRequest: MaterialRequest,
        MaterialResourceHandler: MaterialResourceHandler
    };
}());
