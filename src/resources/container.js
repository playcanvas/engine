Object.assign(pc, function () {

    /**
     * @class
     * @name pc.ContainerResource
     * @classdesc Container for a list of animations, textures, materials and a model.
     * @param {object} data - The loaded GLB data.
     */
    var ContainerResource = function (data) {
        this.data = data;
        this.model = null;
        this.materials = [];
        this.textures = [];
        this.animations = [];
        this.registry = null;
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
     * @name pc.ContainerHandlerOptions
     * @description The supported {@link pc.Asset} options when loading container assets.
     * @property {pc.callbacks.ProcessAnimationCallback} [processAnimation] - The callback for animations with extras.
     * @property {pc.callbacks.ProcessMaterialCallback} [processMaterial] - The callback for materials with extras.
     */

    /**
     * @class
     * @name pc.ContainerHandler
     * @implements {pc.ResourceHandler}
     * @classdesc Loads files that contain in them multiple resources. For example glTF files can contain
     * textures, models and animations.
     * @param {pc.GraphicsDevice} device - The graphics device that will be rendering.
     * @param {pc.StandardMaterial} defaultMaterial - The shared default material that is used in any place that a material is not specified.
     */
    var ContainerHandler = function (device, defaultMaterial) {
        this._device = device;
        this._defaultMaterial = defaultMaterial;
    };

    Object.assign(ContainerHandler.prototype, {
        _getUrlWithoutParams: function (url) {
            return url.indexOf('?') >= 0 ? url.split('?')[0] : url;
        },

        load: function (url, callback, asset) {
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

            var self = this;

            pc.http.get(url.load, options, function (err, response) {
                if (!callback)
                    return;

                if (!err) {
                    pc.GlbParser.parseAsync(self._getUrlWithoutParams(url.original),
                                            pc.path.extractPath(url.load),
                                            response,
                                            self._device,
                                            asset.registry,
                                            asset.options,
                                            function (err, result) {
                                                if (err) {
                                                    callback(err);
                                                } else {
                                                    // return everything
                                                    callback(null, new ContainerResource(result));
                                                }
                                            });
                } else {
                    callback(pc.string.format("Error loading model: {0} [{1}]", url.original, err));
                }
            });
        },

        open: function (url, data, asset) {
            return data;
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

            // create animation assets
            var animations = [];
            for (i = 0; i < data.animations.length; ++i) {
                animations.push(createAsset('animation', data.animations[i], i));
            }

            container.data = null;              // since assets are created, release GLB data
            container.model = model;
            container.materials = materials;
            container.textures = data.textures; // texture assets are created directly
            container.animations = animations;
            container.registry = assets;
        }
    });

    return {
        ContainerResource: ContainerResource,
        ContainerHandler: ContainerHandler
    };
}());
