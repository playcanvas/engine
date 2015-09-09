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
     * @property {pc.Asset} asset The asset for the model (only applies to models of type 'asset') - can also be an asset id.
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

        this._assetOld = 0;
    };
    ModelComponent = pc.inherits(ModelComponent, pc.Component);

    pc.extend(ModelComponent.prototype, {
        setVisible: function (visible) {
            console.warn("WARNING: setVisible: Function is deprecated. Set enabled property instead.");
            this.enabled = visible;
        },

        _onAssetLoad: function(asset) {
            this._onModelLoaded(asset.resource.clone());
        },

        _onAssetChange: function(asset, attribute, newValue, oldValue) {
            if (attribute === 'data') {
                // mapping has changed
                var a = {
                    resource: this.model,
                    data: asset.data,
                    type: "model"
                };

                this.system.app.loader.patch(a, this.system.app.assets);
            }
        },

        _onAssetRemove: function (asset) {
            if (this.asset === asset.id)
                this.asset = null;
        },

        _setModelAsset: function (id) {
            var assets = this.system.app.assets;
            var asset = id !== null ? assets.get(id) : null;

            this._onModelAsset(asset || null);

            if (! asset && id !== null)
                assets.once("add:" + id, this._onModelAsset, this);
        },

        _onModelAsset: function(asset) {
            var assets = this.system.app.assets;

            // clear old assets bindings
            if (this._assetOld) {
                assets.off("add:" + this._assetOld, this._onModelAsset, this);

                var assetOld = assets.get(this._assetOld);
                if (assetOld) {
                    assetOld.off('load', this._onAssetLoad, this);
                    assetOld.off('change', this._onAssetChange, this);
                    assetOld.off('remove', this._onAssetRemove, this);
                }
            }

            // remember new asset id
            this._assetOld = asset ? asset.id : 0;

            if (asset) {
                // subscribe to asset events
                asset.on('load', this._onAssetLoad, this);
                asset.on('change', this._onAssetChange, this);
                asset.on('remove', this._onAssetRemove, this);

                if (asset.resource) {
                    this._onModelLoaded(asset.resource.clone());
                } else {
                    assets.load(asset);
                }
            }
        },

        remove: function() {
            this._onModelAsset(null);
        },

        _onModelLoaded: function (model) {
            if (this.data.type === 'asset')
                this.model = model;
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
            var id = null;
            if (this.data.type === 'asset') {
                if (newValue !== null) {
                    id = newValue;

                    if (newValue instanceof pc.Asset) {
                        this.data.asset = newValue.id;
                        id = newValue.id;
                    }
                } else {
                    this.model = null;
                }
            }

            if (id === null)
                this.data.asset = null;

            this._setModelAsset(id);
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

        _onMaterialAssetRemove: function(asset) {
            var assets = this.system.app.assets;
            var id = isNaN(asset) ? asset.id : asset;

            if (asset && isNaN(asset) && asset.resource === this.material)
                this.material = pc.ModelHandler.DEFAULT_MATERIAL;

            assets.off('add:' + id, this._onMaterialAsset, this);
            assets.off('load:' + id, this._onMaterialAsset, this);
            assets.off('remove:' + id, this._onMaterialAssetRemove, this);
        },

        _onMaterialAsset: function(asset) {
            var assets = this.system.app.assets;

            if (asset.resource) {
                this.material = asset.resource;
            } else {
                assets.load(asset);
            }
        },

        setMaterialAsset: function (value) {
            // if the type of the value is not a number assume it is an pc.Asset
            var id = typeof value === 'number' || !value ? value : value.id;

            // var material;
            var assets = this.system.app.assets;
            var self = this;

            // unsubscribe
            if (this.data.materialAsset !== id) {
                if (this.data.materialAsset)
                    this._onMaterialAssetRemove(this.data.materialAsset);

                if (id) {
                    assets.on('load:' + id, this._onMaterialAsset, this);
                    assets.once('remove:' + id, this._onMaterialAssetRemove, this);
                }
            }

            // try to load the material asset
            if (id !== undefined && id !== null) {
                var asset = assets.get(id);
                if (asset)
                    this._onMaterialAsset(asset);

                // subscribe for adds
                assets.once('add:' + id, this._onMaterialAsset, this);
            } else if (id === null) {
                self.material = pc.ModelHandler.DEFAULT_MATERIAL;
            }

            var valueOld = this.data.materialAsset;
            this.data.materialAsset = id;
            this.fire('set', 'materialAsset', valueOld, id);
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
        }
    });

    return {
        ModelComponent: ModelComponent
    };
}());
