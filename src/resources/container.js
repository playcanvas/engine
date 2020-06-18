Object.assign(pc, function () {

    /**
     * @class
     * @name pc.ContainerResource
     * @classdesc Container for a list of animations, textures, materials, models, scenes (as entities)
     * and a default scene (as entity). Entities in scene hierarchies will have model and animation components
     * attached to them.
     * @param {object} data - The loaded GLB data.
     * @property {pc.Entity|null} scene The root entity of the default scene.
     * @property {pc.Entity[]} scenes The root entities of all scenes.
     * @property {pc.Asset[]} materials Material assets.
     * @property {pc.Asset[]} textures Texture assets.
     * @property {pc.Asset[]} animations Animation assets.
     * @property {pc.Asset[]} models Model assets.
     * @property {pc.AssetRegistry} registry The asset registry.
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
                this.scenes = null;
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
     * textures, scenes and animations.
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
                                            self._defaultMaterial,
                                            asset.registry,
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

        // Create assets to wrap the loaded engine resources - models, materials, textures and animations.
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

            // create animation assets
            var animationAssets = data.animations.map(function (animation, index) {
                return createAsset('animation', animation, index);
            });

            // texture assets are created in the parser
            var textureAssets = data.textures;

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
                    var anim = node.addComponent('anim');

                    // Create one layer per animation asset so that the animations can be played simultaneously
                    anim.loadStateGraph({
                        layers: components.animations.map(function (animationIndex) {
                            return {
                                name: animationAssets[animationIndex].resource.name,
                                states: [
                                    { name: pc.ANIM_STATE_START },
                                    { name: "LOOP", speed: 1, loop: true },
                                    { name: "LOOP_REVERSE", speed: -1, loop: true },
                                    { name: "ONCE", speed: 1, loop: false },
                                    { name: "ONCE_REVERSE", speed: -1, loop: false }
                                ],
                                transitions: []
                            };
                        }),
                        parameters: {}
                    });

                    components.animations.forEach(function (animationIndex) {
                        var layer = anim.findAnimationLayer(animationAssets[animationIndex].resource.name);
                        if (layer) {
                            layer.states.slice(1, layer.states.length).forEach(function (state) {
                                layer.assignAnimation(state, animationAssets[animationIndex].resource);
                            });

                            // This is currently the only public method to set the current state of a layer.
                            // By doing this the animation of a layer can be played by simply running layer.play()
                            // in an application.
                            layer.play("LOOP");
                            layer.pause();
                        }
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
