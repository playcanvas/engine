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

    this.materialCache = {};

    var MaterialResourceLoader = function (device, assetRegistry) {
        this._device = device;
        this._assets = assetRegistry;
    };

    MaterialResourceLoader.prototype.load = function (materialId) {
        if (!materialCache[materialId]) {

            var material = new pc.scene.PhongMaterial();
            
            var asset = this._assets.getAssetByResourceId(materialId);
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

            materialCache[materialId] = material;
        
        }

        return materialCache[materialId];
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

    return {
        MaterialResourceLoader: MaterialResourceLoader
    };
}());