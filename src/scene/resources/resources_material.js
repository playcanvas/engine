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
                        var textures = this._listTextures(response);
                        var assets = [];

                        if (textures.length) {
                            // Create and load all texture assets
                            textures.forEach(function (texturePath) {
                                var filename = pc.path.getBasename(texturePath);
                                var textureUrl = pc.path.join(pc.path.split(request.canonical)[0], texturePath);
                                assets.push(new pc.asset.Asset(filename, "texture", {
                                    url: textureUrl
                                }));
                            });

                            this._assets.load(assets).then(function (responses) {
                                // Only when texture assets are loaded do we resolve the material load
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

    MaterialResourceHandler.prototype._listTextures = function (data) {
        // Get all texture data parameters from the material
        var i, n = data.parameters.length;
        var param;
        var textures = [];

        for (i = 0; i < n; i++) {
            param = data.parameters[i];
            if (param.type === 'texture' && param.data) {
                textures.push(param.data);
            }
        }

        return textures;
    };

    MaterialResourceHandler.prototype._updatePhongMaterial = function (material, data, request) {
        // Replace texture ids with actual textures
        // Should we copy 'data' here instead of updating in place?
        for (var i = 0; i < data.parameters.length; i++) {
            var param = data.parameters[i];
            if (param.type === 'texture' && param.data && !(param.data instanceof pc.gfx.Texture)) {
                param.data = this._loadTexture(param.data, request);
            }
        }

        material.init(data);
    };

    MaterialResourceHandler.prototype._loadTexture = function(textureId, request) {
        var asset = this._assets.getAssetById(textureId);
        if (!asset) {
            var url = pc.path.join(pc.path.split(request.canonical)[0], textureId);
            asset = this._assets.getAssetByUrl(url);
        }
        if (!asset) {
            return null;
        }

        // Asset already loaded, use cached texture
        if (asset.resource) {
            return asset.resource;
        }

        var url = asset.getFileUrl();
        if (!url) {
            return null;
        }

        var textureData = asset.data;

        var texture = this._assets.loader.getFromCache(url);
        if (!texture) {
            var texture = new pc.gfx.Texture(this._device, {
                format: pc.gfx.PIXELFORMAT_R8_G8_B8_A8
            });

            texture.name = textureData.name;
            texture.addressU = jsonToAddressMode[textureData.addressu];
            texture.addressV = jsonToAddressMode[textureData.addressv];
            texture.magFilter = jsonToFilterMode[textureData.magfilter];
            texture.minFilter = jsonToFilterMode[textureData.minfilter];
        }

        this._assets.load([asset], [texture], {});

        return texture;
    };

    MaterialResourceHandler.prototype._getAssetFromRequest = function (request) {
        if (pc.string.startsWith(request.canonical, "asset://")) {
            return this._assets.getAssetById(parseInt(request.canonical.slice(8)))
        } else {
            return this._assets.getAssetByUrl(request.canonical);
        }
    }

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
