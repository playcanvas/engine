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

/**
 * @import { BoundingBox } from '../../../core/shape/bounding-box.js'
 * @import { Entity } from '../../entity.js'
 * @import { EventHandle } from '../../../core/event-handle.js'
 * @import { Material } from '../../../scene/materials/material.js'
 * @import { RenderComponentSystem } from './system.js'
 */

/**
 * The RenderComponent enables an {@link Entity} to render 3D meshes. The {@link type} property can
 * be set to one of several predefined shapes (such as `box`, `sphere`, `cone` and so on).
 * Alternatively, the component can be configured to manage an arbitrary array of
 * {@link MeshInstance}s. These can either be created programmatically or loaded from an
 * {@link Asset}.
 *
 * The {@link MeshInstance}s managed by this component are positioned, rotated, and scaled in world
 * space by the world transformation matrix of the owner {@link Entity}. This world matrix is
 * derived by combining the entity's local transformation (position, rotation, and scale) with the
 * world transformation matrix of its parent entity in the scene hierarchy.
 *
 * You should never need to use the RenderComponent constructor directly. To add a RenderComponent
 * to an Entity, use {@link Entity#addComponent}:
 *
 * ```javascript
 * const entity = new pc.Entity();
 * entity.addComponent('render', {
 *     type: 'box'
 * });
 * ```
 *
 * Once the RenderComponent is added to the entity, you can access it via the {@link Entity#render}
 * property:
 *
 * ```javascript
 * entity.render.type = 'capsule';  // Set the render component's type
 *
 * console.log(entity.render.type); // Get the render component's type and print it
 * ```
 *
 * Relevant Engine API examples:
 *
 * - [Loading Render Assets](https://playcanvas.github.io/#/graphics/render-asset)
 * - [Primitive Shapes](https://playcanvas.github.io/#/graphics/shapes)
 * - [Spinning Cube](https://playcanvas.github.io/#/misc/hello-world)
 *
 * @category Graphics
 */
class RenderComponent extends Component {
    /**
     * @type {'asset'|'box'|'capsule'|'cone'|'cylinder'|'plane'|'sphere'|'torus'}
     * @private
     */
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
     * @type {BoundingBox|null}
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
     * something else than defaultMaterial, otherwise materialAssets[0] is used.
     *
     * @type {Material}
     * @private
     */
    _material;

    /**
     * A reference to the entity to be used as the root bone for any skinned meshes that
     * are rendered by this component.
     *
     * @type {Entity|null}
     * @private
     */
    _rootBone = null;

    /**
     * @type {EventHandle|null}
     * @private
     */
    _evtLayersChanged = null;

    /**
     * @type {EventHandle|null}
     * @private
     */
    _evtLayerAdded = null;

    /**
     * @type {EventHandle|null}
     * @private
     */
    _evtLayerRemoved = null;

    /**
     * @type {EventHandle|null}
     * @private
     */
    _evtSetMeshes = null;

    /**
     * Create a new RenderComponent.
     *
     * @param {RenderComponentSystem} system - The ComponentSystem that created this Component.
     * @param {Entity} entity - The Entity that this Component is attached to.
     */
    constructor(system, entity) {
        super(system, entity);

        // the entity that represents the root bone if this render component has skinned meshes

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
     * @type {BoundingBox|null}
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
     * @type {BoundingBox|null}
     */
    get customAabb() {
        return this._customAabb;
    }

    /**
     * Sets the type of the component, determining the source of the geometry to be rendered.
     * The geometry, whether it's a primitive shape or originates from an asset, is rendered
     * using the owning entity's final world transform. This world transform is calculated by
     * concatenating (multiplying) the local transforms (position, rotation, scale) of the
     * entity and all its ancestors in the scene hierarchy. This process positions, orientates,
     * and scales the geometry in world space.
     *
     * Can be one of the following values:
     *
     * - **"asset"**: Renders geometry defined in an {@link Asset} of type `render`. This asset,
     *   assigned to the {@link asset} property, contains one or more {@link MeshInstance}s.
     *   Alternatively, {@link meshInstances} can be set programmatically.
     * - **"box"**: A unit cube (sides of length 1) centered at the local space origin.
     * - **"capsule"**: A shape composed of a cylinder and two hemispherical caps that is aligned
     *   with the local Y-axis. It is centered at the local space origin and has an unscaled height
     *   of 2 and a radius of 0.5.
     * - **"cone"**: A cone aligned with the local Y-axis. It is centered at the local space
     *   origin, with its base in the local XZ plane at Y = -0.5 and its tip at Y = +0.5. It has
     *   an unscaled height of 1 and a base radius of 0.5.
     * - **"cylinder"**: A cylinder aligned with the local Y-axis. It is centered at the local
     *   space origin with an unscaled height of 1 and a radius of 0.5.
     * - **"plane"**: A flat plane in the local XZ plane at Y = 0 (normal along +Y). It is
     *   centered at the local space origin with unscaled dimensions of 1x1 units along local X and
     *   Z axes.
     * - **"sphere"**: A sphere with a radius of 0.5. It is centered at the local space origin and
     *   has poles at Y = -0.5 and Y = +0.5.
     * - **"torus"**: A doughnut shape lying in the local XZ plane at Y = 0. It is centered at
     *   the local space origin with a tube radius of 0.2 and a ring radius of 0.3.
     *
     * @type {'asset'|'box'|'capsule'|'cone'|'cylinder'|'plane'|'sphere'|'torus'}
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
     * @type {'asset'|'box'|'capsule'|'cone'|'cylinder'|'plane'|'sphere'|'torus'}
     */
    get type() {
        return this._type;
    }

    /**
     * Sets the array of MeshInstances contained in the component.
     *
     * @type {MeshInstance[]}
     */
    set meshInstances(value) {
        Debug.assert(Array.isArray(value), 'MeshInstances set to a Render component must be an array.');
        this.destroyMeshInstances();

        this._meshInstances = value;

        if (this._meshInstances) {

            const mi = this._meshInstances;
            for (let i = 0; i < mi.length; i++) {
                this._updateMeshInstance(mi[i]);
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
     * @type {Material}
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
     * @type {Material}
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
        return this._materialReferences.map((ref) => {
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
     * Sets the root bone entity (or entity guid) for the render component.
     *
     * @type {Entity|string|null}
     */
    set rootBone(value) {
        if (this._rootBone !== value) {
            const isString = typeof value === 'string';
            if (this._rootBone && isString && this._rootBone.getGuid() === value) {
                return;
            }

            if (this._rootBone) {
                this._clearSkinInstances();
            }

            if (value instanceof GraphNode) {
                this._rootBone = value;
            } else if (isString) {
                this._rootBone = this.system.app.getEntityFromIndex(value) || null;
                if (!this._rootBone) {
                    Debug.warn('Failed to find rootBone Entity by GUID');
                }
            } else {
                this._rootBone = null;
            }

            if (this._rootBone) {
                this._cloneSkinInstances();
            }
        }
    }

    /**
     * Gets the root bone entity for the render component.
     *
     * @type {Entity|null}
     */
    get rootBone() {
        return this._rootBone;
    }

    /**
     * @param {MeshInstance} meshInstance - MeshInstance that needs its properties updated.
     * @private
     */
    _updateMeshInstance(meshInstance) {
        // if mesh instance was created without a node, assign it here
        if (!meshInstance.node) {
            meshInstance.node = this.entity;
        }

        meshInstance.castShadow = this._castShadows;
        meshInstance.receiveShadow = this._receiveShadows;
        meshInstance.renderStyle = this._renderStyle;
        meshInstance.setLightmapped(this._lightmapped);
        meshInstance.setCustomAabb(this._customAabb);
    }

    /**
     * Adds a MeshInstance to this component.
     *
     * @param {MeshInstance} meshInstance - MeshInstance to add.
     */
    addMeshInstance(meshInstance) {
        Debug.assert(meshInstance instanceof MeshInstance, 'Invalid MeshInstance');
        const meshInstances = this._meshInstances;

        if (meshInstances) {
            const index = meshInstances.indexOf(meshInstance);
            if (index >= 0) {
                Debug.warn('This MeshInstance already exists in this component');
                return;
            }
            meshInstances.push(meshInstance);
        } else {
            this._meshInstances = [meshInstance];
        }

        this._updateMeshInstance(meshInstance);

        if (this.enabled && this.entity.enabled) {
            this.addToLayers(meshInstance);
        }
    }

    /**
     * Removes a MeshInstance from this component.
     *
     * @param {MeshInstance} instance - MeshInstance to remove.
     */
    removeMeshInstance(instance) {
        Debug.assert(instance instanceof MeshInstance, 'Invalid MeshInstance');
        const meshInstances = this._meshInstances;

        if (meshInstances) {
            const j = meshInstances.indexOf(instance);
            if (j >= 0) {
                const meshInstance = meshInstances[j];

                this.removeFromLayers(meshInstance);
                this._clearSkinInstance(meshInstance);

                meshInstances.splice(j, 1);

                // TODO
                // do we want to destroy it on remove?
            }
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

    /**
     * @param {MeshInstance | null} [meshInstance] - An optional MeshInstance to add to layers. If
     * not provided, all mesh instances will be added.
     * @private
     */
    addToLayers(meshInstance = null) {
        const sceneLayers = this.system.app.scene.layers;
        const componentLayers = this._layers;
        const meshInstances = this._meshInstances;

        for (let i = 0; i < componentLayers.length; i++) {
            const layer = sceneLayers.getLayerById(componentLayers[i]);
            if (layer) {
                if (meshInstance) {
                    layer.addMeshInstance(meshInstance);
                } else {
                    layer.addMeshInstances(meshInstances);
                }
            }
        }
    }

    /**
     * @param {MeshInstance | null} [meshInstance] - An optional MeshInstance to remove. If not
     * provided, all mesh instances will be removed.
     * @private
     */
    removeFromLayers(meshInstance = null) {
        const sceneLayers = this.system.app.scene.layers;
        const componentLayers = this._layers;
        const meshInstances = this._meshInstances;

        for (let i = 0; i < componentLayers.length; i++) {
            const layer = sceneLayers.getLayerById(componentLayers[i]);
            if (layer) {
                if (meshInstance) {
                    layer.removeMeshInstance(meshInstance);
                } else if (meshInstances?.length) {
                    layer.removeMeshInstances(meshInstances);
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
        const layers = scene.layers;

        if (this._rootBone) {
            this._cloneSkinInstances();
        }

        this._evtLayersChanged = scene.on('set:layers', this.onLayersChanged, this);

        if (layers) {
            this._evtLayerAdded = layers.on('add', this.onLayerAdded, this);
            this._evtLayerRemoved = layers.on('remove', this.onLayerRemoved, this);
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
        const layers = scene.layers;

        this._evtLayersChanged?.off();
        this._evtLayersChanged = null;

        if (this._rootBone) {
            this._clearSkinInstances();
        }

        if (layers) {
            this._evtLayerAdded?.off();
            this._evtLayerAdded = null;
            this._evtLayerRemoved?.off();
            this._evtLayerRemoved = null;
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
            this._evtSetMeshes?.off();
            this._evtSetMeshes = render.on('set:meshes', this._onSetMeshes, this);
            if (render.meshes) {
                this._onSetMeshes(render.meshes);
            }
        }
    }

    _onSetMeshes(meshes) {
        this._cloneMeshes(meshes);
    }

    _clearSkinInstances() {
        const meshInstances = this._meshInstances;
        for (let i = 0; i < meshInstances.length; i++) {
            this._clearSkinInstance(meshInstances[i]);
        }
    }

    /**
     * @param {MeshInstance} meshInstance - MeshInstance that needs to have skin instnace cleared.
     */
    _clearSkinInstance(meshInstance) {
        // remove it from the cache
        SkinInstanceCache.removeCachedSkinInstance(meshInstance.skinInstance);
        meshInstance.skinInstance = null;
    }

    _cloneSkinInstances() {
        if (this._meshInstances.length && this._rootBone instanceof GraphNode) {
            for (let i = 0; i < this._meshInstances.length; i++) {
                const meshInstance = this._meshInstances[i];
                const mesh = meshInstance.mesh;

                // if skinned but does not have instance created yet
                if (mesh.skin && !meshInstance.skinInstance) {
                    meshInstance.skinInstance = SkinInstanceCache.createCachedSkinInstance(mesh.skin, this._rootBone, this.entity);
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
        this._evtSetMeshes?.off();
        this._evtSetMeshes = null;

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
        if (oldRender.rootBone) {
            this.rootBone = duplicatedIdsMap[oldRender.rootBone.getGuid()];
        }
    }
}

export { RenderComponent };
