pc.extend(pc.fw, function () {
    /**
     * @component
     * @name pc.fw.ModelComponent
     * @constructor Create a new ModelComponentSystem
     * @class Enables an Entity to render a model or a primitive shape. This Component attaches additional model geometry in to the scene graph below the Entity.
     * @param {pc.fw.ModelComponentSystem} system The ComponentSystem that created this Component
     * @param {pc.fw.Entity} entity The Entity that this Component is attached to.
     * @extends pc.fw.Component
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
     * @property {Number} materialAsset The material {@link pc.Asset.Asset} that will be used to render the model (not used on models of type 'asset')
     * @property {pc.scene.Model} model The model that is added to the scene graph.
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
    };
    ModelComponent = pc.inherits(ModelComponent, pc.fw.Component);

    pc.extend(ModelComponent.prototype, {

        setVisible: function (visible) {
            console.warn("WARNING: setVisible: Function is deprecated. Set enabled property instead.");
            this.enabled = visible;
        },

        loadModelAsset: function (id) {
            var options = {
                parent: this.entity.getRequest()
            };

            var asset = this.system.context.assets.getAssetById(id);
            if (!asset) {
                logERROR(pc.string.format('Trying to load model before asset {0} is loaded.', id));
                return;
            }

            asset.off('change', this.onAssetChange, this); // do not subscribe multiple times
            asset.on('change', this.onAssetChange, this);

            if (asset.resource) {
                var model = asset.resource.clone();
                this._onModelLoaded(model);
            } else {
                this.system.context.assets.load(asset, [], options).then(function (resources) {
                    this._onModelLoaded(resources[0]);
                }.bind(this));
            }
        },

        _onModelLoaded: function (model) {
            if (this.system.context.designer) {
                model.generateWireframe();
            }

            if (this.data.type === 'asset') {
                this.model = model;
            }
        },

        /**
         * @function
         * @private
         * @name pc.fw.ModelComponent#onSetType
         * @description Handle changes to the 'type' variable
         */
        onSetType: function (name, oldValue, newValue) {
            var data = this.data;

            if (newValue) {
                var mesh = null;

                if (newValue === 'asset') {
                    if (this.data.asset !== null) {
                        this.loadModelAsset(this.data.asset);
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

                    var node = new pc.scene.GraphNode();

                    var model = new pc.scene.Model();
                    model.graph = node;

                    model.meshInstances = [ new pc.scene.MeshInstance(node, mesh, data.material) ];

                    if (this.system.context.designer) {
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
                var asset = this.system.context.assets.getAssetById(oldValue);
                if (asset) {
                    asset.off('change', this.onAssetChange, this);
                }
            }

            if (this.data.type === 'asset') {
                if (newValue) {
                    if (newValue instanceof pc.asset.Asset) {
                        this.data.asset = newValue.id;
                        this.loadModelAsset(newValue.id);
                    } else {
                        this.loadModelAsset(newValue);
                    }
                } else {
                    this.model = null;
                }
            }
        },

        onSetCastShadows: function (name, oldValue, newValue) {
            var model = this.data.model;
            if (model) {
                var scene = this.system.context.scene;
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
                this.system.context.scene.removeModel(oldValue);
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
                    this.system.context.scene.addModel(newValue);
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

            var material;

            // try to load the material asset
            if (id !== undefined && id !== null) {
                var asset = this.system.context.assets.getAssetById(id);
                if (asset) {
                    if (asset.resource) {
                        material = asset.resource;
                        this.material = material;
                    } else {
                        // setting material asset to an asset that hasn't been loaded yet.
                        // this should only be at tool-time
                        this.system.context.assets.load(asset).then(function (materials) {
                            this.material = materials[0];
                        }.bind(this));
                    }
                } else {
                    console.error(pc.string.format("Entity '{0}' is trying to load Material Asset {1} which no longer exists. Maybe this model was once a primitive shape?", this.entity.getPath(), id));
                }
            }

            // if no material asset was loaded then use the default material
            if (!material) {
                material = this.system.defaultMaterial;
            }

            this.material = material;

            var oldValue = this.data.materialAsset;
            this.data.materialAsset = id;
            this.fire('set', 'materialAsset', oldValue, id);
        },

        getMaterialAsset: function () {
            return this.system.context.assets.getAssetById(this.data.materialAsset);
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
                var inScene = this.system.context.scene.containsModel(model);
                if (!inScene) {
                    this.system.context.scene.addModel(model);
                }
            }
        },

        onDisable: function () {
            ModelComponent._super.onDisable.call(this);

            var model = this.data.model;
            if (model) {
                var inScene = this.system.context.scene.containsModel(model);
                if (inScene) {
                    this.system.context.scene.removeModel(model);
                }
            }
        },

        /**
        * @private
        * @description Attached to the asset during loading (while running with the designer or over livelink), this callback
        * is used to reload the asset if it is changed.
        */
        onAssetChange: function (asset, attribute, newValue, oldValue) {
            if (attribute === 'resource') {
                // if the model resource has changed then set it
                if (newValue) {
                    this._onModelLoaded(newValue);
                }
            } else if (attribute === 'data') {
                // if the data has changed then it means the mapping has changed
                // so check if the mapping is different and if so reload the model
                var isMappingDifferent = false;
                var mapping = newValue.mapping;
                var oldMapping = oldValue.mapping;
                if (mapping && !oldMapping || oldMapping && !mapping) {
                    isMappingDifferent = true;
                } else if (mapping) {
                    if (mapping && mapping.length !== oldMapping.length) {
                        isMappingDifferent = true;
                    } else {
                        for (var i = 0; i < mapping.length; i++) {
                            if (mapping[i].material !== oldMapping[i].material) {
                                isMappingDifferent = true;
                                break;
                            }
                        }
                    }
                }

                if (isMappingDifferent) {
                    // clear the cache and reload the model
                    asset.resource = null;
                    this.system.context.loader.removeFromCache(asset.getFileUrl());
                    this.loadModelAsset(asset.id);
                }

            }
        }
    });

    return {
        ModelComponent: ModelComponent
    };
}());
