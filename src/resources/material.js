Object.assign(pc, function () {
    'use strict';

    var PLACEHOLDER_MAP = {
        aoMap: 'white',
        diffuseMap: 'gray',
        specularMap: 'gray',
        metalnessMap: 'black',
        glossMap: 'gray',
        emissiveMap: 'gray',
        normalMap: 'normal',
        heightMap: 'gray',
        opacityMap: 'gray',
        sphereMap: 'gray',
        lightMap: 'white'
    };

    var MaterialHandler = function (app) {
        this._assets = app.assets;
        this._device = app.graphicsDevice;

        this._placeholderTextures = null;

        this._parser = new pc.JsonStandardMaterialParser();
        this.retryRequests = false;
    };

    Object.assign(MaterialHandler.prototype, {
        load: function (url, callback) {
            if (typeof url === 'string') {
                url = {
                    load: url,
                    original: url
                };
            }

            // Loading from URL (engine-only)
            pc.http.get(url.load, {
                retry: this.retryRequests
            }, function (err, response) {
                if (!err) {
                    if (callback) {
                        response._engine = true;
                        callback(null, response);
                    }
                } else {
                    if (callback) {
                        callback(pc.string.format("Error loading material: {0} [{1}]", url.original, err));
                    }
                }
            });
        },

        open: function (url, data) {
            var material = this._parser.parse(data);

            // temp storage for engine-only as we need this during patching
            if (data._engine) {
                material._data = data;
                delete data._engine;
            }

            return material;
        },

        // creates placeholders for textures
        // that are used while texture is loading
        _createPlaceholders: function () {
            this._placeholderTextures = {};

            var textures = {
                white: [255, 255, 255, 255],
                gray: [128, 128, 128, 255],
                black: [0, 0, 0, 255],
                normal: [128, 128, 255, 255]
            };

            for (var key in textures) {
                if (!textures.hasOwnProperty(key))
                    continue;

                // create texture
                this._placeholderTextures[key] = new pc.Texture(this._device, {
                    width: 2,
                    height: 2,
                    format: pc.PIXELFORMAT_R8_G8_B8_A8
                });
                this._placeholderTextures[key].name = 'placeholder';

                // fill pixels with color
                var pixels = this._placeholderTextures[key].lock();
                for (var i = 0; i < 4; i++) {
                    for (var c = 0; c < 4; c++) {
                        pixels[i * 4 + c] = textures[key][c];
                    }
                }
                this._placeholderTextures[key].unlock();
            }
        },

        patch: function (asset, assets) {
            // in an engine-only environment we manually copy the source data into the asset
            if (asset.resource._data) {
                asset._data = asset.resource._data; // use _data to avoid firing events
                delete asset.resource._data; // remove from temp storage
            }

            // patch the name of the asset over the material name property
            asset.data.name = asset.name;
            asset.resource.name = asset.name;

            this._bindAndAssignAssets(asset, assets);

            asset.off('unload', this._onAssetUnload, this);
            asset.on('unload', this._onAssetUnload, this);
        },

        _onAssetUnload: function (asset) {
            // remove the parameter block we created which includes texture references
            delete asset.data.parameters;
            delete asset.data.chunks;
            delete asset.data.name;
        },

        _assignTexture: function (parameterName, materialAsset, texture) {
            materialAsset.data[parameterName] = texture;
            materialAsset.resource[parameterName] = texture;
        },

        // assign a placeholder texture while waiting for one to load
        // placeholder textures do not replace the data[parameterName] value
        // in the asset.data thus preserving the final asset id until it is loaded
        _assignPlaceholderTexture: function (parameterName, materialAsset) {
            // create placeholder textures on-demand
            if (!this._placeholderTextures) {
                this._createPlaceholders();
            }

            var placeholder = PLACEHOLDER_MAP[parameterName];
            var texture = this._placeholderTextures[placeholder];

            materialAsset.resource[parameterName] = texture;
        },

        _onTextureLoad: function (parameterName, materialAsset, textureAsset) {
            this._assignTexture(parameterName, materialAsset, textureAsset.resource);
            materialAsset.resource.update();
        },

        _onTextureAdd: function (parameterName, materialAsset, textureAsset) {
            this._assets.load(textureAsset);
        },

        _onTextureRemove: function (parameterName, materialAsset, textureAsset) {
            var material = materialAsset.resource;

            if (material[parameterName] === textureAsset.resource) {
                this._assignTexture(parameterName, materialAsset, null);
                material.update();
            }
        },

        _assignCubemap: function (parameterName, materialAsset, textures) {
            materialAsset.data[parameterName] = textures[0]; // the primary cubemap texture
            if (textures.length === 7) {
                // the prefiltered textures
                materialAsset.data.prefilteredCubeMap128 = textures[1];
                materialAsset.data.prefilteredCubeMap64 = textures[2];
                materialAsset.data.prefilteredCubeMap32 = textures[3];
                materialAsset.data.prefilteredCubeMap16 = textures[4];
                materialAsset.data.prefilteredCubeMap8 = textures[5];
                materialAsset.data.prefilteredCubeMap4 = textures[6];
            }
        },

        _onCubemapLoad: function (parameterName, materialAsset, cubemapAsset) {
            this._assignCubemap(parameterName, materialAsset, cubemapAsset.resources);
            this._parser.initialize(materialAsset.resource, materialAsset.data);
        },

        _onCubemapAdd: function (parameterName, materialAsset, cubemapAsset) {
            // phong based - so ensure we load individual faces
            if (materialAsset.data.shadingModel === pc.SPECULAR_PHONG) {
                materialAsset.loadFaces = true;
            }

            this._assets.load(cubemapAsset);
        },

        _onCubemapRemove: function (parameterName, materialAsset, cubemapAsset) {
            var material = materialAsset.resource;

            if (material[parameterName] === cubemapAsset.resource) {
                this._assignCubemap(parameterName, materialAsset, [null, null, null, null, null, null, null]);
                material.update();
            }
        },

        _bindAndAssignAssets: function (materialAsset, assets) {
            // always migrate before updating material from asset data
            var data = this._parser.migrate(materialAsset.data);

            var material = materialAsset.resource;

            var pathMapping = (data.mappingFormat === "path");

            var TEXTURES = pc.StandardMaterial.TEXTURE_PARAMETERS;

            // texture paths are measured from the material directory
            var dir;
            if (pathMapping) {
                dir = pc.path.getDirectory(materialAsset.getFileUrl());
            }

            var i, name, assetReference;
            // iterate through all texture parameters
            for (i = 0; i < TEXTURES.length; i++) {
                name = TEXTURES[i];

                assetReference = material._assetReferences[name];

                // data[name] contains an asset id for a texture
                if (data[name] && !(data[name] instanceof pc.Texture)) {
                    if (!assetReference) {
                        assetReference = new pc.AssetReference(name, materialAsset, assets, {
                            load: this._onTextureLoad,
                            add: this._onTextureAdd,
                            remove: this._onTextureRemove
                        }, this);

                        material._assetReferences[name] = assetReference;
                    }

                    if (pathMapping) {
                        assetReference.url = pc.path.join(dir, data[name]);
                    } else {
                        assetReference.id = data[name];
                    }

                    if (assetReference.asset) {
                        if (assetReference.asset.resource) {
                            // asset is already loaded
                            this._assignTexture(name, materialAsset, assetReference.asset.resource);
                        } else {
                            this._assignPlaceholderTexture(name, materialAsset);
                        }

                        assets.load(assetReference.asset);
                    }
                } else {
                    if (assetReference) {
                        // texture has been removed
                        if (pathMapping) {
                            assetReference.url = null;
                        } else {
                            assetReference.id = null;
                        }
                    } else {
                        // no asset reference and no data field
                        // do nothing
                    }
                }
            }

            var CUBEMAPS = pc.StandardMaterial.CUBEMAP_PARAMETERS;

            // iterate through all cubemap parameters
            for (i = 0; i < CUBEMAPS.length; i++) {
                name = CUBEMAPS[i];

                assetReference = material._assetReferences[name];

                // data[name] contains an asset id for a cubemap
                if (data[name] && !(data[name] instanceof pc.Texture)) {
                    if (!assetReference) {
                        assetReference = new pc.AssetReference(name, materialAsset, assets, {
                            load: this._onCubemapLoad,
                            add: this._onCubemapAdd,
                            remove: this._onCubemapRemove
                        }, this);

                        material._assetReferences[name] = assetReference;
                    }

                    if (pathMapping) {
                        assetReference.url = data[name];
                    } else {
                        assetReference.id = data[name];
                    }

                    if (assetReference.asset) {
                        if (assetReference.asset.resource) {
                            // asset loaded
                            this._assignCubemap(name, materialAsset, assetReference.asset.resources);
                        }

                        assets.load(assetReference.asset);
                    }
                }


            }

            // call to re-initialize material after all textures assigned
            this._parser.initialize(material, data);
        }
    });

    return {
        MaterialHandler: MaterialHandler
    };
}());
