pc.extend(pc.resources, function () {

    function onTextureAssetChanged (asset, attribute, newValue, oldValue) {
        if (attribute !== 'resource') {
            return;
        }

        var material = this;
        var dirty = false;

        if (oldValue) {
            for (var key in material) {
                if (material.hasOwnProperty(key)) {
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
        var material = new pc.scene.PhongMaterial();

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
            data: data.shader === 'blinn' ? pc.scene.SPECULAR_BLINN : pc.scene.SPECULAR_PHONG
        });

        var textures = {};

        // Replace texture ids with actual textures
        // Should we copy 'data' here instead of updating in place?
        for (var i = 0; i < data.parameters.length; i++) {
            var param = data.parameters[i];
            if (param.type === 'texture' && param.data && !(param.data instanceof pc.gfx.Texture)) {
                var textureAsset = this._getTextureAssetFromRegistry(param.data, request);
                if (textureAsset) {
                    textures[textureAsset.id] = textureAsset;
                }

                this._loadTextureParamFromCache(param, textureAsset);
                if (!(param.data instanceof pc.gfx.Texture) && textureAsset) {
                    requests.push(this._loadTextureParamPromise(param, textureAsset));
                }
            } else if (param.type === 'cubemap' && param.data && !(param.data instanceof pc.gfx.Texture)) {
                var cubemapAsset = this._getTextureAssetFromRegistry(param.data, request);
                this._loadCubemapParamFromCache(param, cubemapAsset);
                if (!(param.data instanceof pc.gfx.Texture) && cubemapAsset) {
                    requests.push(this._loadCubemapParamPromise(param, cubemapAsset));
                }
            }
        }

        for (var id in textures) {
            textures[id].off('change', onTextureAssetChanged, material);
            textures[id].on('change', onTextureAssetChanged, material);
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
        return this._assets.load(cubemapAsset).then(function (resources) {
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
    MaterialRequest.prototype.Type = pc.scene.Material;

    return {
        MaterialRequest: MaterialRequest,
        MaterialResourceHandler: MaterialResourceHandler
    };
}());
