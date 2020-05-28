Object.assign(pc, function () {

    /**
     * @class
     * @name pc.ContainerResource
     * @classdesc Container for a list of animations, textures, materials and a model.
     * @param {object} data - The loaded GLB data.
     */
    var ContainerResource = function (data) {
        this.data = data;
        this.scene = null;
        this.scenes = [];
        this.materials = [];
        this.textures = [];
        this.animations = [];
        this.models = [];
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
                assets.forEach(destroyAsset);
            };

            // unload and destroy assets
            if (this.scene) {
                this.scene.destroy();
                this.scene = null;
            }

            if (this.scenes) {
                this.scenes.forEach(function (scene) {
                    scene.destroy();
                });
            }

            if (this.animations) {
                destroyAssets(this.animations);
                this.animations = null;
            }

            if (this.models) {
                destroyAssets(this.models);
                this.models = null;
            }

            if (this.textures) {
                destroyAssets(this.textures);
                this.textures = null;
            }

            if (this.materials) {
                destroyAssets(this.materials);
                this.materials = null;
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
                    var filename = (asset.file && asset.file.filename) ? asset.file.filename : asset.name;
                    pc.GlbParser.parseAsync(filename, pc.path.extractPath(url.original), response, self._device, function (err, result) {
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

            // create model assets
            var modelAssets = data.models.map(function (model, index) {
                return createAsset('model', model, index);
            });

            // create material assets
            var materialAssets = data.materials.map(function (material, index) {
                return createAsset('material', material, index);
            });

            // create texture assets
            var textureAssets = data.textures.map(function (texture, index) {
                return createAsset('texture', texture, index);
            });

            // create animation assets
            var animationAssets = data.animations.map(function (animation, index) {
                return createAsset('animation', animation, index);
            });

            // add components to nodes
            data.nodes.forEach(function (node, nodeIndex) {
                var components = data.nodeComponents[nodeIndex];

                if (components.model !== null) {
                    node.addComponent('model', {
                        type: 'asset',
                        asset: modelAssets[components.model]
                    });
                }

                if (components.animations.length > 0) {
                    node.addComponent('animation', {
                        assets: components.animations.map(function (animationIndex) {
                            return animationAssets[animationIndex].id;
                        }),
                        enabled: false
                    });
                }
            });

            // since assets are created, release GLB data
            container.data = null;
            delete container.data;

            container.scene = data.scene;
            container.scenes = data.scenes;
            container.materials = materialAssets;
            container.textures = textureAssets;
            container.animations = animationAssets;
            container.models = modelAssets;
            container.registry = assets;
        }
    });

    return {
        ContainerResource: ContainerResource,
        ContainerHandler: ContainerHandler
    };
}());
