pc.extend(pc.resources, function () {

    function onTextureAssetRemoved (asset) {
        var material = this;
        asset.off('remove', onTextureAssetRemoved, material);

        if (!asset.resource)
            return;

        var dirty = false;
        for (var key in material) {
            if (material.hasOwnProperty(key) && !pc.string.startsWith(key, '_')) {
                if (material[key] === asset.resource) {
                    material[key] = null;
                    dirty = true;
                }
            }
        }

        if (dirty) {
            material.update();
        }
    }

    function onTextureAssetChanged (asset, attribute, newValue, oldValue) {
        if (attribute !== 'resource') {
            return;
        }

        var material = this;
        var dirty = false;

        if (oldValue) {
            for (var key in material) {
                if (material.hasOwnProperty(key) && !pc.string.startsWith(key, '_')) {
                    if (material[key] === oldValue) {
                        material[key] = newValue;
                        dirty = true;
                    }
                }
            }
        }

        if (dirty) {
            material.update();
        } else {
            asset.off('change', onTextureAssetChanged, material);
            asset.off('remove', onTextureAssetRemoved, material);
        }
    }

    function onCubemapRemoved (asset) {
        var material = this;
        asset.off('remove', onCubemapRemoved, material);

        if (!asset.resource)
            return;

        var dirty = false;
        if (material.cubeMap === asset.resources[0]) {
            material.cubeMap = null;
            dirty = true;
        }

        if (asset.resources.length > 1) {
            var mipSize = 128;
            for (var i = 1; i < asset.resources.length; i++) {
                var prop = 'prefilteredCubeMap' + mipSize;
                if (material[prop] === asset.resources[i]) {
                    material[prop] = null;
                    dirty = true;
                }
            }
        }

        if (dirty) {
            material.update();
        }
    }

    function onCubemapChanged (asset, attribute, newValue, oldValue) {
        if (attribute !== 'resources') {
            return;
        }

        var material = this;

        var dirty = false;
        if (material.cubeMap === oldValue[0]) {
            material.cubeMap = newValue[0];
            dirty = true;
        }

        var mipSize = 128;
        for (var i = 0; i < 6; i++) {
            var prop = 'prefilteredCubeMap' + mipSize;
            if (material[prop] === oldValue[i]) {
                material[prop] = newValue[i];
                dirty = true;
            }
        }

        if (dirty) {
            material.update();
        } else {
            asset.off('change', onCubemapChanged, material);
        }
    }

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
        var material = new pc.PhongMaterial();

        this._updatePhongMaterial(material, data, request);
        var asset = this._getAssetFromRequest(request);

        asset.on('change', function (asset, attribute, value) {
            if (attribute === 'data') {
                this._updatePhongMaterial(material, value, request);
            }
        }, this);

        return material;
    };

    MaterialResourceHandler.prototype._listReferencedAssets = function (data) {
        // Get all asset parameters from the material
        var param;

        return data.parameters.filter(function (param) {
            return (param.type === 'texture' || param.type === 'cubemap') && param.data;
        });
    };

    MaterialResourceHandler.prototype._updatePhongMaterial = function (material, data, request) {
        var requests = [];

        data.parameters.push({
            name: 'shadingModel',
            type: 'float',
            data: data.shader === 'blinn' ? pc.SPECULAR_BLINN : pc.SPECULAR_PHONG
        });

        var textures = [];

        var cubemapParam = null;

        // Replace texture ids with actual textures
        // Should we copy 'data' here instead of updating in place?
        for (var i = 0; i < data.parameters.length; i++) {
            var param = data.parameters[i];
            if (param.type === 'texture' && param.data && !(param.data instanceof pc.Texture)) {
                var textureAsset = this._getTextureAssetFromRegistry(param.data, request);
                if (textureAsset) {
                    textures.push(textureAsset);
                }

                this._loadTextureParamFromCache(param, textureAsset);
                if (!(param.data instanceof pc.Texture) && textureAsset) {
                    requests.push(this._loadTextureParamPromise(param, textureAsset));
                }
            } else if (param.name === 'cubeMap' && param.data) {
                cubemapParam = param;
            }
        }

        // Cubemap parameter is more complicated so load it separately
        if (cubemapParam) {
            var cubemapAsset = this._getTextureAssetFromRegistry(cubemapParam.data, request);
            if (cubemapAsset) {
                if (cubemapAsset.resources.length) {
                    // set plain cubemap to param.data
                    cubemapParam.data = cubemapAsset.resources[0];

                    // add new params for prefiltered cubemaps
                    if (cubemapAsset.resources.length > 1) {
                        var mipSize = 128;
                        for (var i = 0; i < 6; i++) {
                            data.parameters.push({
                                name: 'prefilteredCubeMap' + mipSize,
                                data: cubemapAsset.resources[i+1]
                            });

                            mipSize *= 0.5;
                        }
                    }
                } else {
                    // load
                    requests.push(this._assets.load(cubemapAsset).then(function (resources) {
                        var cubemaps = resources[0];

                        // set plain cubemap to param.data
                        cubemapParam.data = cubemaps[0];

                        // add new params for prefiltered cubemaps
                        if (cubemaps.length > 1) {
                            var mipSize = 128;
                            for (var i = 0; i < 6; i++) {
                                data.parameters.push({
                                    name: 'prefilteredCubeMap' + mipSize,
                                    data: cubemaps[i+1]
                                });

                                mipSize *= 0.5;
                            }
                        }
                    }, function (error) {
                        cubemapParam.data = null;
                    }));
                }

                // attach change / remove handlers to the cubemap asset
                cubemapAsset.off('change', onCubemapChanged, material);
                cubemapAsset.on('change', onCubemapChanged, material);

                cubemapAsset.off('remove', onCubemapRemoved, material);
                cubemapAsset.on('remove', onCubemapRemoved, material);
            } else {
                pc.log.error(pc.string.format('Could not load cubemap. Asset {0} not found', cubemapParam.data));
                cubemapParam.data = null;
            }
        }

        // TODO: move this inside the loop
        textures.forEach(function (textureAsset) {
            textureAsset.off('change', onTextureAssetChanged, material);
            textureAsset.on('change', onTextureAssetChanged, material);

            textureAsset.off('remove', onTextureAssetRemoved, material);
            textureAsset.on('remove', onTextureAssetRemoved, material);

        });

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

    MaterialResourceHandler.prototype._loadTextureParamFromCache = function(param, textureAsset) {
        if (textureAsset) {
            if (textureAsset.resource) {
                param.data = textureAsset.resource;
            }
        } else {
            pc.log.error(pc.string.format('Could not load texture. Asset {0} not found', param.data));
            param.data = null;
        }
    };

    MaterialResourceHandler.prototype._loadTextureParamPromise = function(param, textureAsset) {
        return this._assets.load(textureAsset).then(function (resources) {
            param.data = resources[0];
        }, function (error) {
            param.data = null;
        });
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
    MaterialRequest.prototype.Type = pc.Material;

    return {
        MaterialRequest: MaterialRequest,
        MaterialResourceHandler: MaterialResourceHandler
    };
}());
