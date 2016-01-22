pc.extend(pc, function () {
    /**
     * @component
     * @name pc.ModelComponent
     * @description Create a new ModelComponent
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
     * @property {pc.Asset} asset The asset for the model (only applies to models of type 'asset') - can also be an asset id.
     * @property {Boolean} castShadows If true, this model will cast shadows for lights that have shadow casting enabled.
     * @property {Boolean} receiveShadows If true, shadows will be cast on this model
     * @property {Number} materialAsset The material {@link pc.Asset} that will be used to render the model (not used on models of type 'asset')
     * @property {pc.Model} model The model that is added to the scene graph.
     * @property {Object} mapping A dictionary that holds material overrides for each mesh instance. Only applies to model components of type 'asset'. The mapping contains pairs of mesh instance index - material asset id.
     */


     // TODO: enable this when lightmaps are public
     // @property {Boolean} lightMapCast If true, this model will cast shadows when rendering lightMaps
     // @property {Boolean} lightMapReceive If true, this model will be lightMapped
     // @property {Boolean} lightMapSizeMultiplier LightMap resolution multiplier
    var ModelComponent = function ModelComponent (system, entity)   {
        this.on("set_type", this.onSetType, this);
        this.on("set_asset", this.onSetAsset, this);
        this.on("set_castShadows", this.onSetCastShadows, this);
        this.on("set_receiveShadows", this.onSetReceiveShadows, this);
        this.on("set_lightMapCast", this.onSetLightMapCast, this);
        this.on("set_lightMapReceive", this.onSetLightMapReceive, this);
        this.on("set_lightMapSizeMultiplier", this.onSetLightMapSizeMultiplier, this);
        this.on("set_model", this.onSetModel, this);
        this.on("set_material", this.onSetMaterial, this);
        this.on("set_mapping", this.onSetMapping, this);

        // override materialAsset property to return a pc.Asset instead
        Object.defineProperty(this, 'materialAsset', {
            set: this.setMaterialAsset.bind(this),
            get: this.getMaterialAsset.bind(this)
        });

        this._assetOld = 0;
        this._materialEvents = null;
        this._dirtyModelAsset = false;
        this._dirtyMaterialAsset = false;
    };
    ModelComponent = pc.inherits(ModelComponent, pc.Component);

    pc.extend(ModelComponent.prototype, {
        setVisible: function (visible) {
            console.warn("WARNING: setVisible: Function is deprecated. Set enabled property instead.");
            this.enabled = visible;
        },

        _onAssetLoad: function(asset) {
            if (asset.resource)
                this._onModelLoaded(asset.resource.clone());
        },

        _onAssetChange: function(asset, attribute, newValue, oldValue) {
            // reset mapping
            if (attribute === 'data')
                this.mapping = this.data.mapping;
        },

        _onAssetRemove: function (asset) {
            if (this.asset === asset.id)
                this.asset = null;
        },

        _setModelAsset: function (id) {
            var assets = this.system.app.assets;
            var asset = id !== null ? assets.get(id) : null;

            this._dirtyModelAsset = true;

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
                    this._dirtyModelAsset = false;
                    this._onModelLoaded(asset.resource.clone());
                } else if (this.enabled && this.entity.enabled) {
                    this._dirtyModelAsset = false;
                    assets.load(asset);
                }
            } else {
                this._dirtyModelAsset = false;
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

                    if (this.system._inTools)
                        model.generateWireframe();

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
                if (inScene)
                    scene.removeModel(model);

                var meshInstances = model.meshInstances;
                for (var i = 0; i < meshInstances.length; i++)
                    meshInstances[i].castShadow = newValue;

                if (inScene)
                    scene.addModel(model);
            }
        },

        onSetLightMapCast: function (name, oldValue, newValue) {
            this.data.lightMapCast = newValue;
        },

        onSetLightMapReceive: function (name, oldValue, newValue) {
            this.data.lightMapReceive = newValue;
        },

        onSetLightMapSizeMultiplier: function (name, oldValue, newValue) {
            this.data.lightMapSizeMultiplier = newValue;
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

                if (this.enabled && this.entity.enabled)
                    this.system.app.scene.addModel(newValue);

                // Store the entity that owns this model
                newValue._entity = this.entity;

                // Update any animation component
                if (this.entity.animation)
                    this.entity.animation.setModel(newValue);

                // trigger event handler to load mapping
                // for new model
                if (this.data.type === 'asset') {
                    this.mapping = this.data.mapping;
                } else {
                    this._unsetMaterialEvents();
                }
            } else {
                this._unsetMaterialEvents();
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
                this._dirtyMaterialAsset = false;
            } else if (this.enabled && this.entity.enabled) {
                this._dirtyMaterialAsset = false;
                assets.load(asset);
            }
        },

        setMaterialAsset: function (value) {
            this._dirtyMaterialAsset = true;

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
                    assets.on('remove:' + id, this._onMaterialAssetRemove, this);
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
                self._dirtyMaterialAsset = false;
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

        onSetMapping: function (name, oldValue, newValue) {
            if (this.data.type !== 'asset' || !this.data.model)
                return;

            // unsubscribe from old events
            this._unsetMaterialEvents();

            if (! newValue)
                newValue = {};

            var meshInstances = this.data.model.meshInstances;
            var modelAsset = this.asset ? this.system.app.assets.get(this.asset) : null;
            var assetMapping = modelAsset ? modelAsset.data.mapping : null;

            for (var i = 0, len = meshInstances.length; i < len; i++) {
                if (newValue[i] !== undefined) {
                    if (newValue[i]) {
                        this._loadAndSetMeshInstanceMaterial(newValue[i], meshInstances[i], i);
                    } else {
                        meshInstances[i].material = pc.ModelHandler.DEFAULT_MATERIAL;
                    }
                } else if (assetMapping) {
                    if (assetMapping[i] && (assetMapping[i].material || assetMapping[i].path)) {
                        var idOrPath = assetMapping[i].material || assetMapping[i].path;
                        this._loadAndSetMeshInstanceMaterial(idOrPath, meshInstances[i], i);
                    } else {
                        meshInstances[i].material = pc.ModelHandler.DEFAULT_MATERIAL;
                    }
                }
            }
        },

        _setMaterialEvent: function (index, event, id, handler) {
            var evt = event + ':' + id;
            this.system.app.assets.on(evt, handler, this);

            if (!this._materialEvents)
                this._materialEvents = [ ];

            if (!this._materialEvents[index])
                this._materialEvents[index] = { };

            this._materialEvents[index][evt] = {
                id: id,
                handler: handler
            };
        },

        _unsetMaterialEvents: function () {
            var assets = this.system.app.assets;
            var events = this._materialEvents;
            if (! events)
                return;

            for (var i = 0, len = events.length; i < len; i++) {
                if (! events[i]) continue;
                var evt = events[i];
                for (var key in evt) {
                    assets.off(key, evt[key].handler, this);
                }
            }

            this._materialEvents = null;
        },

        _getAssetByIdOrPath: function (idOrPath) {
            var asset = null;
            var isPath = isNaN(parseInt(idOrPath, 10));

            // get asset by id or url
            if (!isPath) {
                asset = this.system.app.assets.get(idOrPath);
            } else if (this.asset) {
                var url = this._getMaterialAssetUrl(idOrPath);
                if (url)
                    asset = this.system.app.assets.getByUrl(url);
            }

            return asset;
        },

        _getMaterialAssetUrl: function (path) {
            if (!this.asset) return null;

            var modelAsset = this.system.app.assets.get(this.asset);
            if (!modelAsset) return null;

            var fileUrl = modelAsset.getFileUrl();
            var dirUrl = pc.path.getDirectory(fileUrl);
            return pc.path.join(dirUrl, path);
        },

        _loadAndSetMeshInstanceMaterial: function (idOrPath, meshInstance, index) {
            var self = this;
            var assets = this.system.app.assets;

            // get asset by id or url
            var asset = this._getAssetByIdOrPath(idOrPath);
            if (! asset)
                return;

            var handleMaterial = function (asset) {
                if (asset.resource) {
                    meshInstance.material = asset.resource;

                    self._setMaterialEvent(index, 'remove', asset.id, function () {
                        meshInstance.material = pc.ModelHandler.DEFAULT_MATERIAL;
                    });
                } else {
                    self._setMaterialEvent(index, 'load', asset.id, function (asset) {
                        meshInstance.material = asset.resource;

                        self._setMaterialEvent(index, 'remove', asset.id, function () {
                            meshInstance.material = pc.ModelHandler.DEFAULT_MATERIAL;
                        });
                    });

                    if (self.enabled && self.entity.enabled)
                        assets.load(asset);
                }
            };

            if (asset) {
                handleMaterial(asset);
            } else {
                meshInstance.material = pc.ModelHandler.DEFAULT_MATERIAL;

                var isPath = isNaN(parseInt(idOrPath, 10));
                self._setMaterialEvent(index, isPath ? 'add:url' : 'add', idOrPath, handleMaterial);
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
            var isAsset = this.data.type === 'asset';

            if (model) {
                var inScene = this.system.app.scene.containsModel(model);
                if (!inScene) {
                    this.system.app.scene.addModel(model);
                }
            } else if (isAsset && this._dirtyModelAsset) {
                var asset = this.data.asset;
                if (! asset)
                    return;

                asset = this.system.app.assets.get(asset);
                if (asset)
                    this._onModelAsset(asset);
            }

            // load materialAsset if necessary
            if (this._dirtyMaterialAsset) {
                var materialAsset = this.data.materialAsset;
                if (materialAsset) {
                    materialAsset = this.system.app.assets.get(materialAsset);
                    if (materialAsset && !materialAsset.resource) {
                        this._onMaterialAsset(materialAsset);
                    }
                }
            }

            // load mapping materials if necessary
            if (isAsset) {
                var mapping = this.data.mapping;
                if (mapping) {
                    for (var index in mapping) {
                        if (mapping[index]) {
                            var asset = this._getAssetByIdOrPath(mapping[index]);
                            if (asset && !asset.resource) {
                                this.system.app.assets.load(asset);
                            }
                        }
                    }
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
