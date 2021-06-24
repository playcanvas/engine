import {
    LAYERID_WORLD
} from '../../../scene/constants.js';
import { BatchGroup } from '../../../scene/batching/batch-group.js';
import { GraphNode } from '../../../scene/graph-node.js';
import { MeshInstance } from '../../../scene/mesh-instance.js';
import { Model } from '../../../scene/model.js';
import { getShapePrimitive } from '../../../scene/procedural.js';

import { Asset } from '../../../asset/asset.js';

import { Component } from '../component.js';

/**
 * @component
 * @class
 * @name ModelComponent
 * @augments Component
 * @classdesc Enables an Entity to render a model or a primitive shape. This Component attaches additional model
 * geometry in to the scene graph below the Entity.
 * @description Create a new ModelComponent.
 * @param {ModelComponentSystem} system - The ComponentSystem that created this Component.
 * @param {Entity} entity - The Entity that this Component is attached to.
 * @property {string} type The type of the model. Can be one of the following:
 * * "asset": The component will render a model asset
 * * "box": The component will render a box (1 unit in each dimension)
 * * "capsule": The component will render a capsule (radius 0.5, height 2)
 * * "cone": The component will render a cone (radius 0.5, height 1)
 * * "cylinder": The component will render a cylinder (radius 0.5, height 1)
 * * "plane": The component will render a plane (1 unit in each dimension)
 * * "sphere": The component will render a sphere (radius 0.5)
 * @property {Asset|number} asset The asset for the model (only applies to models of type 'asset') - can also be an asset id.
 * @property {boolean} castShadows If true, this model will cast shadows for lights that have shadow casting enabled.
 * @property {boolean} receiveShadows If true, shadows will be cast on this model.
 * @property {Material} material The material {@link Material} that will be used to render the model (not used on models of type 'asset').
 * @property {Asset|number} materialAsset The material {@link Asset} that will be used to render the model (not used on models of type 'asset').
 * @property {Model} model The model that is added to the scene graph. It can be not set or loaded, so will return null.
 * @property {object} mapping A dictionary that holds material overrides for each mesh instance. Only applies to model
 * components of type 'asset'. The mapping contains pairs of mesh instance index - material asset id.
 * @property {boolean} castShadowsLightmap If true, this model will cast shadows when rendering lightmaps.
 * @property {boolean} lightmapped If true, this model will be lightmapped after using lightmapper.bake().
 * @property {number} lightmapSizeMultiplier Lightmap resolution multiplier.
 * @property {boolean} isStatic Mark model as non-movable (optimization).
 * @property {BoundingBox} customAabb If set, the object space bounding box is used as a bounding box for visibility culling of attached mesh instances. This is an optimization,
 * allowing oversized bounding box to be specified for skinned characters in order to avoid per frame bounding box computations based on bone positions.
 * @property {MeshInstance[]} meshInstances An array of meshInstances contained in the component's model. If model is not set or loaded for component it will return null.
 * @property {number} batchGroupId Assign model to a specific batch group (see {@link BatchGroup}). Default value is -1 (no group).
 * @property {number[]} layers An array of layer IDs ({@link Layer#id}) to which this model should belong.
 * Don't push/pop/splice or modify this array, if you want to change it - set a new one instead.
 */
class ModelComponent extends Component {
    constructor(system, entity)   {
        super(system, entity);

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

        this._layers = [LAYERID_WORLD]; // assign to the default world layer
        this._batchGroupId = -1;

        // bounding box which can be set to override bounding box based on mesh
        this._customAabb = null;

        this._area = null;

        this._assetOld = 0;
        this._materialEvents = null;
        this._dirtyModelAsset = false;
        this._dirtyMaterialAsset = false;

        this._clonedModel = false;

        // #if _DEBUG
        this._batchGroup = null;
        // #endif

        entity.on('remove', this.onRemoveChild, this);
        entity.on('insert', this.onInsertChild, this);
    }

    addModelToLayers() {
        const layers = this.system.app.scene.layers;
        for (var i = 0; i < this._layers.length; i++) {
            const layer = layers.getLayerById(this._layers[i]);
            if (layer) {
                layer.addMeshInstances(this.meshInstances);
            }
        }
    }

    removeModelFromLayers() {
        var layer;
        var layers = this.system.app.scene.layers;

        for (var i = 0; i < this._layers.length; i++) {
            layer = layers.getLayerById(this._layers[i]);
            if (!layer) continue;
            layer.removeMeshInstances(this.meshInstances);
        }
    }

    onRemoveChild() {
        if (this._model)
            this.removeModelFromLayers();
    }

    onInsertChild() {
        if (this._model && this.enabled && this.entity.enabled)
            this.addModelToLayers();
    }

    onRemove() {
        if (this.type === 'asset') {
            this.asset = null;
        } else {
            this.model = null;
        }
        this.materialAsset = null;
        this._unsetMaterialEvents();

        this.entity.off('remove', this.onRemoveChild, this);
        this.entity.off('insert', this.onInsertChild, this);
    }

    onLayersChanged(oldComp, newComp) {
        this.addModelToLayers();
        oldComp.off("add", this.onLayerAdded, this);
        oldComp.off("remove", this.onLayerRemoved, this);
        newComp.on("add", this.onLayerAdded, this);
        newComp.on("remove", this.onLayerRemoved, this);
    }

    onLayerAdded(layer) {
        var index = this.layers.indexOf(layer.id);
        if (index < 0) return;
        layer.addMeshInstances(this.meshInstances);
    }

    onLayerRemoved(layer) {
        var index = this.layers.indexOf(layer.id);
        if (index < 0) return;
        layer.removeMeshInstances(this.meshInstances);
    }

    _setMaterialEvent(index, event, id, handler) {
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
    }

    _unsetMaterialEvents() {
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
    }

    _getAssetByIdOrPath(idOrPath) {
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
    }

    _getMaterialAssetUrl(path) {
        if (!this.asset) return null;

        var modelAsset = this.system.app.assets.get(this.asset);

        return modelAsset ? modelAsset.getAbsoluteUrl(path) : null;
    }

    _loadAndSetMeshInstanceMaterial(materialAsset, meshInstance, index) {
        var assets = this.system.app.assets;

        if (!materialAsset)
            return;

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

    onEnable() {
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
            app.batcher.insert(BatchGroup.MODEL, this.batchGroupId, this.entity);
        }
    }

    onDisable() {
        var app = this.system.app;
        var scene = app.scene;

        scene.off("set:layers", this.onLayersChanged, this);
        if (scene.layers) {
            scene.layers.off("add", this.onLayerAdded, this);
            scene.layers.off("remove", this.onLayerRemoved, this);
        }

        if (this._batchGroupId >= 0) {
            app.batcher.remove(BatchGroup.MODEL, this.batchGroupId, this.entity);
        }

        if (this._model) {
            this.removeModelFromLayers();
        }
    }

    /**
     * @function
     * @name ModelComponent#hide
     * @description Stop rendering model without removing it from the scene hierarchy.
     * This method sets the {@link MeshInstance#visible} property of every MeshInstance in the model to false
     * Note, this does not remove the model or mesh instances from the scene hierarchy or draw call list.
     * So the model component still incurs some CPU overhead.
     * @example
     * this.timer = 0;
     * this.visible = true;
     * // ...
     * // blink model every 0.1 seconds
     * this.timer += dt;
     * if (this.timer > 0.1) {
     *     if (!this.visible) {
     *         this.entity.model.show();
     *         this.visible = true;
     *     } else {
     *         this.entity.model.hide();
     *         this.visible = false;
     *     }
     *     this.timer = 0;
     * }
     */
    hide() {
        if (this._model) {
            var i, l;
            var instances = this._model.meshInstances;
            for (i = 0, l = instances.length; i < l; i++) {
                instances[i].visible = false;
            }
        }
    }

    /**
     * @function
     * @name ModelComponent#show
     * @description Enable rendering of the model if hidden using {@link ModelComponent#hide}.
     * This method sets all the {@link MeshInstance#visible} property on all mesh instances to true.
     */
    show() {
        if (this._model) {
            var i, l;
            var instances = this._model.meshInstances;
            for (i = 0, l = instances.length; i < l; i++) {
                instances[i].visible = true;
            }
        }
    }

    _bindMaterialAsset(asset) {
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
    }

    _unbindMaterialAsset(asset) {
        asset.off('load', this._onMaterialAssetLoad, this);
        asset.off('unload', this._onMaterialAssetUnload, this);
        asset.off('remove', this._onMaterialAssetRemove, this);
        asset.off('change', this._onMaterialAssetChange, this);
    }

    _onMaterialAssetAdd(asset) {
        this.system.app.assets.off('add:' + asset.id, this._onMaterialAssetAdd, this);
        if (this._materialAsset === asset.id) {
            this._bindMaterialAsset(asset);
        }
    }

    _onMaterialAssetLoad(asset) {
        this._setMaterial(asset.resource);
    }

    _onMaterialAssetUnload(asset) {
        this._setMaterial(this.system.defaultMaterial);
    }

    _onMaterialAssetRemove(asset) {
        this._onMaterialAssetUnload(asset);
    }

    _onMaterialAssetChange(asset) {
    }

    _bindModelAsset(asset) {
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
    }

    _unbindModelAsset(asset) {
        asset.off('load', this._onModelAssetLoad, this);
        asset.off('unload', this._onModelAssetUnload, this);
        asset.off('change', this._onModelAssetChange, this);
        asset.off('remove', this._onModelAssetRemove, this);
    }

    _onModelAssetAdded(asset) {
        this.system.app.assets.off('add:' + asset.id, this._onModelAssetAdded, this);
        if (asset.id === this._asset) {
            this._bindModelAsset(asset);
        }
    }

    _onModelAssetLoad(asset) {
        this.model = asset.resource.clone();
        this._clonedModel = true;
    }

    _onModelAssetUnload(asset) {
        this.model = null;
    }

    _onModelAssetChange(asset, attr, _new, _old) {
        if (attr === 'data') {
            this.mapping = this._mapping;
        }
    }

    _onModelAssetRemove(asset) {
        this.model = null;
    }

    _setMaterial(material) {
        if (this._material === material)
            return;

        this._material = material;

        var model = this._model;
        if (model && this._type !== 'asset') {
            var meshInstances = model.meshInstances;
            for (var i = 0, len = meshInstances.length; i < len; i++) {
                meshInstances[i].material = material;
            }
        }
    }

    get meshInstances() {
        if (!this._model)
            return null;

        return this._model.meshInstances;
    }

    set meshInstances(value) {
        if (!this._model)
            return;

        this._model.meshInstances = value;
    }

    get customAabb() {
        return this._customAabb;
    }

    set customAabb(value) {
        this._customAabb = value;

        // set it on meshInstances
        if (this._model) {
            var mi = this._model.meshInstances;
            if (mi) {
                for (var i = 0; i < mi.length; i++) {
                    mi[i].setCustomAabb(this._customAabb);
                }
            }
        }
    }

    get type() {
        return this._type;
    }

    set type(value) {
        if (this._type === value) return;

        this._area = null;

        this._type = value;

        if (value === 'asset') {
            if (this._asset !== null) {
                this._bindModelAsset(this._asset);
            } else {
                this.model = null;
            }
        } else {

            // get / create mesh of type
            var primData = getShapePrimitive(this.system.app.graphicsDevice, value);
            this._area = primData.area;
            var mesh = primData.mesh;

            var node = new GraphNode();
            var model = new Model();
            model.graph = node;

            model.meshInstances = [new MeshInstance(mesh, this._material, node)];

            this.model = model;
            this._asset = null;
        }
    }

    get asset() {
        return this._asset;
    }

    set asset(value) {
        var assets = this.system.app.assets;
        var _id = value;

        if (value instanceof Asset) {
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

    get model() {
        return this._model;
    }

    set model(value) {
        var i;

        if (this._model === value)
            return;

        // return if the model has been flagged as immutable
        if (value && value._immutable) {
            // #if _DEBUG
            console.error('Invalid attempt to assign a model to multiple ModelComponents');
            // #endif
            return;
        }

        if (this._model) {
            this._model._immutable = false;

            this.removeModelFromLayers();
            this.entity.removeChild(this._model.getGraph());
            delete this._model._entity;

            if (this._clonedModel) {
                this._model.destroy();
                this._clonedModel = false;
            }
        }

        this._model = value;

        if (this._model) {
            // flag the model as being assigned to a component
            this._model._immutable = true;

            var meshInstances = this._model.meshInstances;

            for (i = 0; i < meshInstances.length; i++) {
                meshInstances[i].castShadow = this._castShadows;
                meshInstances[i].receiveShadow = this._receiveShadows;
                meshInstances[i].isStatic = this._isStatic;
                meshInstances[i].setCustomAabb(this._customAabb);
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

            // Update any animation component
            if (this.entity.anim) {
                if (this.entity.anim.playing) {
                    this.entity.anim.rebind();
                } else {
                    this.entity.anim.resetStateGraph();
                }
            }
            // trigger event handler to load mapping
            // for new model
            if (this.type === 'asset') {
                this.mapping = this._mapping;
            } else {
                this._unsetMaterialEvents();
            }
        }
    }

    get lightmapped() {
        return this._lightmapped;
    }

    set lightmapped(value) {
        if (value !== this._lightmapped) {

            this._lightmapped = value;

            if (this._model) {
                var mi = this._model.meshInstances;
                for (var i = 0; i < mi.length; i++) {
                    mi[i].setLightmapped(value);
                }
            }
        }
    }

    get castShadows() {
        return this._castShadows;
    }

    set castShadows(value) {
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

    get receiveShadows() {
        return this._receiveShadows;
    }

    set receiveShadows(value) {
        if (this._receiveShadows === value) return;

        this._receiveShadows = value;

        if (this._model) {
            var meshInstances = this._model.meshInstances;
            for (var i = 0, len = meshInstances.length; i < len; i++) {
                meshInstances[i].receiveShadow = value;
            }
        }
    }

    get castShadowsLightmap() {
        return this._castShadowsLightmap;
    }

    set castShadowsLightmap(value) {
        this._castShadowsLightmap = value;
    }

    get lightmapSizeMultiplier() {
        return this._lightmapSizeMultiplier;
    }

    set lightmapSizeMultiplier(value) {
        this._lightmapSizeMultiplier = value;
    }

    get isStatic() {
        return this._isStatic;
    }

    set isStatic(value) {
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

    get layers() {
        return this._layers;
    }

    set layers(value) {
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

    get batchGroupId() {
        return this._batchGroupId;
    }

    set batchGroupId(value) {
        if (this._batchGroupId === value) return;

        var batcher = this.system.app.batcher;
        if (this.entity.enabled && this._batchGroupId >= 0) {
            batcher.remove(BatchGroup.MODEL, this.batchGroupId, this.entity);
        }
        if (this.entity.enabled && value >= 0) {
            batcher.insert(BatchGroup.MODEL, value, this.entity);
        }

        if (value < 0 && this._batchGroupId >= 0 && this.enabled && this.entity.enabled) {
            // re-add model to scene, in case it was removed by batching
            this.addModelToLayers();
        }

        this._batchGroupId = value;
    }

    get materialAsset() {
        return this._materialAsset;
    }

    set materialAsset(value) {
        var _id = value;
        if (value instanceof Asset) {
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
                    this._setMaterial(this.system.defaultMaterial);
                    assets.on('add:' + this._materialAsset, this._onMaterialAssetAdd, this);
                } else {
                    this._bindMaterialAsset(asset);
                }
            } else {
                this._setMaterial(this.system.defaultMaterial);
            }
        }
    }

    get material() {
        return this._material;
    }

    set material(value) {
        if (this._material === value)
            return;

        this.materialAsset = null;

        this._setMaterial(value);
    }

    get mapping() {
        return this._mapping;
    }

    set mapping(value) {
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
}

export { ModelComponent };
