Object.assign(pc, function () {
    /**
     * @component
     * @constructor
     * @name pc.ModelComponent
     * @classdesc Enables an Entity to render a model or a primitive shape. This Component attaches additional model
     * geometry in to the scene graph below the Entity.
     * @description Create a new ModelComponent
     * @param {pc.ModelComponentSystem} system The ComponentSystem that created this Component
     * @param {pc.Entity} entity The Entity that this Component is attached to.
     * @extends pc.Component
     * @property {String} type The type of the model, which can be one of the following values:
     * <ul>
     *     <li>asset: The component will render a model asset</li>
     *     <li>box: The component will render a box (1 unit in each dimension)</li>
     *     <li>capsule: The component will render a capsule (radius 0.5, height 2)</li>
     *     <li>cone: The component will render a cone (radius 0.5, height 1)</li>
     *     <li>cylinder: The component will render a cylinder (radius 0.5, height 1)</li>
     *     <li>plane: The component will render a plane (1 unit in each dimension)</li>
     *     <li>sphere: The component will render a sphere (radius 0.5)</li>
     * </ul>
     * @property {pc.Asset} asset The asset for the model (only applies to models of type 'asset') - can also be an asset id.
     * @property {Boolean} castShadows If true, this model will cast shadows for lights that have shadow casting enabled.
     * @property {Boolean} receiveShadows If true, shadows will be cast on this model
     * @property {Number} materialAsset The material {@link pc.Asset} that will be used to render the model (not used on models of type 'asset')
     * @property {pc.Model} model The model that is added to the scene graph. It can be not set or loaded, so will return null.
     * @property {Object} mapping A dictionary that holds material overrides for each mesh instance. Only applies to model components of type 'asset'. The mapping contains pairs of mesh instance index - material asset id.
     * @property {Boolean} castShadowsLightmap If true, this model will cast shadows when rendering lightmaps
     * @property {Boolean} lightmapped If true, this model will be lightmapped after using lightmapper.bake()
     * @property {Number} lightmapSizeMultiplier Lightmap resolution multiplier
     * @property {Boolean} isStatic Mark model as non-movable (optimization)
     * @property {pc.MeshInstance[]} meshInstances An array of meshInstances contained in the component's model. If model is not set or loaded for component it will return null.
     * @property {Number} batchGroupId Assign model to a specific batch group (see {@link pc.BatchGroup}). Default value is -1 (no group).
     * @property {Array} layers An array of layer IDs ({@link pc.Layer#id}) to which this model should belong.
     * Don't push/pop/splice or modify this array, if you want to change it - set a new one instead.
     */

    var ModelComponent = function ModelComponent(system, entity)   {
        pc.Component.call(this, system, entity);

        // this.enabled = true;
        this._type = 'asset';

        // model asset
        this._asset = null;
        this._model = null;

        this._mapping = {};

        this._castShadows = true;
        this._receiveShadows = true;

        this._materialAsset = null;
        this._material = system.defaultMaterial;

        this._castShadowsLightmap = true;
        this._lightmapped = false;
        this._lightmapSizeMultiplier = 1;
        this._isStatic = false;

        this._layers = [pc.LAYERID_WORLD]; // assign to the default world layer
        this._batchGroupId = -1;

        this._area = null;

        this._assetOld = 0;
        this._materialEvents = null;
        this._dirtyModelAsset = false;
        this._dirtyMaterialAsset = false;

        this._clonedModel = false;

        // #ifdef DEBUG
        this._batchGroup = null;
        // #endif

    };
    ModelComponent.prototype = Object.create(pc.Component.prototype);
    ModelComponent.prototype.constructor = ModelComponent;

    Object.assign(ModelComponent.prototype, {
        setVisible: function (visible) {
            console.warn("WARNING: setVisible: Function is deprecated. Set enabled property instead.");
            this.enabled = visible;
        },

        addModelToLayers: function () {
            var layer;
            var layers = this.system.app.scene.layers;

            for (var i = 0; i < this._layers.length; i++) {
                layer = layers.getLayerById(this._layers[i]);
                if (!layer) continue;
                layer.addMeshInstances(this.meshInstances);
            }
        },

        removeModelFromLayers: function (model) {
            var layer;
            var layers = this.system.app.scene.layers;

            for (var i = 0; i < this._layers.length; i++) {
                layer = layers.getLayerById(this._layers[i]);
                if (!layer) continue;
                layer.removeMeshInstances(model.meshInstances);
            }
        },

        onRemove: function () {
            this.asset = null;
            this.materialAsset = null;
            this._unsetMaterialEvents();
        },

        onLayersChanged: function (oldComp, newComp) {
            this.addModelToLayers();
            oldComp.off("add", this.onLayerAdded, this);
            oldComp.off("remove", this.onLayerRemoved, this);
            newComp.on("add", this.onLayerAdded, this);
            newComp.on("remove", this.onLayerRemoved, this);
        },

        onLayerAdded: function (layer) {
            var index = this.layers.indexOf(layer.id);
            if (index < 0) return;
            layer.addMeshInstances(this.meshInstances);
        },

        onLayerRemoved: function (layer) {
            var index = this.layers.indexOf(layer.id);
            if (index < 0) return;
            layer.removeMeshInstances(this.meshInstances);
        },

        _setMaterialEvent: function (index, event, id, handler) {
            var evt = event + ':' + id;
            this.system.app.assets.on(evt, handler, this);

            if (!this._materialEvents)
                this._materialEvents = [];

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
            if (!events)
                return;

            for (var i = 0, len = events.length; i < len; i++) {
                if (!events[i]) continue;
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

        _loadAndSetMeshInstanceMaterial: function (materialAsset, meshInstance, index) {
            var assets = this.system.app.assets;

            if (!materialAsset)
                return;

            if (materialAsset) {
                if (materialAsset.resource) {
                    meshInstance.material = materialAsset.resource;

                    this._setMaterialEvent(index, 'remove', materialAsset.id, function () {
                        meshInstance.material = this.system.defaultMaterial;
                    });
                } else {
                    this._setMaterialEvent(index, 'load', materialAsset.id, function (asset) {
                        meshInstance.material = asset.resource;

                        this._setMaterialEvent(index, 'remove', materialAsset.id, function () {
                            meshInstance.material = this.system.defaultMaterial;
                        });
                    });

                    if (this.enabled && this.entity.enabled)
                        assets.load(materialAsset);
                }
            }
        },

        onEnable: function () {
            var app = this.system.app;
            var scene = app.scene;

            scene.on("set:layers", this.onLayersChanged, this);
            if (scene.layers) {
                scene.layers.on("add", this.onLayerAdded, this);
                scene.layers.on("remove", this.onLayerRemoved, this);
            }

            var isAsset = (this._type === 'asset');

            var asset;
            if (this._model) {
                this.addModelToLayers();
            } else if (isAsset && this._asset) {
                // bind and load model asset if necessary
                asset = app.assets.get(this._asset);
                if (asset && asset.resource !== this._model) {
                    this._bindModelAsset(asset);
                }
            }

            if (this._materialAsset) {
                // bind and load material asset if necessary
                asset = app.assets.get(this._materialAsset);
                if (asset && asset.resource !== this._material) {
                    this._bindMaterialAsset(asset);
                }
            }

            if (isAsset) {
                // bind mapped assets
                // TODO: replace
                if (this._mapping) {
                    for (var index in this._mapping) {
                        if (this._mapping[index]) {
                            asset = this._getAssetByIdOrPath(this._mapping[index]);
                            if (asset && !asset.resource) {
                                app.assets.load(asset);
                            }
                        }
                    }
                }
            }

            if (this._batchGroupId >= 0) {
                app.batcher.insert(pc.BatchGroup.MODEL, this.batchGroupId, this.entity);
            }
        },

        onDisable: function () {
            var app = this.system.app;
            var scene = app.scene;

            scene.off("set:layers", this.onLayersChanged, this);
            if (scene.layers) {
                scene.layers.off("add", this.onLayerAdded, this);
                scene.layers.off("remove", this.onLayerRemoved, this);
            }

            if (this._batchGroupId >= 0) {
                app.batcher.remove(pc.BatchGroup.MODEL, this.batchGroupId, this.entity);
            }

            if (this._model) {
                this.removeModelFromLayers(this._model);
            }
        },

        /**
         * @function
         * @name pc.ModelComponent#hide
         * @description Stop rendering model without removing it from the scene hierarchy.
         * This method sets the {@link pc.MeshInstance#visible} property of every MeshInstance in the model to false
         * Note, this does not remove the model or mesh instances from the scene hierarchy or draw call list.
         * So the model component still incurs some CPU overhead.
         * @example
         *   this.timer = 0;
         *   this.visible = true;
         *   // ...
         *   // blink model every 0.1 seconds
         *   this.timer += dt;
         *   if (this.timer > 0.1) {
         *       if (!this.visible) {
         *           this.entity.model.show();
         *           this.visible = true;
         *       } else {
         *           this.entity.model.hide();
         *           this.visible = false;
         *       }
         *       this.timer = 0;
         *   }
         */
        hide: function () {
            if (this._model) {
                var i, l;
                var instances = this._model.meshInstances;
                for (i = 0, l = instances.length; i < l; i++) {
                    instances[i].visible = false;
                }
            }
        },

        /**
         * @function
         * @name pc.ModelComponent#show
         * @description Enable rendering of the model if hidden using {@link pc.ModelComponent#hide}.
         * This method sets all the {@link pc.MeshInstance#visible} property on all mesh instances to true.
         */
        show: function () {
            if (this._model) {
                var i, l;
                var instances = this._model.meshInstances;
                for (i = 0, l = instances.length; i < l; i++) {
                    instances[i].visible = true;
                }
            }
        },

        // NEW

        _bindMaterialAsset: function (asset) {
            asset.on('load', this._onMaterialAssetLoad, this);
            asset.on('unload', this._onMaterialAssetUnload, this);
            asset.on('remove', this._onMaterialAssetRemove, this);
            asset.on('change', this._onMaterialAssetChange, this);

            if (asset.resource) {
                this._onMaterialAssetLoad(asset);
            } else {
                // don't trigger an asset load unless the component is enabled
                if (!this.enabled || !this.entity.enabled) return;
                this.system.app.assets.load(asset);
            }
        },

        _unbindMaterialAsset: function (asset) {
            asset.off('load', this._onMaterialAssetLoad, this);
            asset.off('unload', this._onMaterialAssetUnload, this);
            asset.off('remove', this._onMaterialAssetRemove, this);
            asset.off('change', this._onMaterialAssetChange, this);
        },

        _onMaterialAssetAdd: function (asset) {
            this.system.app.assets.off('add:' + asset.id, this._onMaterialAssetAdd, this);
            if (this._materialAsset === asset.id) {
                this._bindMaterialAsset(asset);
            }
        },

        _onMaterialAssetLoad: function (asset) {
            this.material = asset.resource;
        },

        _onMaterialAssetUnload: function (asset) {
            this.material = this.system.defaultMaterial;
        },

        _onMaterialAssetRemove: function (asset) {
            this._onMaterialAssetUnload(asset);
        },

        _onMaterialAssetChange: function (asset) {
        },

        _bindModelAsset: function (asset) {
            this._unbindModelAsset(asset);

            asset.on('load', this._onModelAssetLoad, this);
            asset.on('unload', this._onModelAssetUnload, this);
            asset.on('change', this._onModelAssetChange, this);
            asset.on('remove', this._onModelAssetRemove, this);

            if (asset.resource) {
                this._onModelAssetLoad(asset);
            } else {
                // don't trigger an asset load unless the component is enabled
                if (!this.enabled || !this.entity.enabled) return;

                this.system.app.assets.load(asset);
            }
        },

        _unbindModelAsset: function (asset) {
            asset.off('load', this._onModelAssetLoad, this);
            asset.off('unload', this._onModelAssetUnload, this);
            asset.off('change', this._onModelAssetChange, this);
            asset.off('remove', this._onModelAssetRemove, this);
        },

        _onModelAssetAdded: function (asset) {
            this.system.app.assets.off('add:' + asset.id, this._onModelAssetAdd, this);
            if (asset.id === this._asset) {
                this._bindModelAsset(asset);
            }
        },

        _onModelAssetLoad: function (asset) {
            this.model = asset.resource.clone();
            this._clonedModel = true;
        },

        _onModelAssetUnload: function (asset) {
            this.model = null;
        },

        _onModelAssetChange: function (asset, attr, _new, _old) {
            if (attr === 'data') {
                this.mapping = this._mapping;
            }
        },

        _onModelAssetRemove: function (asset) {
            this.model = null;
        }

    });

    Object.defineProperty(ModelComponent.prototype, "meshInstances", {
        get: function () {
            if (!this._model)
                return null;

            return this._model.meshInstances;
        },
        set: function (value) {
            if (!this._model)
                return;

            this._model.meshInstances = value;
        }
    });

    Object.defineProperty(ModelComponent.prototype, "type", {
        get: function () {
            return this._type;
        },

        set: function (value) {
            if (this._type === value) return;

            var mesh = null;

            this._area = null;

            this._type = value;

            if (value === 'asset') {
                if (this._asset !== null) {
                    this._bindModelAsset(this._asset);
                } else {
                    this.model = null;
                }
            } else {
                var system = this.system;
                var gd = system.app.graphicsDevice;

                switch (value) {
                    case 'box':
                        if (!system.box) {
                            system.box = pc.createBox(gd, {
                                halfExtents: new pc.Vec3(0.5, 0.5, 0.5)
                            });
                        }
                        mesh = system.box;
                        this._area = { x: 2, y: 2, z: 2, uv: (2.0 / 3) };
                        break;
                    case 'capsule':
                        if (!system.capsule) {
                            system.capsule = pc.createCapsule(gd, {
                                radius: 0.5,
                                height: 2
                            });
                        }
                        mesh = system.capsule;
                        this._area = { x: (Math.PI * 2), y: Math.PI, z: (Math.PI * 2), uv: (1.0 / 3 + ((1.0 / 3) / 3) * 2) };
                        break;
                    case 'cone':
                        if (!system.cone) {
                            system.cone = pc.createCone(gd, {
                                baseRadius: 0.5,
                                peakRadius: 0,
                                height: 1
                            });
                        }
                        mesh = system.cone;
                        this._area = { x: 2.54, y: 2.54, z: 2.54, uv: (1.0 / 3 + (1.0 / 3) / 3) };
                        break;
                    case 'cylinder':
                        if (!system.cylinder) {
                            system.cylinder = pc.createCylinder(gd, {
                                radius: 0.5,
                                height: 1
                            });
                        }
                        mesh = system.cylinder;
                        this._area = { x: Math.PI, y: (0.79 * 2), z: Math.PI, uv: (1.0 / 3 + ((1.0 / 3) / 3) * 2) };
                        break;
                    case 'plane':
                        if (!system.plane) {
                            system.plane = pc.createPlane(gd, {
                                halfExtents: new pc.Vec2(0.5, 0.5),
                                widthSegments: 1,
                                lengthSegments: 1
                            });
                        }
                        mesh = system.plane;
                        this._area = { x: 0, y: 1, z: 0, uv: 1 };
                        break;
                    case 'sphere':
                        if (!system.sphere) {
                            system.sphere = pc.createSphere(gd, {
                                radius: 0.5
                            });
                        }
                        mesh = system.sphere;
                        this._area = { x: Math.PI, y: Math.PI, z: Math.PI, uv: 1 };
                        break;
                    default:
                        throw new Error("Invalid model type: " + value);
                }

                var node = new pc.GraphNode();

                var model = new pc.Model();
                model.graph = node;

                model.meshInstances = [new pc.MeshInstance(node, mesh, this._material)];

                if (system._inTools)
                    model.generateWireframe();

                this.model = model;
                this._asset = null;
            }
        }
    });

    Object.defineProperty(ModelComponent.prototype, "asset", {
        get: function () {
            return this._asset;
        },

        set: function (value) {
            var assets = this.system.app.assets;
            var _id = value;

            if (value instanceof pc.Asset) {
                _id = value.id;
            }

            if (this._asset !== _id) {
                if (this._asset) {
                    // remove previous asset
                    assets.off('add:' + this._asset, this._onModelAssetAdded, this);
                    var _prev = assets.get(this._asset);
                    if (_prev) {
                        this._unbindModelAsset(_prev);
                    }
                }

                this._asset = _id;

                if (this._asset) {
                    var asset = assets.get(this._asset);
                    if (!asset) {
                        this.model = null;
                        assets.on('add:' + this._asset, this._onModelAssetAdded, this);
                    } else {
                        this._bindModelAsset(asset);
                    }
                } else {
                    this.model = null;
                }
            }
        }
    });

    Object.defineProperty(ModelComponent.prototype, "model", {
        get: function () {
            return this._model;
        },

        set: function (value) {
            if (this._model === value) {
                return;
            }

            if (this._model) {
                this.removeModelFromLayers(this._model);
                this.entity.removeChild(this._model.getGraph());
                delete this._model._entity;

                if (this._clonedModel) {
                    this._model.destroy();
                    this._clonedModel = false;
                }
            }

            this._model = value;

            if (this._model) {
                var meshInstances = this._model.meshInstances;

                for (var i = 0; i < meshInstances.length; i++) {
                    meshInstances[i].castShadow = this._castShadows;
                    meshInstances[i].receiveShadow = this._receiveShadows;
                    meshInstances[i].isStatic = this._isStatic;
                }

                this.lightmapped = this._lightmapped; // update meshInstances

                this.entity.addChild(this._model.graph);

                if (this.enabled && this.entity.enabled) {
                    this.addModelToLayers();
                }

                // Store the entity that owns this model
                this._model._entity = this.entity;

                // Update any animation component
                if (this.entity.animation)
                    this.entity.animation.setModel(this._model);

                // trigger event handler to load mapping
                // for new model
                if (this.type === 'asset') {
                    this.mapping = this._mapping;
                } else {
                    this._unsetMaterialEvents();
                }
            }
        }
    });

    Object.defineProperty(ModelComponent.prototype, "lightmapped", {
        get: function () {
            return this._lightmapped;
        },
        set: function (value) {
            if (value === this._lightmapped) return;

            var i, m, mask;

            this._lightmapped = value;

            if (this._model) {
                var rcv = this._model.meshInstances;
                if (value) {
                    for (i = 0; i < rcv.length; i++) {
                        m = rcv[i];
                        mask = m.mask;
                        m.mask = (mask | pc.MASK_BAKED) & ~(pc.MASK_DYNAMIC | pc.MASK_LIGHTMAP);
                    }
                } else {
                    for (i = 0; i < rcv.length; i++) {
                        m = rcv[i];
                        m.deleteParameter("texture_lightMap");
                        m.deleteParameter("texture_dirLightMap");
                        m._shaderDefs &= ~pc.SHADERDEF_LM;
                        mask = m.mask;
                        m.mask = (mask | pc.MASK_DYNAMIC) & ~(pc.MASK_BAKED | pc.MASK_LIGHTMAP);
                    }
                }
            }
        }
    });


    Object.defineProperty(ModelComponent.prototype, "castShadows", {
        get: function () {
            return this._castShadows;
        },

        set: function (value) {
            if (this._castShadows === value) return;

            var layer;
            var i;
            var model = this._model;

            if (model) {
                var layers = this.layers;
                var scene = this.system.app.scene;
                if (this._castShadows && !value) {
                    for (i = 0; i < layers.length; i++) {
                        layer = this.system.app.scene.layers.getLayerById(this.layers[i]);
                        if (!layer) continue;
                        layer.removeShadowCasters(model.meshInstances);
                    }
                }

                var meshInstances = model.meshInstances;
                for (i = 0; i < meshInstances.length; i++) {
                    meshInstances[i].castShadow = value;
                }

                if (!this._castShadows && value) {
                    for (i = 0; i < layers.length; i++) {
                        layer = scene.layers.getLayerById(layers[i]);
                        if (!layer) continue;
                        layer.addShadowCasters(model.meshInstances);
                    }
                }
            }

            this._castShadows = value;
        }
    });

    Object.defineProperty(ModelComponent.prototype, 'receiveShadows', {
        get: function () {
            return this._receiveShadows;
        },

        set: function (value) {
            if (this._receiveShadows === value) return;

            this._receiveShadows = value;

            if (this._model) {
                var meshInstances = this._model.meshInstances;
                for (var i = 0, len = meshInstances.length; i < len; i++) {
                    meshInstances[i].receiveShadow = value;
                }
            }
        }
    });

    Object.defineProperty(ModelComponent.prototype, "castShadowsLightmap", {
        get: function () {
            return this._castShadowsLightmap;
        },

        set: function (value) {
            this._castShadowsLightmap = value;
        }
    });

    Object.defineProperty(ModelComponent.prototype, "lightmapSizeMultiplier", {
        get: function () {
            return this._lightmapSizeMultiplier;
        },

        set: function (value) {
            this._lightmapSizeMultiplier = value;
        }
    });


    Object.defineProperty(ModelComponent.prototype, "isStatic", {
        get: function () {
            return this._isStatic;
        },

        set: function (value) {
            if (this._isStatic === value) return;

            this._isStatic = value;

            var i, m;
            if (this._model) {
                var rcv = this._model.meshInstances;
                for (i = 0; i < rcv.length; i++) {
                    m = rcv[i];
                    m.isStatic = value;
                }
            }
        }
    });

    Object.defineProperty(ModelComponent.prototype, "layers", {
        get: function () {
            return this._layers;
        },

        set: function (value) {
            var i, layer;
            var layers = this.system.app.scene.layers;

            if (this.meshInstances) {
                // remove all meshinstances from old layers
                for (i = 0; i < this._layers.length; i++) {
                    layer = layers.getLayerById(this._layers[i]);
                    if (!layer) continue;
                    layer.removeMeshInstances(this.meshInstances);
                }
            }

            // set the layer list
            this._layers.length = 0;
            for (i = 0; i < value.length; i++) {
                this._layers[i] = value[i];
            }

            // don't add into layers until we're enabled
            if (!this.enabled || !this.entity.enabled || !this.meshInstances) return;

            // add all mesh instances to new layers
            for (i = 0; i < this._layers.length; i++) {
                layer = layers.getLayerById(this._layers[i]);
                if (!layer) continue;
                layer.addMeshInstances(this.meshInstances);
            }
        }
    });

    Object.defineProperty(ModelComponent.prototype, "batchGroupId", {
        get: function () {
            return this._batchGroupId;
        },

        set: function (value) {
            if (this._batchGroupId === value) return;

            var batcher = this.system.app.batcher;
            if (this.entity.enabled && this._batchGroupId >= 0) {
                batcher.remove(pc.BatchGroup.MODEL, this.batchGroupId, this.entity);
            }
            if (this.entity.enabled && value >= 0) {
                batcher.insert(pc.BatchGroup.MODEL, value, this.entity);
            }

            if (value < 0 && this._batchGroupId >= 0 && this.enabled && this.entity.enabled) {
                // re-add model to scene, in case it was removed by batching
                this.addModelToLayers();
            }

            this._batchGroupId = value;
        }
    });

    Object.defineProperty(ModelComponent.prototype, "materialAsset", {
        get: function () {
            return this._materialAsset;
        },

        set: function (value) {
            var _id = value;
            if (value instanceof pc.Asset) {
                _id = value.id;
            }

            var assets = this.system.app.assets;

            if (_id !== this._materialAsset) {
                if (this._materialAsset) {
                    assets.off('add:' + this._materialAsset, this._onMaterialAssetAdd, this);
                    var _prev = assets.get(this._materialAsset);
                    if (_prev) {
                        this._unbindMaterialAsset(_prev);
                    }
                }

                this._materialAsset = _id;

                if (this._materialAsset) {
                    var asset = assets.get(this._materialAsset);
                    if (!asset) {
                        this.material = this.system.defaultMaterial;
                        assets.on('add:' + this._materialAsset, this._onMaterialAssetAdd, this);
                    } else {
                        this._bindMaterialAsset(asset);
                    }
                } else {
                    this.material = this.system.defaultMaterial;
                }
            }
        }
    });

    Object.defineProperty(ModelComponent.prototype, "material", {
        get: function () {
            return this._material;
        },

        set: function (value) {
            if (this._material !== value) {
                this._material = value;

                var model = this._model;
                if (model && this._type !== 'asset') {
                    var meshInstances = model.meshInstances;
                    for (var i = 0, len = meshInstances.length; i < len; i++) {
                        meshInstances[i].material = value;
                    }
                }
            }
        }
    });

    Object.defineProperty(ModelComponent.prototype, "mapping", {
        get: function () {
            return this._mapping;
        },

        set: function (value) {
            if (this._type !== 'asset')
                return;

            // unsubscribe from old events
            this._unsetMaterialEvents();

            // can't have a null mapping
            if (!value)
                value = {};

            this._mapping = value;

            if (!this._model) return;

            var meshInstances = this._model.meshInstances;
            var modelAsset = this.asset ? this.system.app.assets.get(this.asset) : null;
            var assetMapping = modelAsset ? modelAsset.data.mapping : null;
            var asset = null;

            for (var i = 0, len = meshInstances.length; i < len; i++) {
                if (value[i] !== undefined) {
                    if (value[i]) {
                        asset = this.system.app.assets.get(value[i]);
                        this._loadAndSetMeshInstanceMaterial(asset, meshInstances[i], i);
                    } else {
                        meshInstances[i].material = this.system.defaultMaterial;
                    }
                } else if (assetMapping) {
                    if (assetMapping[i] && (assetMapping[i].material || assetMapping[i].path)) {
                        if (assetMapping[i].material !== undefined) {
                            asset = this.system.app.assets.get(assetMapping[i].material);
                        } else if (assetMapping[i].path !== undefined) {
                            var url = this._getMaterialAssetUrl(assetMapping[i].path);
                            if (url) {
                                asset = this.system.app.assets.getByUrl(url);
                            }
                        }
                        this._loadAndSetMeshInstanceMaterial(asset, meshInstances[i], i);
                    } else {
                        meshInstances[i].material = this.system.defaultMaterial;
                    }
                }
            }
        }
    });

    return {
        ModelComponent: ModelComponent
    };
}());
