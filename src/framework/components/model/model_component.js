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
     * @property {String} asset The GUID of the asset for the model (only applies to models of type 'asset')
     * @property {Boolean} castShadows If true, this model will cast shadows for lights that have shadow casting enabled.
     * @property {Boolean} receiveShadows If true, shadows will be cast on this model
     * @property {String} materialAsset The material {@link pc.Asset.Asset} that will be used to render the model (not used on models of type 'asset')
     * @property {pc.scene.Model} model The model that is added to the scene graph.
     */
    var ModelComponent = function ModelComponent (system, entity)   {
        this.on("set_type", this.onSetType, this);
        this.on("set_asset", this.onSetAsset, this);
        this.on("set_castShadows", this.onSetCastShadows, this);
        this.on("set_model", this.onSetModel, this);
        this.on("set_receiveShadows", this.onSetReceiveShadows, this);

        // override materialAsset property to return a pc.Asset instead
        Object.defineProperty(this, 'materialAsset', {
            set: this.setMaterialAsset.bind(this),
            get: this.getMaterialAsset.bind(this)
        });

        this.materialLoader = new pc.resources.MaterialResourceLoader(system.context.graphicsDevice, system.context.assets);
    };
    ModelComponent = pc.inherits(ModelComponent, pc.fw.Component);

    pc.extend(ModelComponent.prototype, {

        setVisible: function (visible) {
            console.warn("WARNING: setVisible: Function is deprecated. Set enabled property instead.");
            this.enabled = visible;
        },

        loadModelAsset: function (guid) {
            var options = {
                parent: this.entity.getRequest()
            };

            var asset = this.system.context.assets.getAssetByResourceId(guid);
            if (!asset) {
                logERROR(pc.string.format('Trying to load model before asset {0} is loaded.', guid));
                return;
            }

            this.system.context.assets.load(asset, [], options).then(function (resources) {
                var model = resources[0];

                if (this.system.context.designer) {
                    model.generateWireframe();

                    asset.on('change', this.onAssetChange, this);
                }

                if (this.data.type === 'asset') {
                    this.model = model;
                }
            }.bind(this));
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
                    if (this.data.asset) {
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
                }
            }
        },

        onSetAsset: function (name, oldValue, newValue) {
            if (oldValue) {
                // Remove old listener
                var asset = this.system.context.assets.getAssetByResourceId(oldValue);
                if (asset) {
                    asset.off('change', this.onAssetChange, this);
                }
            }

            if (this.data.type === 'asset') {
                if (newValue) {
                    this.loadModelAsset(newValue);
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
            // if the type of the value is not a string assume it is an pc.Asset
            var guid = typeof newValue === 'string' || !newValue ? newValue : newValue.resourceId;

            material = guid ? this.materialLoader.load(guid) : this.system.defaultMaterial;
            this.data.material = material;
            if (this.data.model && this.data.type !== 'asset') {
                var meshInstances = this.data.model.meshInstances;
                for (var i=0; i<meshInstances.length; i++) {
                    meshInstances[i].material = material;
                }
            }

            var oldValue = this.data.materialAsset;
            this.data.materialAsset = guid;
            this.fire('set', 'materialAsset', oldValue, guid);
        },

        getMaterialAsset: function () {
            return this.system.context.assets.getAssetByResourceId(this.data.materialAsset);
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
        onAssetChange: function (asset) {
            // Remove the asset from the cache and reload it
            this.system.context.loader.removeFromCache(asset.getFileUrl());
            this.asset = null;
            this.asset = asset.resourceId;
        }
    });

    return {
        ModelComponent: ModelComponent
    };
}());
