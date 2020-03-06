Object.assign(pc, function () {

    /**
     * @class
     * @name pc.ContainerResource
     * @classdesc Container for a list of animations, textures and a model.
     * @param {Object} data - The loaded GLB data.
     */
    var ContainerResource = function (data) {
        this.data = data;
    };

    Object.assign(ContainerResource.prototype, {
        destroy: function () {

            var registry = this.registry;

            var destroyAsset = function (asset) {
                registry.remove(asset);
                asset.unload();
            };

            var destroyAssets = function (assets) {
                assets.forEach(function (asset) {
                    destroyAsset(asset);
                });
            };

            // unload and destroy assets
            if (this.animations) {
                destroyAssets(this.animations);
                this.animations = null;
            }

            if (this.textures) {
                destroyAssets(this.textures);
                this.textures = null;
            }

            if (this.materials) {
                destroyAssets(this.materials);
                this.materials = null;
            }

            if (this.model) {
                destroyAsset(this.model);
                this.model = null;
            }

            this.data = null;
            this.assets = null;
        }
    });

    /**
     * @class
     * @name pc.ContainerHandler
     * @implements {pc.ResourceHandler}
     * @classdesc Loads files that contain in them multiple resources. For example GLB files which can contain
     * textures, models and animations.
     * @param {pc.GraphicsDevice} device - The graphics device that will be rendering.
     * @param {pc.StandardMaterial} defaultMaterial - The shared default material that is used in any place that a material is not specified.
     */
    var ContainerHandler = function (device, defaultMaterial) {
        this._device = device;
        this._defaultMaterial = defaultMaterial;
    };

    Object.assign(ContainerHandler.prototype, {
        load: function (url, callback) {
            if (typeof url === 'string') {
                url = {
                    load: url,
                    original: url
                };
            }

            var options = {
                responseType: pc.Http.ResponseType.ARRAY_BUFFER,
                retry: false
            };

            pc.http.get(url.load, options, function (err, response) {
                if (!callback)
                    return;

                if (!err) {
                    callback(null, response);
                } else {
                    callback(pc.string.format("Error loading model: {0} [{1}]", url.original, err));
                }
            });
        },

        openAsync: function (url, data, asset, callback) {
            pc.GlbParser.parse(data, this._device, function (err, result) {
                if (err) {
                    callback(err);
                } else {
                    // return everything
                    callback(null, new ContainerResource(result));
                }
            });
            return true;
        },

        // Create assets to wrap the loaded engine resources - model, materials, textures and animations.
        patch: function (asset, assets) {
            var createAsset = function (type, resource, index) {
                var subAsset = new pc.Asset(asset.name + '/' + type + '/' + index, type, {
                    url: ''
                });
                subAsset.resource = resource;
                subAsset.loaded = true;
                assets.add(subAsset);
                return subAsset;
            };

            var container = asset.resource;
            var data = container.data;
            var i;

            // create model asset
            var model = createAsset('model', pc.GlbParser.createModel(data, this._defaultMaterial), 0);

            // create material assets
            var materials = [];
            for (i = 0; i < data.materials.length; ++i) {
                materials.push(createAsset('material', data.materials[i], i));
            }

            // create texture assets
            var textures = [];
            for (i = 0; i < data.textures.length; ++i) {
                textures.push(createAsset('texture', data.textures[i], i));
            }

            // create animation assets
            var animations = [];
            for (i = 0; i < data.animations.length; ++i) {
                animations.push(createAsset('animation', data.animations[i], i));
            }

            container.data = null;              // since assets are created, release GLB data
            container.model = model;
            container.materials = materials;
            container.textures = textures;
            container.animations = animations;
            container.registry = assets;
        }
    });

    return {
        ContainerHandler: ContainerHandler
    };
}());
