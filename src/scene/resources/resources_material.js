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

    var materialCache = {};

    var MaterialResourceLoader = function (device, assetRegistry) {
        this._device = device;
        this._assets = assetRegistry;
    };

    MaterialResourceLoader.prototype.load = function (materialOrName) {
        if (!materialCache[materialOrName]) {
            var material = new pc.scene.PhongMaterial();
            var asset = this._assets.getAssetByResourceId(materialOrName);
            if (!asset) {
                asset = this._assets.find(materialOrName);
            }

            if (asset) {
                var materialData = asset.data;
                this._updatePhongMaterial(material, asset.data);

                // When running in the tools listen for change events on the asset so we can update the material
                asset.on('change', function (asset, attribute, value) {
                    if (attribute === 'data') {
                        this._updatePhongMaterial(material, value);
                    }
                }, this);
            }

            materialCache[materialOrName] = material;
        }

        return materialCache[materialOrName];
    };

    // Copy asset data into material
    MaterialResourceLoader.prototype._updatePhongMaterial = function (material, data) {
        // Replace texture ids with actual textures
        // Should we copy 'data' here instead of updating in place?
        for (var i = 0; i < data.parameters.length; i++) {
            var param = data.parameters[i];
            if (param.type === 'texture' && param.data && !(param.data instanceof pc.gfx.Texture)) {
                param.data = this._loadTexture(param.data);
            }
        }

        material.init(data);
    };

    MaterialResourceLoader.prototype._loadTexture = function(textureId) {
        var asset = this._assets.getAssetByResourceId(textureId);
        if (!asset) {
            return null;
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

    var MaterialResourceHandler = function (assets) {
        this._assets = assets;
    };
    MaterialResourceHandler = pc.inherits(MaterialResourceHandler, pc.resources.ResourceHandler);

    MaterialResourceHandler.prototype.load = function (request, options) {
        // Used to load material data from a file (as opposed to from an asset)
        var promise = new RSVP.Promise(function (resolve, reject) {
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

        return promise;
    };

    MaterialResourceHandler.prototype.open = function (data, request, options) {
        var material = new pc.scene.PhongMaterial();
        this._updatePhongMaterial(material, data, request);
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
        var asset = this._assets.getAssetByResourceId(textureId);
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

    var MaterialRequest = function MaterialRequest(identifier) {
    };
    MaterialRequest = pc.inherits(MaterialRequest, pc.resources.ResourceRequest);
    MaterialRequest.prototype.type = "material";
    MaterialRequest.prototype.Type = pc.scene.Material;

    return {
        MaterialResourceLoader: MaterialResourceLoader,
        MaterialRequest: MaterialRequest,
        MaterialResourceHandler: MaterialResourceHandler
    };
}());
