pc.extend(pc, function () {
    /**
     * @component
     * @name pc.ModelComponent
     * @constructor Create a new ModelComponentSystem
     * @class Enables an Entity to render a model or a primitive shape. This Component attaches additional model geometry in to the scene graph below the Entity.
     * @param {pc.ModelComponentSystem} system The ComponentSystem that created this Component
     * @param {pc.Entity} entity The Entity that this Component is attached to.
     * @extends pc.Component
     * @property {String} type The type of the model, which can be one of the following values:
     * <ul>
     *     <li>asset: The component will render a model asset</li>
     *     <li>box: The component will render a box</li>
     *     <li>capsule: The component will render a capsule</li>
     *     <li>cone: The component will render a cone</li>
     *     <li>cylinder: The component will render a cylinder</li>
     *     <li>sphere: The component will render a sphere</li>
     * </ul>
     * @property {Boolean} enabled Enable or disable rendering of the Model
     * @property {Number} asset The id of the asset for the model (only applies to models of type 'asset')
     * @property {Boolean} castShadows If true, this model will cast shadows for lights that have shadow casting enabled.
     * @property {Boolean} receiveShadows If true, shadows will be cast on this model
     * @property {Number} materialAsset The material {@link pc.Asset} that will be used to render the model (not used on models of type 'asset')
     * @property {pc.Model} model The model that is added to the scene graph.
     */
    var ModelComponent = function ModelComponent (system, entity)   {
        this.on("set_type", this.onSetType, this);
        this.on("set_asset", this.onSetAsset, this);
        this.on("set_castShadows", this.onSetCastShadows, this);
        this.on("set_model", this.onSetModel, this);
        this.on("set_receiveShadows", this.onSetReceiveShadows, this);
        this.on("set_material", this.onSetMaterial, this);

        // override materialAsset property to return a pc.Asset instead
        Object.defineProperty(this, 'materialAsset', {
            set: this.setMaterialAsset.bind(this),
            get: this.getMaterialAsset.bind(this)
        });

        this._onAssetChange = function () {}; // no-op function (don't use null...)
    };
    ModelComponent = pc.inherits(ModelComponent, pc.Component);

    pc.extend(ModelComponent.prototype, {
        setVisible: function (visible) {
            console.warn("WARNING: setVisible: Function is deprecated. Set enabled property instead.");
            this.enabled = visible;
        },

        _setModelAsset: function (id) {
            var self = this;
            var assets = this.system.app.assets;
            var asset = assets.get(id);

            if (asset) {
                asset.ready(function (asset) {
                    var model = asset.resource.clone();
                    asset.off('change', this._onAssetChange, this); // do not subscribe multiple times
                    // Create a new function for each model clone
                    this._onAssetChange = function (asset, attribute, newValue, oldValue) {
                        if (attribute === 'file') {
                            // TODO: this is fired twice for every file, once by the messenger
                            // TODO: this is fired when the mapping changes because it changes the hash
                            asset.unload();
                            self.system.app.loader.clearCache(asset.file.url, asset.type);
                            self._setModelAsset(asset.id);
                        }

                        if (attribute === 'data') {
                            // mapping has changed
                            var a = {
                                resource: model,
                                data: asset.data,
                                type: "model"
                            }
                            self.system.app.loader.patch(a, self.system.app.assets);
                        }
                    };
                    asset.on('change', this._onAssetChange, this);
                    this._onModelLoaded(model);
                }.bind(this));
                assets.load(asset);
            } else {
                assets.once("add:" + id, function (asset) {
                    asset.ready(function (asset) {
                        asset.off('change', this._onAssetChange, this); // do not subscribe multiple times

                        // Create a new function for each model clone
                        this._onAssetChange = function (asset, attribute, newValue, oldValue) {
                            if (attribute === 'file') {
                                // TODO: this is fired twice for every file, once by the messenger
                                // TODO: this is fired when the mapping changes because it changes the hash
                                asset.unload(); // mark asset as unloaded
                                self.system.app.loader.clearCache(asset.file.url, asset.type); // remove existing model from cache
                                self._setModelAsset(asset.id); // trigger load again
                            }

                            if (attribute === 'data') {
                                // mapping has changed
                                var a = {
                                    resource: model,
                                    data: asset.data,
                                    type: "model"
                                }
                                self.system.app.loader.patch(a, self.system.app.assets);
                            }
                        }
                        asset.on('change', this._onAssetChange, this);

                        var model = asset.resource.clone();
                        this._onModelLoaded(model);
                    }.bind(this));
                    assets.load(asset);
                }, this);
            }
        },

        _onModelLoaded: function (model) {
            if (this.system._inTools) {
                model.generateWireframe();
            }

            if (this.data.type === 'asset') {
                this.model = model;
            }
        },

        /**
         * @function
         * @private
         * @name pc.ModelComponent#onSetType
         * @description Handle changes to the 'type' variable
         */
        onSetType: function (name, oldValue, newValue) {
            var data = this.data;

            if (newValue) {
                var mesh = null;

                if (newValue === 'asset') {
                    if (this.data.asset !== null) {
                        this._setModelAsset(this.data.asset);
                    } else {
                        this.model = null;
                    }
                } else {
                    switch (newValue) {
                        case 'box':
                            mesh = this.system.box;
                            break;
                        case 'capsule':
                            mesh = this.system.capsule;
                            break;
                        case 'sphere':
                            mesh = this.system.sphere;
                            break;
                        case 'cone':
                            mesh = this.system.cone;
                            break;
                        case 'cylinder':
                            mesh = this.system.cylinder;
                            break;
                        case 'plane':
                            mesh = this.system.plane;
                            break;
                        default:
                            throw new Error("Invalid model type: " + newValue);
                    }

                    var node = new pc.GraphNode();

                    var model = new pc.Model();
                    model.graph = node;

                    model.meshInstances = [ new pc.MeshInstance(node, mesh, data.material) ];

                    if (this.system._inTools) {
                        model.generateWireframe();
                    }

                    this.model = model;
                    this.asset = null;
                }
            }
        },

        onSetAsset: function (name, oldValue, newValue) {
            if (oldValue) {
                // Remove old listener
                var asset = this.system.app.assets.get(oldValue);
                if (asset) {
                    asset.off('change', this.onAssetChange, this);
                    asset.off('remove', this.onAssetRemoved, this);
                }
            }

            if (this.data.type === 'asset') {
                if (newValue) {
                    if (newValue instanceof pc.Asset) {
                        this.data.asset = newValue.id;
                        this._setModelAsset(newValue.id);
                    } else {
                        this._setModelAsset(newValue);
                    }
                } else {
                    this.model = null;
                }
            } else if (!newValue) {
                this.data.asset = null;
            }
        },

        onSetCastShadows: function (name, oldValue, newValue) {
            var model = this.data.model;
            if (model) {
                var scene = this.system.app.scene;
                var inScene = scene.containsModel(model);
                if (inScene) {
                    scene.removeModel(model);
                }

                var meshInstances = model.meshInstances;
                for (var i = 0; i < meshInstances.length; i++) {
                    meshInstances[i].castShadow = newValue;
                }

                if (inScene) {
                    scene.addModel(model);
                }
            }
        },

        onSetModel: function (name, oldValue, newValue) {
            if (oldValue) {
                this.system.app.scene.removeModel(oldValue);
                this.entity.removeChild(oldValue.getGraph());
                delete oldValue._entity;
            }

            if (newValue) {
                var componentData = this.data;
                var meshInstances = newValue.meshInstances;
                for (var i = 0; i < meshInstances.length; i++) {
                    meshInstances[i].castShadow = componentData.castShadows;
                    meshInstances[i].receiveShadow = componentData.receiveShadows;
                }

                this.entity.addChild(newValue.graph);

                if (this.enabled && this.entity.enabled) {
                    this.system.app.scene.addModel(newValue);
                }

                // Store the entity that owns this model
                newValue._entity = this.entity;

                // Update any animation component
                if (this.entity.animation) {
                    this.entity.animation.setModel(newValue);
                }
            }
        },

        setMaterialAsset: function (newValue) {
            // if the type of the value is not a number assume it is an pc.Asset
            var id = typeof newValue === 'number' || !newValue ? newValue : newValue.id;

            // var material;
            var assets = this.system.app.assets;
            var self = this;

            // try to load the material asset
            if (id !== undefined && id !== null) {
                var asset = assets.get(id);
                if (asset) {
                    asset.ready(function (asset) {
                        self.material = asset.resource;
                    });
                    assets.load(asset);
                } else {
                    assets.on("add:"+id, function (asset) {
                        asset.ready(function (asset) {
                            self.material = asset.resource;
                        });
                        assets.load(asset);
                    });
                }
            }

            // if no material asset was loaded then use the default material
            // if (!material) {
            //     material = this.system.defaultMaterial;
            // }

            // this.material = material;

            var oldValue = this.data.materialAsset;
            this.data.materialAsset = id;
            this.fire('set', 'materialAsset', oldValue, id);
        },

        getMaterialAsset: function () {
            return this.system.app.assets.get(this.data.materialAsset);
        },

        onSetMaterial: function (name, oldValue, newValue) {
            if (newValue !== oldValue) {
                this.data.material = newValue;
                if (this.data.model && this.data.type !== 'asset') {
                    var meshInstances = this.data.model.meshInstances;
                    for (var i=0; i<meshInstances.length; i++) {
                        meshInstances[i].material = newValue;
                    }
                }
            }
        },

        onSetReceiveShadows: function (name, oldValue, newValue) {
            if (newValue !== undefined) {
                var componentData = this.data;
                if (componentData.model) {
                    var meshInstances = componentData.model.meshInstances;
                    for (var i = 0; i < meshInstances.length; i++) {
                        meshInstances[i].receiveShadow = newValue;
                    }
                }
            }
        },

        onEnable: function () {
            ModelComponent._super.onEnable.call(this);

            var model = this.data.model;
            if (model) {
                var inScene = this.system.app.scene.containsModel(model);
                if (!inScene) {
                    this.system.app.scene.addModel(model);
                }
            }
        },

        onDisable: function () {
            ModelComponent._super.onDisable.call(this);

            var model = this.data.model;
            if (model) {
                var inScene = this.system.app.scene.containsModel(model);
                if (inScene) {
                    this.system.app.scene.removeModel(model);
                }
            }
        },

        /**
        * @private
        * @description Attached to the asset during loading, this callback
        * is used to reload the asset if it is changed.
        */
        // onAssetChange: function (asset, attribute, newValue, oldValue) {
        //     if (attribute === 'resource' && newValue) {
        //         // if the model resource has changed then set it
        //         this._onModelLoaded(newValue.clone());
        //     }

        //     if (attribute === 'data') {
        //         // mapping has changed
        //         var a = {
        //             resource:
        //             data: asset.data
        //         }
        //         this.system.app.loader.patch(a, this.system.app.assets);
        //     }
        // },

        onAssetRemoved: function (asset) {
            asset.off('remove', this.onAssetRemoved, this);
            if (this.asset === asset.id) {
                this.asset = null;
            }
        }
    });

    return {
        ModelComponent: ModelComponent
    };
}());
