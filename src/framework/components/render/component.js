import { LAYERID_WORLD, RENDERSTYLE_WIREFRAME } from '../../../scene/constants.js';
import { BatchGroup } from '../../../scene/batching.js';
import { MeshInstance } from '../../../scene/mesh-instance.js';
import { SkinInstance } from '../../../scene/skin-instance.js';
import { getShapePrimitive } from '../../../scene/procedural.js';

import { Asset } from '../../../asset/asset.js';
import { AssetReference } from '../../../asset/asset-reference.js';

import { Component } from '../component.js';
import { ComponentSystem } from '../system.js';

import { Entity } from '../../entity.js';

/**
 * @private
 * @component
 * @class
 * @name pc.RenderComponent
 * @augments pc.Component
 * @classdesc Enables an Entity to render a {@link pc.Mesh} or a primitive shape. This component attaches {@link pc.MeshInstance} geometry to the Entity.
 * @description Create a new RenderComponent.
 * @param {pc.RenderComponentSystem} system - The ComponentSystem that created this Component.
 * @param {pc.Entity} entity - The Entity that this Component is attached to.
 * @property {string} type The type of the render. Can be one of the following:
 * * "asset": The component will render a render asset
 * * "box": The component will render a box (1 unit in each dimension)
 * * "capsule": The component will render a capsule (radius 0.5, height 2)
 * * "cone": The component will render a cone (radius 0.5, height 1)
 * * "cylinder": The component will render a cylinder (radius 0.5, height 1)
 * * "plane": The component will render a plane (1 unit in each dimension)
 * * "sphere": The component will render a sphere (radius 0.5)
 * @property {pc.Asset|number} asset The render asset for the render component (only applies to type 'asset') - can also be an asset id.
 * @property {pc.Asset[]|number[]} materialAssets The material assets that will be used to render the meshes. Each material corresponds to the respective mesh instance.
 * @property {pc.Material} material The material {@link pc.Material} that will be used to render the meshes (not used on renders of type 'asset').
 * @property {boolean} castShadows If true, attached meshes will cast shadows for lights that have shadow casting enabled.
 * @property {boolean} receiveShadows If true, shadows will be cast on attached meshes.
 * @property {boolean} castShadowsLightmap If true, the meshes will cast shadows when rendering lightmaps.
 * @property {boolean} lightmapped If true, the meshes will be lightmapped after using lightmapper.bake().
 * @property {number} lightmapSizeMultiplier Lightmap resolution multiplier.
 * @property {boolean} isStatic Mark meshes as non-movable (optimization).
 * @property {pc.BoundingBox} aabb If set, the bounding box is used as a bounding box for visibility culling of attached mesh instances. This is an optimization,
 * allowing oversized bounding box to be specified for skinned characters in order to avoid per frame bounding box computations based on bone positions.
 * @property {pc.MeshInstance[]} meshInstances An array of meshInstances contained in the component. If meshes are not set or loaded for component it will return null.
 * @property {number} batchGroupId Assign meshes to a specific batch group (see {@link pc.BatchGroup}). Default value is -1 (no group).
 * @property {number[]} layers An array of layer IDs ({@link pc.Layer#id}) to which the meshes should belong.
 * Don't push/pop/splice or modify this array, if you want to change it - set a new one instead.
 * @property {pc.Entity} rootBone A reference to the entity to be used as the root bone for any skinned meshes that are rendered by this component.
 */
function RenderComponent(system, entity)   {
    Component.call(this, system, entity);

    this._type = 'asset';
    this._castShadows = true;
    this._receiveShadows = true;
    this._castShadowsLightmap = true;
    this._lightmapped = false;
    this._lightmapSizeMultiplier = 1;
    this._isStatic = false;
    this._batchGroupId = -1;

    this._meshInstances = [];
    this._layers = [LAYERID_WORLD]; // assign to the default world layer

    // bounding box which can be set to override bounding box based on mesh
    this._aabb = null;

    // area - used by lightmapper
    this._area = null;

    // the entity that represents the root bone if this render component has skinned meshes
    this._rootBone = null;

    // render asset reference
    this._assetReference = new AssetReference(
        'asset',
        this,
        system.app.assets, {
            add: this._onRenderAssetAdded,
            load: this._onRenderAssetLoad,
            remove: this._onRenderAssetRemove,
            unload: this._onRenderAssetUnload
        },
        this
    );

    // material used to render meshes other than asset type
    // it gets priority when set to something else than defaultMaterial, otherwise materialASsets[0] is used
    this._material = system.defaultMaterial;

    // material asset references
    this._materialReferences = [];

    entity.on('remove', this.onRemoveChild, this);
    entity.on('insert', this.onInsertChild, this);

    this.on('set_rootBone', this._onSetRootBone, this);
}
RenderComponent.prototype = Object.create(Component.prototype);
RenderComponent.prototype.constructor = RenderComponent;

Object.assign(RenderComponent.prototype, {

    _onSetRootBone: function (name, oldValue, newValue) {
        ComponentSystem.off('postinitialize', this._onPostInitialize, this);
        this._rootBone = newValue;

        if (!newValue) return;

        if (!(newValue instanceof Entity)) {
            var entity = this.system.app.root.findByGuid(newValue);
            if (entity) {
                this.rootBone = entity;
            } else {
                // handle GUID case - find entity by guid
                // and if not there yet do it in post initialize
                if (this.system._postInitialized) {
                    // TODO: error here? system has been postInitialized already
                    // so this entity is not going to be found
                } else {
                    ComponentSystem.on('postinitialize', this._onPostInitialize, this);
                }
            }
        } else {
            this._onFindRootBone();
        }
    },

    _onFindRootBone: function () {

        // remove existing skin instances and create new ones, connected to new root bone
        this._clearSkinInstances();
        this._cloneSkinInstances();
    },

    _onPostInitialize: function () {
        ComponentSystem.off('postinitialize', this._onPostInitialize, this);
        if (this._rootBone) {
            var entity = this.system.app.root.findByGuid(this._rootBone);
            if (entity) {
                this.rootBone = entity;
            }
        }
    },

    destroyMeshInstances: function () {

        var meshInstances = this._meshInstances;
        if (meshInstances) {
            this.removeFromLayers();

            for (var i = 0; i < meshInstances.length; i++) {
                meshInstances[i].destroy();
            }
            this._meshInstances.length = 0;
        }
    },

    addToLayers: function () {
        var layer, layers = this.system.app.scene.layers;
        for (var i = 0; i < this._layers.length; i++) {
            layer = layers.getLayerById(this._layers[i]);
            if (layer) {
                layer.addMeshInstances(this._meshInstances);
            }
        }
    },

    removeFromLayers: function () {

        if (this._meshInstances && this._meshInstances.length) {

            var layer, layers = this.system.app.scene.layers;
            for (var i = 0; i < this._layers.length; i++) {
                layer = layers.getLayerById(this._layers[i]);
                if (layer) {
                    layer.removeMeshInstances(this._meshInstances);
                }
            }
        }
    },

    onRemoveChild: function () {
        this.removeFromLayers();
    },

    onInsertChild: function () {
        if (this._meshInstances && this.enabled && this.entity.enabled) {
            this.addToLayers();
        }
    },

    onRemove: function () {
        ComponentSystem.off('postinitialize', this._onPostInitialize, this);

        this.destroyMeshInstances();

        this.asset = null;
        this.materialAsset = null;

        this.entity.off('remove', this.onRemoveChild, this);
        this.entity.off('insert', this.onInsertChild, this);
    },

    onLayersChanged: function (oldComp, newComp) {
        this.addToLayers();
        oldComp.off("add", this.onLayerAdded, this);
        oldComp.off("remove", this.onLayerRemoved, this);
        newComp.on("add", this.onLayerAdded, this);
        newComp.on("remove", this.onLayerRemoved, this);
    },

    onLayerAdded: function (layer) {
        var index = this.layers.indexOf(layer.id);
        if (index < 0) return;
        layer.addMeshInstances(this._meshInstances);
    },

    onLayerRemoved: function (layer) {
        var index = this.layers.indexOf(layer.id);
        if (index < 0) return;
        layer.removeMeshInstances(this._meshInstances);
    },

    onEnable: function () {
        var app = this.system.app;
        var scene = app.scene;

        // this._rootBone.onParentComponentEnable();

        scene.on("set:layers", this.onLayersChanged, this);
        if (scene.layers) {
            scene.layers.on("add", this.onLayerAdded, this);
            scene.layers.on("remove", this.onLayerRemoved, this);
        }

        var isAsset = (this._type === 'asset');
        if (this._meshInstances && this._meshInstances.length) {
            this.addToLayers();
        } else if (isAsset && this.asset) {
            this._onRenderAssetAdded();
        }

        // load materials
        for (var i = 0; i < this._materialReferences.length; i++) {
            if (this._materialReferences[i].asset) {
                this.system.app.assets.load(this._materialReferences[i].asset);
            }
        }

        if (this._batchGroupId >= 0) {
            app.batcher.insert(BatchGroup.RENDER, this.batchGroupId, this.entity);
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
            app.batcher.remove(BatchGroup.RENDER, this.batchGroupId, this.entity);
        }

        this.removeFromLayers();
    },

    /**
     * @private
     * @function
     * @name pc.RenderComponent#hide
     * @description Stop rendering {@link pc.MeshInstance}s without removing them from the scene hierarchy.
     * This method sets the {@link pc.MeshInstance#visible} property of every MeshInstance to false.
     * Note, this does not remove the mesh instances from the scene hierarchy or draw call list.
     * So the render component still incurs some CPU overhead.
     */
    hide: function () {
        if (this._meshInstances) {
            for (var i = 0; i < this._meshInstances.length; i++) {
                this._meshInstances[i].visible = false;
            }
        }
    },

    /**
     * @private
     * @function
     * @name pc.RenderComponent#show
     * @description Enable rendering of the render {@link pc.MeshInstance}s if hidden using {@link pc.RenderComponent#hide}.
     * This method sets all the {@link pc.MeshInstance#visible} property on all mesh instances to true.
     */
    show: function () {
        if (this._meshInstances) {
            for (var i = 0; i < this._meshInstances.length; i++) {
                this._meshInstances[i].visible = true;
            }
        }
    },

    _onRenderAssetAdded: function () {
        if (!this._assetReference.asset) return;

        if (this._assetReference.asset.resource) {
            this._onRenderAssetLoad();
        } else if (this.enabled && this.entity.enabled) {
            this.system.app.assets.load(this._assetReference.asset);
        }
    },

    _onRenderAssetLoad: function () {

        // remove existing instances
        this.destroyMeshInstances();

        var render = this._assetReference.asset.resource;
        if (render.meshes) {
            this._onSetMeshes(render.meshes);
        } else {
            render.once('set:meshes', this._onSetMeshes, this);
        }
    },

    _onSetMeshes: function (meshes) {
        this._cloneMeshes(meshes);
    },

    _clearSkinInstances: function () {

        for (var i = 0; i < this._meshInstances.length; i++) {
            this._meshInstances[i].skinInstance = null;
        }
    },

    _cloneSkinInstances: function () {

        if (this._meshInstances.length && this._rootBone) {

            var j, skin, skinInst;

            // maps each unique original skin to cloned skin instance
            var skins = new Map();

            for (var i = 0; i < this._meshInstances.length; i++) {
                var meshInstance = this._meshInstances[i];
                var mesh = meshInstance.mesh;

                // if skinned but does not have instance created yet
                if (mesh.skin && !mesh.skinInstance) {

                    skin = mesh.skin;
                    skinInst = skins.get(skin);

                    // don't have skin instance for this skin
                    if (!skinInst) {

                        skinInst = new SkinInstance(skin);
                        skins.set(skin, skinInst);

                        // Resolve bone IDs to actual graph nodes
                        var bones = [];
                        for (j = 0; j < skin.boneNames.length; j++) {
                            var boneName = skin.boneNames[j];
                            var bone = this._rootBone.findByName(boneName);

                            if (!bone) {
                                console.error("Failed to find bone [", boneName, "] in the entity hierarchy, RenderComponent on ", this.entity.name, ", rootBone: ", this._rootBone.name);
                                bone = this.entity;
                            }

                            bones.push(bone);
                        }
                        skinInst.bones = bones;
                    }

                    meshInstance.skinInstance = skinInst;
                }
            }
        }
    },

    _cloneMeshes: function (meshes) {

        if (meshes.length) {

            // cloned mesh instances
            var meshInstances = [];

            for (var i = 0; i < meshes.length; i++) {

                // mesh instance
                var mesh = meshes[i];
                var material = this._materialReferences[i] && this._materialReferences[i].asset && this._materialReferences[i].asset.resource;
                var meshInst = new MeshInstance(this.entity, mesh, material || this.system.defaultMaterial);
                meshInstances.push(meshInst);

                // morph instance
                if (mesh.morph) {
                    meshInst.morphInstance = new MorphInstance(mesh.morph);
                }
            }

            this.meshInstances = meshInstances;

            // try to create skin instances if rootBone has been set, otherwise this executes when rootBone is set later
            this._cloneSkinInstances();
        }
    },

    _onRenderAssetUnload: function () {
        this.destroyMeshInstances();
    },

    _onRenderAssetRemove: function () {
        if (this._assetReference.asset && this._assetReference.asset.resource) {
            this._assetReference.asset.resource.off('set:meshes', this._onSetMeshes, this);
        }

        this._onRenderAssetUnload();
    },

    _onMaterialAdded: function (index, component, asset) {
        if (asset.resource) {
            this._onMaterialLoad(index, component, asset);
        } else {
            if (this.enabled && this.entity.enabled) {
                this.system.app.assets.load(asset);
            }
        }
    },

    _onMaterialLoad: function (index, component, asset) {
        if (this._meshInstances[index]) {
            this._meshInstances[index].material = asset.resource;
        }
    },

    _onMaterialRemove: function (index, component, asset) {
        if (this._meshInstances[index]) {
            this._meshInstances[index].material = this.system.defaultMaterial;
        }
    },

    _onMaterialUnload: function (index, component, asset) {
        if (this._meshInstances[index]) {
            this._meshInstances[index].material = this.system.defaultMaterial;
        }
    },

    /**
     * @private
     * @function
     * @name pc.RenderComponent#generateWireframe
     * @description Generates the necessary internal data for this component to be
     * renderable as wireframe. Once this function has been called, any mesh
     * instance can have its renderStyle property set to pc.RENDERSTYLE_WIREFRAME.
     * @example
     * render.generateWireframe();
     * for (var i = 0; i < render.meshInstances.length; i++) {
     *     render.meshInstances[i].renderStyle = pc.RENDERSTYLE_WIREFRAME;
     * }
     */
    generateWireframe: function () {

        // Build an array of unique meshes
        var i, mesh, meshes = [];
        for (i = 0; i < this._meshInstances.length; i++) {
            mesh = this._meshInstances[i].mesh;
            if (meshes.indexOf(mesh) === -1) {
                meshes.push(mesh);
            }
        }

        for (i = 0; i < meshes.length; ++i) {
            mesh = meshes[i];
            if (!mesh.primitive[RENDERSTYLE_WIREFRAME]) {
                mesh.generateWireframe();
            }
        }
    }
});

Object.defineProperties(RenderComponent.prototype, {

    "aabb": {
        get: function () {
            return this._aabb;
        },
        set: function (value) {
            this._aabb = value;

            // set it on meshInstances
            var mi = this._meshInstances;
            if (mi) {
                for (var i = 0; i < mi.length; i++) {
                    mi[i].setOverrideAabb(this._aabb);
                }
            }
        }
    },

    "type": {
        get: function () {
            return this._type;
        },

        set: function (value) {

            if (this._type !== value) {
                this._area = null;
                this._type = value;

                this.destroyMeshInstances();

                if (value !== 'asset') {
                    var material = this._material;
                    if (!material || material === this.system.defaultMaterial) {
                        material = this._materialReferences[0] &&
                                   this._materialReferences[0].asset &&
                                   this._materialReferences[0].asset.resource;
                    }

                    var primData = getShapePrimitive(this.system.app.graphicsDevice, value);
                    this._area = primData.area;
                    this.meshInstances = [new MeshInstance(this.entity, primData.mesh, material || this.system.defaultMaterial)];

                    if (this.system._inTools)
                        this.generateWireframe();
                }
            }
        }
    },

    "meshInstances": {
        get: function () {
            return this._meshInstances;
        },

        set: function (value) {

            this.destroyMeshInstances();

            this._meshInstances = value;

            if (this._meshInstances) {

                var mi = this._meshInstances;
                for (var i = 0; i < mi.length; i++) {
                    mi[i].castShadow = this._castShadows;
                    mi[i].receiveShadow = this._receiveShadows;
                    mi[i].isStatic = this._isStatic;
                    mi[i].setLightmapped(this._lightmapped);
                    mi[i].setOverrideAabb(this._aabb);
                }

                if (this.enabled && this.entity.enabled) {
                    this.addToLayers();
                }
            }
        }
    },

    "lightmapped": {
        get: function () {
            return this._lightmapped;
        },
        set: function (value) {
            if (value !== this._lightmapped) {
                this._lightmapped = value;

                var mi = this._meshInstances;
                if (mi) {
                    for (var i = 0; i < mi.length; i++) {
                        mi[i].setLightmapped(value);
                    }
                }
            }
        }
    },

    "castShadows": {
        get: function () {
            return this._castShadows;
        },

        set: function (value) {
            if (this._castShadows !== value) {

                var i, layer, mi = this._meshInstances;

                if (mi) {
                    var layers = this.layers;
                    var scene = this.system.app.scene;
                    if (this._castShadows && !value) {
                        for (i = 0; i < layers.length; i++) {
                            layer = scene.layers.getLayerById(this.layers[i]);
                            if (layer) {
                                layer.removeShadowCasters(mi);
                            }
                        }
                    }

                    for (i = 0; i < mi.length; i++) {
                        mi[i].castShadow = value;
                    }

                    if (!this._castShadows && value) {
                        for (i = 0; i < layers.length; i++) {
                            layer = scene.layers.getLayerById(layers[i]);
                            if (layer) {
                                layer.addShadowCasters(mi);
                            }
                        }
                    }
                }

                this._castShadows = value;
            }
        }
    },

    "receiveShadows": {
        get: function () {
            return this._receiveShadows;
        },

        set: function (value) {
            if (this._receiveShadows !== value) {

                this._receiveShadows = value;

                var mi = this._meshInstances;
                if (mi) {
                    for (var i = 0; i < mi.length; i++) {
                        mi[i].receiveShadow = value;
                    }
                }
            }
        }
    },

    "castShadowsLightmap": {
        get: function () {
            return this._castShadowsLightmap;
        },

        set: function (value) {
            this._castShadowsLightmap = value;
        }
    },

    "lightmapSizeMultiplier": {
        get: function () {
            return this._lightmapSizeMultiplier;
        },

        set: function (value) {
            this._lightmapSizeMultiplier = value;
        }
    },

    "isStatic": {
        get: function () {
            return this._isStatic;
        },

        set: function (value) {
            if (this._isStatic !== value) {
                this._isStatic = value;

                var mi = this._meshInstances;
                if (mi) {
                    for (var i = 0; i < mi.length; i++) {
                        mi[i].isStatic = value;
                    }
                }
            }
        }
    },

    "layers": {
        get: function () {
            return this._layers;
        },

        set: function (value) {

            var i, layer, layers = this.system.app.scene.layers;

            if (this._meshInstances) {
                // remove all meshinstances from old layers
                for (i = 0; i < this._layers.length; i++) {
                    layer = layers.getLayerById(this._layers[i]);
                    if (layer) {
                        layer.removeMeshInstances(this._meshInstances);
                    }
                }
            }

            // set the layer list
            this._layers.length = 0;
            for (i = 0; i < value.length; i++) {
                this._layers[i] = value[i];
            }

            // don't add into layers until we're enabled
            if (!this.enabled || !this.entity.enabled || !this._meshInstances) return;

            // add all mesh instances to new layers
            for (i = 0; i < this._layers.length; i++) {
                layer = layers.getLayerById(this._layers[i]);
                if (layer) {
                    layer.addMeshInstances(this._meshInstances);
                }
            }
        }
    },

    "batchGroupId": {
        get: function () {
            return this._batchGroupId;
        },

        set: function (value) {
            if (this._batchGroupId !== value) {

                var batcher = this.system.app.batcher;
                if (this.entity.enabled && this._batchGroupId >= 0) {
                    batcher.remove(BatchGroup.RENDER, this.batchGroupId, this.entity);
                }
                if (this.entity.enabled && value >= 0) {
                    batcher.insert(BatchGroup.RENDER, value, this.entity);
                }

                if (value < 0 && this._batchGroupId >= 0 && this.enabled && this.entity.enabled) {
                    // re-add render to scene, in case it was removed by batching
                    this.addToLayers();
                }

                this._batchGroupId = value;
            }
        }
    },

    "material": {
        get: function () {
            return this._material;
        },
        set: function (value) {
            if (this._material !== value) {
                this._material = value;

                if (this._meshInstances && this._type !== 'asset') {
                    for (var i = 0; i < this._meshInstances.length; i++) {
                        this._meshInstances[i].material = value;
                    }
                }
            }
        }
    },

    "materialAssets": {
        get: function () {
            return this._materialReferences.map(function (ref) {
                return ref.id;
            });
        },

        set: function (value) {
            var i;
            value = value || [];
            if (this._materialReferences.length > value.length) {
                for (i = value.length; i < this._materialReferences.length; i++) {
                    this._materialReferences[i].id = null;
                }
                this._materialReferences.length = value.length;
            }

            for (i = 0; i < value.length; i++) {
                if (!this._materialReferences[i]) {
                    this._materialReferences.push(
                        new AssetReference(
                            i,
                            this,
                            this.system.app.assets, {
                                add: this._onMaterialAdded,
                                load: this._onMaterialLoad,
                                remove: this._onMaterialRemove,
                                unload: this._onMaterialUnload
                            },
                            this
                        )
                    );
                }

                if (value[i]) {
                    var id = value[i] instanceof Asset ? value[i].id : value[i];
                    if (this._materialReferences[i].id !== id) {
                        this._materialReferences[i].id = id;
                    }

                    if (this._materialReferences[i].asset) {
                        this._onMaterialAdded(i, this, this._materialReferences[i].asset);
                    }
                } else {
                    this._materialReferences[i].id = null;

                    if (this._meshInstances[i]) {
                        this._meshInstances[i].material = this.system.defaultMaterial;
                    }
                }
            }
        }
    },

    "asset": {
        get: function () {
            return this._assetReference.id;
        },

        set: function (value) {
            var id = (value instanceof Asset ? value.id : value);
            if (this._assetReference.id === id) return;

            if (this._assetReference.asset && this._assetReference.asset.resource) {
                this._onRenderAssetRemove();
            }

            this._assetReference.id = id;

            if (this._assetReference.asset) {
                this._onRenderAssetAdded();
            }
        }
    }
});

export { RenderComponent };
