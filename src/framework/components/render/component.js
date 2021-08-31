import { LAYERID_WORLD, RENDERSTYLE_SOLID } from '../../../scene/constants.js';
import { BatchGroup } from '../../../scene/batching/batch-group.js';
import { MeshInstance } from '../../../scene/mesh-instance.js';
import { MorphInstance } from '../../../scene/morph-instance.js';
import { getShapePrimitive } from '../../../scene/procedural.js';
import { GraphNode } from '../../../scene/graph-node.js';
import { SkinInstanceCache } from '../../../scene/skin-instance-cache.js';

import { Asset } from '../../../asset/asset.js';
import { AssetReference } from '../../../asset/asset-reference.js';

import { Component } from '../component.js';

import { EntityReference } from '../../utils/entity-reference.js';

/**
 * @component
 * @class
 * @name RenderComponent
 * @augments Component
 * @classdesc Enables an Entity to render a {@link Mesh} or a primitive shape. This component attaches {@link MeshInstance} geometry to the Entity.
 * @description Create a new RenderComponent.
 * @param {RenderComponentSystem} system - The ComponentSystem that created this Component.
 * @param {Entity} entity - The Entity that this Component is attached to.
 * @property {string} type The type of the render. Can be one of the following:
 * * "asset": The component will render a render asset
 * * "box": The component will render a box (1 unit in each dimension)
 * * "capsule": The component will render a capsule (radius 0.5, height 2)
 * * "cone": The component will render a cone (radius 0.5, height 1)
 * * "cylinder": The component will render a cylinder (radius 0.5, height 1)
 * * "plane": The component will render a plane (1 unit in each dimension)
 * * "sphere": The component will render a sphere (radius 0.5)
 * @property {Asset|number} asset The render asset for the render component (only applies to type 'asset') - can also be an asset id.
 * @property {Asset[]|number[]} materialAssets The material assets that will be used to render the meshes. Each material corresponds to the respective mesh instance.
 * @property {Material} material The material {@link Material} that will be used to render the meshes (not used on renders of type 'asset').
 * @property {boolean} castShadows If true, attached meshes will cast shadows for lights that have shadow casting enabled.
 * @property {boolean} receiveShadows If true, shadows will be cast on attached meshes.
 * @property {boolean} castShadowsLightmap If true, the meshes will cast shadows when rendering lightmaps.
 * @property {boolean} lightmapped If true, the meshes will be lightmapped after using lightmapper.bake().
 * @property {number} lightmapSizeMultiplier Lightmap resolution multiplier.
 * @property {boolean} isStatic Mark meshes as non-movable (optimization).
 * @property {BoundingBox} customAabb If set, the object space bounding box is used as a bounding box for visibility culling of attached mesh instances. This is an optimization,
 * allowing oversized bounding box to be specified for skinned characters in order to avoid per frame bounding box computations based on bone positions.
 * @property {MeshInstance[]} meshInstances An array of meshInstances contained in the component. If meshes are not set or loaded for component it will return null.
 * @property {number} batchGroupId Assign meshes to a specific batch group (see {@link BatchGroup}). Default value is -1 (no group).
 * @property {number[]} layers An array of layer IDs ({@link Layer#id}) to which the meshes should belong.
 * Don't push/pop/splice or modify this array, if you want to change it - set a new one instead.
 * @property {Entity} rootBone A reference to the entity to be used as the root bone for any skinned meshes that are rendered by this component.
 * @property {number} renderStyle Set rendering of all {@link MeshInstance}s to the specified render style. Can be one of the following:
 * * {@link RENDERSTYLE_SOLID}
 * * {@link RENDERSTYLE_WIREFRAME}
 * * {@link RENDERSTYLE_POINTS}
 */
class RenderComponent extends Component {
    constructor(system, entity)   {
        super(system, entity);

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
        this._renderStyle = RENDERSTYLE_SOLID;

        // bounding box which can be set to override bounding box based on mesh
        this._customAabb = null;

        // area - used by lightmapper
        this._area = null;

        // the entity that represents the root bone if this render component has skinned meshes
        this._rootBone = new EntityReference(this, 'rootBone');
        this._rootBone.on('set:entity', this._onSetRootBone, this);

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
    }

    _onSetRootBone(entity) {
        if (entity) {
            this._onRootBoneChanged();
        }
    }

    _onRootBoneChanged() {
        // remove existing skin instances and create new ones, connected to new root bone
        this._clearSkinInstances();
        this._cloneSkinInstances();
    }

    destroyMeshInstances() {

        var meshInstances = this._meshInstances;
        if (meshInstances) {
            this.removeFromLayers();

            // destroy mesh instances separately to allow them to be removed from the cache
            this._clearSkinInstances();

            for (var i = 0; i < meshInstances.length; i++) {
                meshInstances[i].destroy();
            }
            this._meshInstances.length = 0;
        }
    }

    addToLayers() {
        const layers = this.system.app.scene.layers;
        for (var i = 0; i < this._layers.length; i++) {
            const layer = layers.getLayerById(this._layers[i]);
            if (layer) {
                layer.addMeshInstances(this._meshInstances);
            }
        }
    }

    removeFromLayers() {

        if (this._meshInstances && this._meshInstances.length) {

            var layer, layers = this.system.app.scene.layers;
            for (var i = 0; i < this._layers.length; i++) {
                layer = layers.getLayerById(this._layers[i]);
                if (layer) {
                    layer.removeMeshInstances(this._meshInstances);
                }
            }
        }
    }

    onRemoveChild() {
        this.removeFromLayers();
    }

    onInsertChild() {
        if (this._meshInstances && this.enabled && this.entity.enabled) {
            this.addToLayers();
        }
    }

    onRemove() {
        this.destroyMeshInstances();

        this.asset = null;
        this.materialAsset = null;

        this.entity.off('remove', this.onRemoveChild, this);
        this.entity.off('insert', this.onInsertChild, this);
    }

    onLayersChanged(oldComp, newComp) {
        this.addToLayers();
        oldComp.off("add", this.onLayerAdded, this);
        oldComp.off("remove", this.onLayerRemoved, this);
        newComp.on("add", this.onLayerAdded, this);
        newComp.on("remove", this.onLayerRemoved, this);
    }

    onLayerAdded(layer) {
        var index = this.layers.indexOf(layer.id);
        if (index < 0) return;
        layer.addMeshInstances(this._meshInstances);
    }

    onLayerRemoved(layer) {
        var index = this.layers.indexOf(layer.id);
        if (index < 0) return;
        layer.removeMeshInstances(this._meshInstances);
    }

    onEnable() {
        var app = this.system.app;
        var scene = app.scene;

        this._rootBone.onParentComponentEnable();

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
            app.batcher.remove(BatchGroup.RENDER, this.batchGroupId, this.entity);
        }

        this.removeFromLayers();
    }

    /**
     * @function
     * @name RenderComponent#hide
     * @description Stop rendering {@link MeshInstance}s without removing them from the scene hierarchy.
     * This method sets the {@link MeshInstance#visible} property of every MeshInstance to false.
     * Note, this does not remove the mesh instances from the scene hierarchy or draw call list.
     * So the render component still incurs some CPU overhead.
     */
    hide() {
        if (this._meshInstances) {
            for (var i = 0; i < this._meshInstances.length; i++) {
                this._meshInstances[i].visible = false;
            }
        }
    }

    /**
     * @function
     * @name RenderComponent#show
     * @description Enable rendering of the render {@link MeshInstance}s if hidden using {@link RenderComponent#hide}.
     * This method sets all the {@link MeshInstance#visible} property on all mesh instances to true.
     */
    show() {
        if (this._meshInstances) {
            for (var i = 0; i < this._meshInstances.length; i++) {
                this._meshInstances[i].visible = true;
            }
        }
    }

    _onRenderAssetAdded() {
        if (!this._assetReference.asset) return;

        if (this._assetReference.asset.resource) {
            this._onRenderAssetLoad();
        } else if (this.enabled && this.entity.enabled) {
            this.system.app.assets.load(this._assetReference.asset);
        }
    }

    _onRenderAssetLoad() {

        // remove existing instances
        this.destroyMeshInstances();

        if (this._assetReference.asset) {
            var render = this._assetReference.asset.resource;
            render.off('set:meshes', this._onSetMeshes, this);
            render.on('set:meshes', this._onSetMeshes, this);
            if (render.meshes) {
                this._onSetMeshes(render.meshes);
            }
        }
    }

    _onSetMeshes(meshes) {
        this._cloneMeshes(meshes);
    }

    _clearSkinInstances() {

        for (var i = 0; i < this._meshInstances.length; i++) {
            const meshInstance = this._meshInstances[i];

            // remove it from the cache
            SkinInstanceCache.removeCachedSkinInstance(meshInstance.skinInstance);
            meshInstance.skinInstance = null;
        }
    }

    _cloneSkinInstances() {

        if (this._meshInstances.length && this._rootBone.entity instanceof GraphNode) {

            for (let i = 0; i < this._meshInstances.length; i++) {
                const meshInstance = this._meshInstances[i];
                const mesh = meshInstance.mesh;

                // if skinned but does not have instance created yet
                if (mesh.skin && !mesh.skinInstance) {
                    meshInstance.skinInstance = SkinInstanceCache.createCachedSkinedInstance(mesh.skin, this._rootBone.entity, this.entity);
                }
            }
        }
    }

    _cloneMeshes(meshes) {

        if (meshes && meshes.length) {

            // cloned mesh instances
            var meshInstances = [];

            for (var i = 0; i < meshes.length; i++) {

                // mesh instance
                var mesh = meshes[i];
                var material = this._materialReferences[i] && this._materialReferences[i].asset && this._materialReferences[i].asset.resource;
                var meshInst = new MeshInstance(mesh, material || this.system.defaultMaterial, this.entity);
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
    }

    _onRenderAssetUnload() {

        // when unloading asset, only remove asset mesh instances (type could have been already changed to 'box' or similar)
        if (this._type === 'asset') {
            this.destroyMeshInstances();
        }
    }

    _onRenderAssetRemove() {
        if (this._assetReference.asset && this._assetReference.asset.resource) {
            this._assetReference.asset.resource.off('set:meshes', this._onSetMeshes, this);
        }

        this._onRenderAssetUnload();
    }

    _onMaterialAdded(index, component, asset) {
        if (asset.resource) {
            this._onMaterialLoad(index, component, asset);
        } else {
            if (this.enabled && this.entity.enabled) {
                this.system.app.assets.load(asset);
            }
        }
    }

    _onMaterialLoad(index, component, asset) {
        if (this._meshInstances[index]) {
            this._meshInstances[index].material = asset.resource;
        }
    }

    _onMaterialRemove(index, component, asset) {
        if (this._meshInstances[index]) {
            this._meshInstances[index].material = this.system.defaultMaterial;
        }
    }

    _onMaterialUnload(index, component, asset) {
        if (this._meshInstances[index]) {
            this._meshInstances[index].material = this.system.defaultMaterial;
        }
    }

    get renderStyle() {
        return this._renderStyle;
    }

    set renderStyle(renderStyle) {
        if (this._renderStyle !== renderStyle) {
            this._renderStyle = renderStyle;
            MeshInstance._prepareRenderStyleForArray(this._meshInstances, renderStyle);
        }
    }

    get customAabb() {
        return this._customAabb;
    }

    set customAabb(value) {
        this._customAabb = value;

        // set it on meshInstances
        var mi = this._meshInstances;
        if (mi) {
            for (var i = 0; i < mi.length; i++) {
                mi[i].setCustomAabb(this._customAabb);
            }
        }
    }

    get type() {
        return this._type;
    }

    set type(value) {

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
                this.meshInstances = [new MeshInstance(primData.mesh, material || this.system.defaultMaterial, this.entity)];
            }
        }
    }

    get meshInstances() {
        return this._meshInstances;
    }

    set meshInstances(value) {

        this.destroyMeshInstances();

        this._meshInstances = value;

        if (this._meshInstances) {

            const mi = this._meshInstances;
            for (var i = 0; i < mi.length; i++) {

                // if mesh instance was created without a node, assign it here
                if (!mi[i].node) {
                    mi[i].node = this.entity;
                }

                mi[i].castShadow = this._castShadows;
                mi[i].receiveShadow = this._receiveShadows;
                mi[i].isStatic = this._isStatic;
                mi[i].renderStyle = this._renderStyle;
                mi[i].setLightmapped(this._lightmapped);
                mi[i].setCustomAabb(this._customAabb);
            }

            if (this.enabled && this.entity.enabled) {
                this.addToLayers();
            }
        }
    }

    get lightmapped() {
        return this._lightmapped;
    }

    set lightmapped(value) {
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

    get castShadows() {
        return this._castShadows;
    }

    set castShadows(value) {
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

    get receiveShadows() {
        return this._receiveShadows;
    }

    set receiveShadows(value) {
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

    get layers() {
        return this._layers;
    }

    set layers(value) {

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

    get batchGroupId() {
        return this._batchGroupId;
    }

    set batchGroupId(value) {
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

    get material() {
        return this._material;
    }

    set material(value) {
        if (this._material !== value) {
            this._material = value;

            if (this._meshInstances && this._type !== 'asset') {
                for (var i = 0; i < this._meshInstances.length; i++) {
                    this._meshInstances[i].material = value;
                }
            }
        }
    }

    get materialAssets() {
        return this._materialReferences.map(function (ref) {
            return ref.id;
        });
    }

    set materialAssets(value) {
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

    get asset() {
        return this._assetReference.id;
    }

    set asset(value) {
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

export { RenderComponent };
