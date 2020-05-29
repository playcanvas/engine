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
                    pc.GlbParser.parseAsync(filename, pc.path.extractPath(url.original), response, self._device, self._defaultMaterial, function (err, result) {
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
                    var anim = node.addComponent('anim', {
                        enabled: false
                    });

                    var ANIM_STATE_ACTIVE = 'ACTIVE';

                    var animLayers = components.animations.map(function (animationIndex) {
                        return {
                            name: animationAssets[animationIndex].resource.name,
                            states: [
                                { name: pc.ANIM_STATE_START },
                                { name: ANIM_STATE_ACTIVE }
                            ],
                            transitions: [],
                            parameters: {}
                        };
                    });

                    anim.loadStateGraph({ layers: animLayers });

                    components.animations.forEach(function (animationIndex) {
                        var layer = anim.findAnimationLayer(animationAssets[animationIndex].resource.name);
                        if (!layer) {
                            return;
                        }
                        layer.assignAnimation(ANIM_STATE_ACTIVE, animationAssets[animationIndex].resource);
                        layer.play(ANIM_STATE_ACTIVE);
                    });

                    console.log(anim);
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
