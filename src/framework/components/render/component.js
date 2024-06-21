import { Debug } from '../../../core/debug.js';
import { LAYERID_WORLD, RENDERSTYLE_SOLID } from '../../../scene/constants.js';
import { BatchGroup } from '../../../scene/batching/batch-group.js';
import { MeshInstance } from '../../../scene/mesh-instance.js';
import { MorphInstance } from '../../../scene/morph-instance.js';
import { getShapePrimitive } from '../../graphics/primitive-cache.js';
import { GraphNode } from '../../../scene/graph-node.js';
import { SkinInstanceCache } from '../../../scene/skin-instance-cache.js';

import { Asset } from '../../asset/asset.js';
import { AssetReference } from '../../asset/asset-reference.js';

import { Component } from '../component.js';

import { EntityReference } from '../../utils/entity-reference.js';

/**
 * The RenderComponent enables an {@link Entity} to render 3D meshes. The {@link RenderComponent#type}
 * property can be set to one of several predefined shape types (such as `box`, `sphere`, `cone`
 * and so on). Alternatively, the component can be configured to manage an arbitrary array of
 * {@link MeshInstance} objects. These can either be created programmatically or loaded from an
 * {@link Asset}.
 *
 * You should never need to use the RenderComponent constructor directly. To add a RenderComponent
 * to an Entity, use {@link Entity#addComponent}:
 *
 * ```javascript
 * // Add a render component to an entity with the default options
 * const entity = new pc.Entity();
 * entity.addComponent("render");  // This defaults to a 1x1x1 box
 * ```
 *
 * To create an entity with a specific primitive shape:
 *
 * ```javascript
 * entity.addComponent("render", {
 *     type: "cone",
 *     castShadows: false,
 *     receiveShadows: false
 * });
 * ```
 *
 * Once the RenderComponent is added to the entity, you can set and get any of its properties:
 *
 * ```javascript
 * entity.render.type = 'capsule';  // Set the render component's type
 *
 * console.log(entity.render.type); // Get the render component's type and print it
 * ```
 *
 * Relevant examples:
 *
 * - [Spinning Cube](https://playcanvas.github.io/#/misc/hello-world)
 * - [Primitive Shapes](https://playcanvas.github.io/#/graphics/shapes)
 * - [Loading Render Assets](https://playcanvas.github.io/#/graphics/render-asset)
 *
 * @property {import('../../entity.js').Entity} rootBone A reference to the entity to be used as
 * the root bone for any skinned meshes that are rendered by this component.
 *
 * @category Graphics
 */
class RenderComponent extends Component {
    /** @private */
    _type = 'asset';

    /** @private */
    _castShadows = true;

    /** @private */
    _receiveShadows = true;

    /** @private */
    _castShadowsLightmap = true;

    /** @private */
    _lightmapped = false;

    /** @private */
    _lightmapSizeMultiplier = 1;

    /**
     * Mark meshes as non-movable (optimization).
     *
     * @type {boolean}
     */
    isStatic = false;

    /** @private */
    _batchGroupId = -1;

    /** @private */
    _layers = [LAYERID_WORLD]; // assign to the default world layer

    /** @private */
    _renderStyle = RENDERSTYLE_SOLID;

    /**
     * @type {MeshInstance[]}
     * @private
     */
    _meshInstances = [];

    /**
     * @type {import('../../../core/shape/bounding-box.js').BoundingBox|null}
     * @private
     */
    _customAabb = null;

    /**
     * Used by lightmapper.
     *
     * @type {{x: number, y: number, z: number, uv: number}|null}
     * @ignore
     */
    _area = null;

    /**
     * @type {AssetReference}
     * @private
     */
    _assetReference;

    /**
     * @type {AssetReference[]}
     * @private
     */
    _materialReferences = [];

    /**
     * Material used to render meshes other than asset type. It gets priority when set to
     * something else than defaultMaterial, otherwise materialASsets[0] is used.
     *
     * @type {import('../../../scene/materials/material.js').Material}
     * @private
     */
    _material;

    /**
     * @type {EntityReference}
     * @private
     */
    _rootBone;

    /**
     * Create a new RenderComponent.
     *
     * @param {import('./system.js').RenderComponentSystem} system - The ComponentSystem that
     * created this Component.
     * @param {import('../../entity.js').Entity} entity - The Entity that this Component is
     * attached to.
     */
    constructor(system, entity) {
        super(system, entity);

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

        this._material = system.defaultMaterial;

        // handle events when the entity is directly (or indirectly as a child of sub-hierarchy)
        // added or removed from the parent
        entity.on('remove', this.onRemoveChild, this);
        entity.on('removehierarchy', this.onRemoveChild, this);
        entity.on('insert', this.onInsertChild, this);
        entity.on('inserthierarchy', this.onInsertChild, this);
    }

    /**
     * Sets the render style of this component's {@link MeshInstance}s. Can be:
     *
     * - {@link RENDERSTYLE_SOLID}
     * - {@link RENDERSTYLE_WIREFRAME}
     * - {@link RENDERSTYLE_POINTS}
     *
     * Defaults to {@link RENDERSTYLE_SOLID}.
     *
     * @type {number}
     */
    set renderStyle(renderStyle) {
        if (this._renderStyle !== renderStyle) {
            this._renderStyle = renderStyle;
            MeshInstance._prepareRenderStyleForArray(this._meshInstances, renderStyle);
        }
    }

    /**
     * Gets the render style of this component's {@link MeshInstance}s.
     *
     * @type {number}
     */
    get renderStyle() {
        return this._renderStyle;
    }

    /**
     * Sets the custom object space bounding box that is used for visibility culling of attached
     * mesh instances. This is an optimization, allowing an oversized bounding box to be specified
     * for skinned characters in order to avoid per frame bounding box computations based on bone
     * positions.
     *
     * @type {import('../../../core/shape/bounding-box.js').BoundingBox|null}
     */
    set customAabb(value) {
        this._customAabb = value;

        // set it on meshInstances
        const mi = this._meshInstances;
        if (mi) {
            for (let i = 0; i < mi.length; i++) {
                mi[i].setCustomAabb(this._customAabb);
            }
        }
    }

    /**
     * Gets the custom object space bounding box that is used for visibility culling of attached
     * mesh instances.
     *
     * @type {import('../../../core/shape/bounding-box.js').BoundingBox|null}
     */
    get customAabb() {
        return this._customAabb;
    }

    /**
     * Sets the type of the component. Can be one of the following:
     *
     * - "asset": The component will render a render asset
     * - "box": The component will render a box (1 unit in each dimension)
     * - "capsule": The component will render a capsule (radius 0.5, height 2)
     * - "cone": The component will render a cone (radius 0.5, height 1)
     * - "cylinder": The component will render a cylinder (radius 0.5, height 1)
     * - "plane": The component will render a plane (1 unit in each dimension)
     * - "sphere": The component will render a sphere (radius 0.5)
     * - "torus": The component will render a torus (tubeRadius: 0.2, ringRadius: 0.3)
     *
     * @type {string}
     */
    set type(value) {

        if (this._type !== value) {
            this._area = null;
            this._type = value;

            this.destroyMeshInstances();

            if (value !== 'asset') {
                let material = this._material;
                if (!material || material === this.system.defaultMaterial) {
                    material = this._materialReferences[0] &&
                                this._materialReferences[0].asset &&
                                this._materialReferences[0].asset.resource;
                }

                const primData = getShapePrimitive(this.system.app.graphicsDevice, value);
                this._area = primData.area;
                this.meshInstances = [new MeshInstance(primData.mesh, material || this.system.defaultMaterial, this.entity)];
            }
        }
    }

    /**
     * Gets the type of the component.
     *
     * @type {string}
     */
    get type() {
        return this._type;
    }

    /**
     * Sets the array of meshInstances contained in the component.
     *
     * @type {MeshInstance[]}
     */
    set meshInstances(value) {

        Debug.assert(Array.isArray(value), `MeshInstances set to a Render component must be an array.`);
        this.destroyMeshInstances();

        this._meshInstances = value;

        if (this._meshInstances) {

            const mi = this._meshInstances;
            for (let i = 0; i < mi.length; i++) {

                // if mesh instance was created without a node, assign it here
                if (!mi[i].node) {
                    mi[i].node = this.entity;
                }

                mi[i].castShadow = this._castShadows;
                mi[i].receiveShadow = this._receiveShadows;
                mi[i].renderStyle = this._renderStyle;
                mi[i].setLightmapped(this._lightmapped);
                mi[i].setCustomAabb(this._customAabb);
            }

            if (this.enabled && this.entity.enabled) {
                this.addToLayers();
            }
        }
    }

    /**
     * Gets the array of meshInstances contained in the component.
     *
     * @type {MeshInstance[]}
     */
    get meshInstances() {
        return this._meshInstances;
    }

    /**
     * Sets whether the component is affected by the runtime lightmapper. If true, the meshes will
     * be lightmapped after using lightmapper.bake().
     *
     * @type {boolean}
     */
    set lightmapped(value) {
        if (value !== this._lightmapped) {
            this._lightmapped = value;

            const mi = this._meshInstances;
            if (mi) {
                for (let i = 0; i < mi.length; i++) {
                    mi[i].setLightmapped(value);
                }
            }
        }
    }

    /**
     * Gets whether the component is affected by the runtime lightmapper.
     *
     * @type {boolean}
     */
    get lightmapped() {
        return this._lightmapped;
    }

    /**
     * Sets whether attached meshes will cast shadows for lights that have shadow casting enabled.
     *
     * @type {boolean}
     */
    set castShadows(value) {
        if (this._castShadows !== value) {

            const mi = this._meshInstances;

            if (mi) {
                const layers = this.layers;
                const scene = this.system.app.scene;
                if (this._castShadows && !value) {
                    for (let i = 0; i < layers.length; i++) {
                        const layer = scene.layers.getLayerById(this.layers[i]);
                        if (layer) {
                            layer.removeShadowCasters(mi);
                        }
                    }
                }

                for (let i = 0; i < mi.length; i++) {
                    mi[i].castShadow = value;
                }

                if (!this._castShadows && value) {
                    for (let i = 0; i < layers.length; i++) {
                        const layer = scene.layers.getLayerById(layers[i]);
                        if (layer) {
                            layer.addShadowCasters(mi);
                        }
                    }
                }
            }

            this._castShadows = value;
        }
    }

    /**
     * Gets whether attached meshes will cast shadows for lights that have shadow casting enabled.
     *
     * @type {boolean}
     */
    get castShadows() {
        return this._castShadows;
    }

    /**
     * Sets whether shadows will be cast on attached meshes.
     *
     * @type {boolean}
     */
    set receiveShadows(value) {
        if (this._receiveShadows !== value) {

            this._receiveShadows = value;

            const mi = this._meshInstances;
            if (mi) {
                for (let i = 0; i < mi.length; i++) {
                    mi[i].receiveShadow = value;
                }
            }
        }
    }

    /**
     * Gets whether shadows will be cast on attached meshes.
     *
     * @type {boolean}
     */
    get receiveShadows() {
        return this._receiveShadows;
    }

    /**
     * Sets whether meshes instances will cast shadows when rendering lightmaps.
     *
     * @type {boolean}
     */
    set castShadowsLightmap(value) {
        this._castShadowsLightmap = value;
    }

    /**
     * Gets whether meshes instances will cast shadows when rendering lightmaps.
     *
     * @type {boolean}
     */
    get castShadowsLightmap() {
        return this._castShadowsLightmap;
    }

    /**
     * Sets the lightmap resolution multiplier.
     *
     * @type {number}
     */
    set lightmapSizeMultiplier(value) {
        this._lightmapSizeMultiplier = value;
    }

    /**
     * Gets the lightmap resolution multiplier.
     *
     * @type {number}
     */
    get lightmapSizeMultiplier() {
        return this._lightmapSizeMultiplier;
    }

    /**
     * Sets the array of layer IDs ({@link Layer#id}) to which the mesh instances belong. Don't
     * push, pop, splice or modify this array. If you want to change it, set a new one instead.
     *
     * @type {number[]}
     */
    set layers(value) {
        const layers = this.system.app.scene.layers;
        let layer;

        if (this._meshInstances) {
            // remove all mesh instances from old layers
            for (let i = 0; i < this._layers.length; i++) {
                layer = layers.getLayerById(this._layers[i]);
                if (layer) {
                    layer.removeMeshInstances(this._meshInstances);
                }
            }
        }

        // set the layer list
        this._layers.length = 0;
        for (let i = 0; i < value.length; i++) {
            this._layers[i] = value[i];
        }

        // don't add into layers until we're enabled
        if (!this.enabled || !this.entity.enabled || !this._meshInstances) return;

        // add all mesh instances to new layers
        for (let i = 0; i < this._layers.length; i++) {
            layer = layers.getLayerById(this._layers[i]);
            if (layer) {
                layer.addMeshInstances(this._meshInstances);
            }
        }
    }

    /**
     * Gets the array of layer IDs ({@link Layer#id}) to which the mesh instances belong.
     *
     * @type {number[]}
     */
    get layers() {
        return this._layers;
    }

    /**
     * Sets the batch group for the mesh instances in this component (see {@link BatchGroup}).
     * Default is -1 (no group).
     *
     * @type {number}
     */
    set batchGroupId(value) {
        if (this._batchGroupId !== value) {

            if (this.entity.enabled && this._batchGroupId >= 0) {
                this.system.app.batcher?.remove(BatchGroup.RENDER, this.batchGroupId, this.entity);
            }
            if (this.entity.enabled && value >= 0) {
                this.system.app.batcher?.insert(BatchGroup.RENDER, value, this.entity);
            }

            if (value < 0 && this._batchGroupId >= 0 && this.enabled && this.entity.enabled) {
                // re-add render to scene, in case it was removed by batching
                this.addToLayers();
            }

            this._batchGroupId = value;
        }
    }

    /**
     * Gets the batch group for the mesh instances in this component (see {@link BatchGroup}).
     *
     * @type {number}
     */
    get batchGroupId() {
        return this._batchGroupId;
    }

    /**
     * Sets the material {@link Material} that will be used to render the component. The material
     * is ignored for renders of type 'asset'.
     *
     * @type {import('../../../scene/materials/material.js').Material}
     */
    set material(value) {
        if (this._material !== value) {
            this._material = value;

            if (this._meshInstances && this._type !== 'asset') {
                for (let i = 0; i < this._meshInstances.length; i++) {
                    this._meshInstances[i].material = value;
                }
            }
        }
    }

    /**
     * Gets the material {@link Material} that will be used to render the component.
     *
     * @type {import('../../../scene/materials/material.js').Material}
     */
    get material() {
        return this._material;
    }

    /**
     * Sets the material assets that will be used to render the component. Each material
     * corresponds to the respective mesh instance.
     *
     * @type {Asset[]|number[]}
     */
    set materialAssets(value = []) {
        if (this._materialReferences.length > value.length) {
            for (let i = value.length; i < this._materialReferences.length; i++) {
                this._materialReferences[i].id = null;
            }
            this._materialReferences.length = value.length;
        }

        for (let i = 0; i < value.length; i++) {
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
                const id = value[i] instanceof Asset ? value[i].id : value[i];
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

    /**
     * Gets the material assets that will be used to render the component.
     *
     * @type {Asset[]|number[]}
     */
    get materialAssets() {
        return this._materialReferences.map(function (ref) {
            return ref.id;
        });
    }

    /**
     * Sets the render asset (or asset id) for the render component. This only applies to render components with
     * type 'asset'.
     *
     * @type {Asset|number}
     */
    set asset(value) {
        const id = value instanceof Asset ? value.id : value;
        if (this._assetReference.id === id) return;

        if (this._assetReference.asset && this._assetReference.asset.resource) {
            this._onRenderAssetRemove();
        }

        this._assetReference.id = id;

        if (this._assetReference.asset) {
            this._onRenderAssetAdded();
        }
    }

    /**
     * Gets the render asset id for the render component.
     *
     * @type {number}
     */
    get asset() {
        return this._assetReference.id;
    }

    /**
     * Assign asset id to the component, without updating the component with the new asset.
     * This can be used to assign the asset id to already fully created component.
     *
     * @param {Asset|number} asset - The render asset or asset id to assign.
     * @ignore
     */
    assignAsset(asset) {
        const id = asset instanceof Asset ? asset.id : asset;
        this._assetReference.id = id;
    }

    /**
     * @param {import('../../entity.js').Entity} entity - The entity set as the root bone.
     * @private
     */
    _onSetRootBone(entity) {
        if (entity) {
            this._onRootBoneChanged();
        }
    }

    /** @private */
    _onRootBoneChanged() {
        // remove existing skin instances and create new ones, connected to new root bone
        this._clearSkinInstances();
        if (this.enabled && this.entity.enabled) {
            this._cloneSkinInstances();
        }
    }

    /** @private */
    destroyMeshInstances() {

        const meshInstances = this._meshInstances;
        if (meshInstances) {
            this.removeFromLayers();

            // destroy mesh instances separately to allow them to be removed from the cache
            this._clearSkinInstances();

            for (let i = 0; i < meshInstances.length; i++) {
                meshInstances[i].destroy();
            }
            this._meshInstances.length = 0;
        }
    }

    /** @private */
    addToLayers() {
        const layers = this.system.app.scene.layers;
        for (let i = 0; i < this._layers.length; i++) {
            const layer = layers.getLayerById(this._layers[i]);
            if (layer) {
                layer.addMeshInstances(this._meshInstances);
            }
        }
    }

    removeFromLayers() {
        if (this._meshInstances && this._meshInstances.length) {
            const layers = this.system.app.scene.layers;
            for (let i = 0; i < this._layers.length; i++) {
                const layer = layers.getLayerById(this._layers[i]);
                if (layer) {
                    layer.removeMeshInstances(this._meshInstances);
                }
            }
        }
    }

    /** @private */
    onRemoveChild() {
        this.removeFromLayers();
    }

    /** @private */
    onInsertChild() {
        if (this._meshInstances && this.enabled && this.entity.enabled) {
            this.addToLayers();
        }
    }

    onRemove() {
        this.destroyMeshInstances();

        this.asset = null;
        this.materialAsset = null;

        this._assetReference.id = null;

        for (let i = 0; i < this._materialReferences.length; i++) {
            this._materialReferences[i].id = null;
        }

        this.entity.off('remove', this.onRemoveChild, this);
        this.entity.off('insert', this.onInsertChild, this);
    }

    onLayersChanged(oldComp, newComp) {
        this.addToLayers();
        oldComp.off('add', this.onLayerAdded, this);
        oldComp.off('remove', this.onLayerRemoved, this);
        newComp.on('add', this.onLayerAdded, this);
        newComp.on('remove', this.onLayerRemoved, this);
    }

    onLayerAdded(layer) {
        const index = this.layers.indexOf(layer.id);
        if (index < 0) return;
        layer.addMeshInstances(this._meshInstances);
    }

    onLayerRemoved(layer) {
        const index = this.layers.indexOf(layer.id);
        if (index < 0) return;
        layer.removeMeshInstances(this._meshInstances);
    }

    onEnable() {
        const app = this.system.app;
        const scene = app.scene;

        this._rootBone.onParentComponentEnable();

        this._cloneSkinInstances();

        scene.on('set:layers', this.onLayersChanged, this);
        if (scene.layers) {
            scene.layers.on('add', this.onLayerAdded, this);
            scene.layers.on('remove', this.onLayerRemoved, this);
        }

        const isAsset = (this._type === 'asset');
        if (this._meshInstances && this._meshInstances.length) {
            this.addToLayers();
        } else if (isAsset && this.asset) {
            this._onRenderAssetAdded();
        }

        // load materials
        for (let i = 0; i < this._materialReferences.length; i++) {
            if (this._materialReferences[i].asset) {
                this.system.app.assets.load(this._materialReferences[i].asset);
            }
        }

        if (this._batchGroupId >= 0) {
            app.batcher?.insert(BatchGroup.RENDER, this.batchGroupId, this.entity);
        }
    }

    onDisable() {
        const app = this.system.app;
        const scene = app.scene;

        scene.off('set:layers', this.onLayersChanged, this);
        if (scene.layers) {
            scene.layers.off('add', this.onLayerAdded, this);
            scene.layers.off('remove', this.onLayerRemoved, this);
        }

        if (this._batchGroupId >= 0) {
            app.batcher?.remove(BatchGroup.RENDER, this.batchGroupId, this.entity);
        }

        this.removeFromLayers();
    }

    /**
     * Stop rendering {@link MeshInstance}s without removing them from the scene hierarchy. This
     * method sets the {@link MeshInstance#visible} property of every MeshInstance to false. Note,
     * this does not remove the mesh instances from the scene hierarchy or draw call list. So the
     * render component still incurs some CPU overhead.
     */
    hide() {
        if (this._meshInstances) {
            for (let i = 0; i < this._meshInstances.length; i++) {
                this._meshInstances[i].visible = false;
            }
        }
    }

    /**
     * Enable rendering of the component's {@link MeshInstance}s if hidden using
     * {@link RenderComponent#hide}. This method sets the {@link MeshInstance#visible} property on
     * all mesh instances to true.
     */
    show() {
        if (this._meshInstances) {
            for (let i = 0; i < this._meshInstances.length; i++) {
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
            const render = this._assetReference.asset.resource;
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

        for (let i = 0; i < this._meshInstances.length; i++) {
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
                if (mesh.skin && !meshInstance.skinInstance) {
                    meshInstance.skinInstance = SkinInstanceCache.createCachedSkinInstance(mesh.skin, this._rootBone.entity, this.entity);
                }
            }
        }
    }

    _cloneMeshes(meshes) {

        if (meshes && meshes.length) {

            // cloned mesh instances
            const meshInstances = [];

            for (let i = 0; i < meshes.length; i++) {

                // mesh instance
                const mesh = meshes[i];
                const material = this._materialReferences[i] && this._materialReferences[i].asset && this._materialReferences[i].asset.resource;
                const meshInst = new MeshInstance(mesh, material || this.system.defaultMaterial, this.entity);
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

    _updateMainMaterial(index, material) {
        // first material for primitives can be accessed using material property, so set it up
        if (index === 0) {
            this.material = material;
        }
    }

    _onMaterialLoad(index, component, asset) {
        if (this._meshInstances[index]) {
            this._meshInstances[index].material = asset.resource;
        }
        this._updateMainMaterial(index, asset.resource);
    }

    _onMaterialRemove(index, component, asset) {
        if (this._meshInstances[index]) {
            this._meshInstances[index].material = this.system.defaultMaterial;
        }
        this._updateMainMaterial(index, this.system.defaultMaterial);
    }

    _onMaterialUnload(index, component, asset) {
        if (this._meshInstances[index]) {
            this._meshInstances[index].material = this.system.defaultMaterial;
        }
        this._updateMainMaterial(index, this.system.defaultMaterial);
    }

    resolveDuplicatedEntityReferenceProperties(oldRender, duplicatedIdsMap) {
        if (oldRender.rootBone && duplicatedIdsMap[oldRender.rootBone]) {
            this.rootBone = duplicatedIdsMap[oldRender.rootBone];
        }
        this._clearSkinInstances();
    }
}

export { RenderComponent };
