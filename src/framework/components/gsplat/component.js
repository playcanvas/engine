import { hashCode } from '../../../core/hash.js';
import { LAYERID_WORLD, WORKBUFFER_UPDATE_AUTO } from '../../../scene/constants.js';
import { GSplatInstance } from '../../../scene/gsplat/gsplat-instance.js';
import { Asset } from '../../asset/asset.js';
import { AssetReference } from '../../asset/asset-reference.js';
import { Component } from '../component.js';
import { Debug } from '../../../core/debug.js';
import { GSplatPlacement } from '../../../scene/gsplat-unified/gsplat-placement.js';
import { PickerId } from '../../../scene/picker-id.js';

/**
 * @import { BoundingBox } from '../../../core/shape/bounding-box.js'
 * @import { Entity } from '../../entity.js'
 * @import { EventHandle } from '../../../core/event-handle.js'
 * @import { GSplatComponentSystem } from './system.js'
 * @import { GSplatResourceBase } from '../../../scene/gsplat/gsplat-resource-base.js'
 * @import { ScopeId } from '../../../platform/graphics/scope-id.js'
 * @import { ShaderMaterial } from '../../../scene/materials/shader-material.js'
 * @import { StorageBuffer } from '../../../platform/graphics/storage-buffer.js'
 * @import { Texture } from '../../../platform/graphics/texture.js'
 */

/**
 * The GSplatComponent enables an {@link Entity} to render 3D Gaussian Splats. Splats are always
 * loaded from {@link Asset}s rather than being created programmatically. The asset type is
 * `gsplat` which supports multiple file formats including `.ply`, `.sog`, `.meta.json` (SOG
 * format), and `.lod-meta.json` (streaming LOD format).
 *
 * You should never need to use the GSplatComponent constructor directly. To add an
 * GSplatComponent to an {@link Entity}, use {@link Entity#addComponent}:
 *
 * ```javascript
 * const entity = pc.Entity();
 * entity.addComponent('gsplat', {
 *     asset: asset
 * });
 * ```
 *
 * Once the GSplatComponent is added to the entity, you can access it via the {@link Entity#gsplat}
 * property:
 *
 * ```javascript
 * entity.gsplat.customAabb = new pc.BoundingBox(new pc.Vec3(), new pc.Vec3(10, 10, 10));
 *
 * console.log(entity.gsplat.customAabb);
 * ```
 *
 * ## Unified Rendering
 *
 * The {@link GSplatComponent#unified} property enables unified rendering mode, which provides
 * advanced features for Gaussian Splats:
 *
 * - **Global Sorting**: Multiple splat components are sorted together in a single unified sort,
 *   eliminating visibility artifacts and popping effects when splat components overlap.
 * - **LOD Streaming**: Dynamically loads and renders appropriate levels of detail based on camera
 *   distance, enabling efficient rendering of massive splat scenes.
 *
 * ```javascript
 * // Enable unified rendering for advanced features
 * entity.gsplat.unified = true;
 * ```
 *
 * Relevant Engine API examples:
 *
 * - [Simple Splat Loading](https://playcanvas.github.io/#/gaussian-splatting/simple)
 * - [Global Sorting](https://playcanvas.github.io/#/gaussian-splatting/global-sorting)
 * - [LOD](https://playcanvas.github.io/#/gaussian-splatting/lod)
 * - [LOD Instances](https://playcanvas.github.io/#/gaussian-splatting/lod-instances)
 * - [LOD Streaming](https://playcanvas.github.io/#/gaussian-splatting/lod-streaming)
 * - [LOD Streaming with Spherical Harmonics](https://playcanvas.github.io/#/gaussian-splatting/lod-streaming-sh)
 * - [Multi-Splat](https://playcanvas.github.io/#/gaussian-splatting/multi-splat)
 * - [Multi-View](https://playcanvas.github.io/#/gaussian-splatting/multi-view)
 * - [Picking](https://playcanvas.github.io/#/gaussian-splatting/picking)
 * - [Reveal Effect](https://playcanvas.github.io/#/gaussian-splatting/reveal)
 * - [Shader Effects](https://playcanvas.github.io/#/gaussian-splatting/shader-effects)
 * - [Spherical Harmonics](https://playcanvas.github.io/#/gaussian-splatting/spherical-harmonics)
 *
 * @hideconstructor
 * @category Graphics
 */
class GSplatComponent extends Component {
    /** @private */
    _layers = [LAYERID_WORLD]; // assign to the default world layer

    /**
     * @type {GSplatInstance|null}
     * @private
     */
    _instance = null;

    /**
     * @type {GSplatPlacement|null}
     * @private
     */
    _placement = null;

    /**
     * Unique identifier for this component, used by the picking system.
     *
     * @type {number}
     * @private
     */
    _id = PickerId.get();

    /**
     * @type {ShaderMaterial|null}
     * @private
     */
    _materialTmp = null;

    /** @private */
    _highQualitySH = true;

    /**
     * LOD distance thresholds, stored as a copy.
     *
     * @type {number[]|null}
     * @private
     */
    _lodDistances = [5, 10, 15, 20, 25, 30, 35, 40, 45, 50, 55, 60];

    /**
     * @type {BoundingBox|null}
     * @private
     */
    _customAabb = null;

    /**
     * @type {AssetReference}
     * @private
     */
    _assetReference;

    /**
     * Direct resource reference (for container splats).
     *
     * @type {GSplatResourceBase|null}
     * @private
     */
    _resource = null;

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

    /** @private */
    _castShadows = false;

    /**
     * Whether to use the unified gsplat rendering.
     *
     * @type {boolean}
     * @private
     */
    _unified = false;

    /**
     * Per-instance shader parameters. Stores objects with scopeId and data.
     *
     * @type {Map<string, {scopeId: ScopeId, data: *}>}
     * @private
     */
    _parameters = new Map();

    /**
     * Render mode for work buffer updates.
     *
     * @type {number}
     * @private
     */
    _workBufferUpdate = WORKBUFFER_UPDATE_AUTO;

    /**
     * Custom shader modify code for this component (object with code and pre-computed hash).
     *
     * @type {{ code: string, hash: number }|null}
     * @private
     */
    _workBufferModifier = null;

    /**
     * Create a new GSplatComponent.
     *
     * @param {GSplatComponentSystem} system - The ComponentSystem that created this Component.
     * @param {Entity} entity - The Entity that this Component is attached to.
     */
    constructor(system, entity) {
        super(system, entity);

        // gsplat asset reference
        this._assetReference = new AssetReference(
            'asset',
            this,
            system.app.assets, {
                add: this._onGSplatAssetAdded,
                load: this._onGSplatAssetLoad,
                remove: this._onGSplatAssetRemove,
                unload: this._onGSplatAssetUnload
            },
            this
        );

        // handle events when the entity is directly (or indirectly as a child of sub-hierarchy)
        // added or removed from the parent
        entity.on('remove', this.onRemoveChild, this);
        entity.on('removehierarchy', this.onRemoveChild, this);
        entity.on('insert', this.onInsertChild, this);
        entity.on('inserthierarchy', this.onInsertChild, this);
    }

    /**
     * Sets a custom object space bounding box for visibility culling of the attached gsplat.
     *
     * @type {BoundingBox|null}
     */
    set customAabb(value) {
        this._customAabb = value;

        // set it on meshInstance
        this._instance?.meshInstance?.setCustomAabb(this._customAabb);

        // set it on placement
        if (this._placement) {
            this._placement.aabb = this._customAabb;
        }
    }

    /**
     * Gets the custom object space bounding box for visibility culling of the attached gsplat.
     * Returns the custom AABB if set, otherwise falls back to the resource's AABB.
     *
     * @type {BoundingBox|null}
     */
    get customAabb() {
        return this._customAabb ?? this._placement?.aabb ?? this.resource?.aabb ?? null;
    }

    /**
     * Sets a {@link GSplatInstance} on the component. If not set or loaded, it returns null.
     *
     * @type {GSplatInstance|null}
     * @ignore
     */
    set instance(value) {

        if (this.unified) {
            Debug.errorOnce('GSplatComponent#instance setter is not supported when unified is true.');
            return;
        }

        // destroy existing instance
        this.destroyInstance();

        this._instance = value;

        if (this._instance) {

            // if mesh instance was created without a node, assign it here
            const mi = this._instance.meshInstance;
            if (!mi.node) {
                mi.node = this.entity;
            }
            mi.castShadow = this._castShadows;
            mi.setCustomAabb(this._customAabb);

            if (this.enabled && this.entity.enabled) {
                this.addToLayers();
            }
        }
    }

    /**
     * Gets the {@link GSplatInstance} on the component.
     *
     * @type {GSplatInstance|null}
     * @ignore
     */
    get instance() {
        return this._instance;
    }

    /**
     * Sets the material used to render the gsplat.
     *
     * **Note:** This setter is only supported when {@link unified} is `false`. When it's true, multiple
     * gsplat components share a single material per camera/layer combination. To access materials in
     * unified mode, use {@link GSplatComponentSystem#getMaterial}.
     *
     * @param {ShaderMaterial} value - The material instance.
     */
    set material(value) {
        if (this.unified) {
            Debug.warn('GSplatComponent#material setter is not supported when unified true. Use app.systems.gsplat.getMaterial(camera, layer) to access materials.');
            return;
        }
        if (this._instance) {
            this._instance.material = value;
        } else {
            this._materialTmp = value;
        }
    }

    /**
     * Gets the material used to render the gsplat.
     *
     * **Note:** This getter returns `null` when {@link unified} is `true`. In unified mode, materials are
     * organized per camera/layer combination rather than per component. To access materials in
     * unified mode, use {@link GSplatComponentSystem#getMaterial}.
     *
     * @type {ShaderMaterial|null}
     */
    get material() {
        if (this.unified) {
            Debug.warnOnce('GSplatComponent#material getter returns null when unified=true. Use app.systems.gsplat.getMaterial(camera, layer) instead.');
            return null;
        }
        return this._instance?.material ?? this._materialTmp ?? null;
    }

    /**
     * Sets whether to use the high quality or the approximate (but fast) spherical-harmonic calculation when rendering SOG data.
     *
     * The low quality approximation evaluates the scene's spherical harmonic contributions
     * along the camera's Z-axis instead of using each gaussian's view vector. This results
     * in gaussians being accurate at the center of the screen and becoming less accurate
     * as they appear further from the center. This is a good trade-off for performance
     * when rendering large SOG datasets, especially on mobile devices.
     *
     * Defaults to false.
     *
     * @type {boolean}
     */
    set highQualitySH(value) {
        if (value !== this._highQualitySH) {
            this._highQualitySH = value;
            this._instance?.setHighQualitySH(value);
        }
    }

    /**
     * Gets whether the high quality (true) or the fast approximate (false) spherical-harmonic calculation is used when rendering SOG data.
     *
     * @type {boolean}
     */
    get highQualitySH() {
        return this._highQualitySH;
    }

    /**
     * Sets whether gsplat will cast shadows for lights that have shadow casting enabled. Defaults
     * to false.
     *
     * @type {boolean}
     */
    set castShadows(value) {

        if (this._castShadows !== value) {
            const layers = this.layers;
            const scene = this.system.app.scene;

            // Handle unified mode placement
            if (this._placement) {
                if (value) {
                    // Add to shadow casters
                    for (let i = 0; i < layers.length; i++) {
                        const layer = scene.layers.getLayerById(layers[i]);
                        layer?.addGSplatShadowCaster(this._placement);
                    }
                } else {
                    // Remove from shadow casters
                    for (let i = 0; i < layers.length; i++) {
                        const layer = scene.layers.getLayerById(layers[i]);
                        layer?.removeGSplatShadowCaster(this._placement);
                    }
                }
            }

            // Handle non-unified mode mesh instance
            const mi = this.instance?.meshInstance;

            if (mi) {
                if (this._castShadows && !value) {
                    for (let i = 0; i < layers.length; i++) {
                        const layer = scene.layers.getLayerById(this.layers[i]);
                        layer?.removeShadowCasters([mi]);
                    }
                }

                mi.castShadow = value;

                if (!this._castShadows && value) {
                    for (let i = 0; i < layers.length; i++) {
                        const layer = scene.layers.getLayerById(layers[i]);
                        layer?.addShadowCasters([mi]);
                    }
                }
            }

            this._castShadows = value;
        }
    }

    /**
     * Gets whether gsplat will cast shadows for lights that have shadow casting enabled.
     *
     * @type {boolean}
     */
    get castShadows() {
        return this._castShadows;
    }

    /**
     * Sets LOD distance thresholds used by octree-based gsplat rendering. The provided array
     * is copied.
     *
     * @type {number[]|null}
     */
    set lodDistances(value) {
        this._lodDistances = Array.isArray(value) ? value.slice() : null;
        if (this._placement) {
            this._placement.lodDistances = this._lodDistances;
        }
    }

    /**
     * Gets a copy of LOD distance thresholds previously set, or null when not set.
     *
     * @type {number[]|null}
     */
    get lodDistances() {
        return this._lodDistances ? this._lodDistances.slice() : null;
    }

    /**
     * @deprecated Use app.scene.gsplat.splatBudget instead for global budget control.
     * @type {number}
     */
    set splatBudget(value) {
        Debug.removed('GSplatComponent.splatBudget is removed. Use app.scene.gsplat.splatBudget instead for global budget control.');
    }

    get splatBudget() {
        Debug.removed('GSplatComponent.splatBudget is removed. Use app.scene.gsplat.splatBudget instead for global budget control.');
        return 0;
    }

    /**
     * Sets whether to use the unified gsplat rendering. Default is false.
     *
     * Note: Material handling differs between modes. When unified is false, use
     * {@link GSplatComponent#material}. When unified is true, materials are shared per
     * camera/layer - use {@link GSplatComponentSystem#getMaterial} instead.
     *
     * @type {boolean}
     */
    set unified(value) {
        if (this._unified !== value) {
            this._unified = value;
            this._onGSplatAssetAdded();
        }
    }

    /**
     * Gets whether to use the unified gsplat rendering.
     *
     * @type {boolean}
     * @alpha
     */
    get unified() {
        return this._unified;
    }

    /**
     * Gets the unique identifier for this component. This ID is used by the picking system
     * and is also written to the work buffer when `app.scene.gsplat.enableIds` is enabled, making
     * it available to custom shaders for effects like highlighting or animation.
     *
     * @type {number}
     */
    get id() {
        return this._id;
    }

    /**
     * Sets the work buffer update mode. Only applicable in unified rendering mode.
     *
     * In unified mode, splat data is rendered to a work buffer only when needed (e.g., when
     * transforms change). Can be:
     * - {@link WORKBUFFER_UPDATE_AUTO}: Update only when needed (default).
     * - {@link WORKBUFFER_UPDATE_ONCE}: Force update this frame, then switch to AUTO.
     * - {@link WORKBUFFER_UPDATE_ALWAYS}: Update every frame.
     *
     * This is typically useful when using custom shader code via {@link workBufferModifier} that
     * depends on external factors like time or animated uniforms.
     *
     * Note: {@link WORKBUFFER_UPDATE_ALWAYS} has a performance impact as it re-renders
     * all splat data to the work buffer every frame. Where possible, consider using shader
     * customization on the unified gsplat material (`app.scene.gsplat.material`) which is
     * applied during final rendering without re-rendering the work buffer.
     *
     * @type {number}
     */
    set workBufferUpdate(value) {
        this._workBufferUpdate = value;
        if (this._placement) {
            this._placement.workBufferUpdate = value;
        }
    }

    /**
     * Gets the work buffer update mode.
     *
     * @type {number}
     */
    get workBufferUpdate() {
        return this._workBufferUpdate;
    }

    /**
     * Sets custom shader code for modifying splats when written to the work buffer. Only
     * applicable in unified rendering mode.
     *
     * Must provide all three functions:
     * - `modifySplatCenter`: Modify the splat center position
     * - `modifySplatRotationScale`: Modify the splat rotation and scale
     * - `modifySplatColor`: Modify the splat color
     *
     * Calling this method automatically triggers a work buffer re-render.
     *
     * @param {{ glsl?: string, wgsl?: string }|null} value - The modifier code for GLSL and/or WGSL.
     * @example
     * entity.gsplat.setWorkBufferModifier({
     *     glsl: `
     *         void modifySplatCenter(inout vec3 center) {}
     *         void modifySplatRotationScale(vec3 originalCenter, vec3 modifiedCenter, inout vec4 rotation, inout vec3 scale) {}
     *         void modifySplatColor(vec3 center, inout vec4 color) { color.rgb *= vec3(1.0, 0.0, 0.0); }
     *     `,
     *     wgsl: `
     *         fn modifySplatCenter(center: ptr<function, vec3f>) {}
     *         fn modifySplatRotationScale(originalCenter: vec3f, modifiedCenter: vec3f, rotation: ptr<function, vec4f>, scale: ptr<function, vec3f>) {}
     *         fn modifySplatColor(center: vec3f, color: ptr<function, vec4f>) { (*color).r = 1.0; (*color).g = 0.0; (*color).b = 0.0; }
     *     `
     * });
     */
    setWorkBufferModifier(value) {
        if (value) {
            const device = this.system.app.graphicsDevice;
            const code = (device.isWebGPU ? value.wgsl : value.glsl) ?? null;
            // create new object with pre-computed hash (object is not mutated, always replaced)
            this._workBufferModifier = code ? { code, hash: hashCode(code) } : null;
        } else {
            this._workBufferModifier = null;
        }
        if (this._placement) {
            this._placement.workBufferModifier = this._workBufferModifier;
        }
    }

    /**
     * Sets an array of layer IDs ({@link Layer#id}) to which this gsplat should belong. Don't
     * push, pop, splice or modify this array. If you want to change it, set a new one instead.
     *
     * @type {number[]}
     */
    set layers(value) {

        // remove the mesh instances from old layers
        this.removeFromLayers();

        // set the layer list
        this._layers.length = 0;
        for (let i = 0; i < value.length; i++) {
            this._layers[i] = value[i];
        }

        // don't add into layers until we're enabled
        if (!this.enabled || !this.entity.enabled) {
            return;
        }

        // add the mesh instance to new layers
        this.addToLayers();
    }

    /**
     * Gets the array of layer IDs ({@link Layer#id}) to which this gsplat belongs.
     *
     * @type {number[]}
     */
    get layers() {
        return this._layers;
    }

    /**
     * Sets the gsplat asset for this gsplat component. Can also be an asset id.
     *
     * @type {Asset|number}
     */
    set asset(value) {

        const id = value instanceof Asset ? value.id : value;
        if (this._assetReference.id === id) return;

        if (this._assetReference.asset && this._assetReference.asset.resource) {
            this._onGSplatAssetRemove();
        }

        this._assetReference.id = id;

        if (this._assetReference.asset) {
            this._onGSplatAssetAdded();
        }
    }

    /**
     * Gets the gsplat asset id for this gsplat component.
     *
     * @type {Asset|number}
     */
    get asset() {
        return this._assetReference.id;
    }

    /**
     * Sets a GSplat resource directly (for procedural/container splats).
     * When set, this takes precedence over the asset property.
     *
     * @type {GSplatResourceBase|null}
     */
    set resource(value) {
        if (this._resource === value) return;

        // Clean up existing (whether from direct resource or asset)
        if (this._resource || this._assetReference.asset?.resource) {
            this._onGSplatAssetRemove();
        }

        // Disconnect asset when setting resource directly
        if (value && this._assetReference.id) {
            this._assetReference.id = null;
        }

        this._resource = value;

        if (this._resource && this.enabled && this.entity.enabled) {
            this._onGSplatAssetLoad();
        }
    }

    /**
     * Gets the GSplat resource. Returns the directly set resource if available,
     * otherwise returns the resource from the assigned asset.
     *
     * @type {GSplatResourceBase|null}
     */
    get resource() {
        return this._resource ?? this._assetReference.asset?.resource ?? null;
    }

    /** @private */
    destroyInstance() {

        if (this._placement) {
            this.removeFromLayers();
            this._placement.destroy();
            this._placement = null;
        }

        if (this._instance) {
            this.removeFromLayers();
            this._instance?.destroy();
            this._instance = null;
        }
    }

    /** @private */
    addToLayers() {

        if (this._placement) {
            const layers = this.system.app.scene.layers;
            for (let i = 0; i < this._layers.length; i++) {
                const layer = layers.getLayerById(this._layers[i]);
                if (layer) {
                    layer.addGSplatPlacement(this._placement);
                    if (this._castShadows) {
                        layer.addGSplatShadowCaster(this._placement);
                    }
                }
            }
            return;
        }

        const meshInstance = this.instance?.meshInstance;
        if (meshInstance) {
            const layers = this.system.app.scene.layers;
            for (let i = 0; i < this._layers.length; i++) {
                layers.getLayerById(this._layers[i])?.addMeshInstances([meshInstance]);
            }
        }
    }

    removeFromLayers() {

        if (this._placement) {
            const layers = this.system.app.scene.layers;
            for (let i = 0; i < this._layers.length; i++) {
                const layer = layers.getLayerById(this._layers[i]);
                if (layer) {
                    layer.removeGSplatPlacement(this._placement);
                    layer.removeGSplatShadowCaster(this._placement);
                }
            }
            return;
        }

        const meshInstance = this.instance?.meshInstance;
        if (meshInstance) {
            const layers = this.system.app.scene.layers;
            for (let i = 0; i < this._layers.length; i++) {
                layers.getLayerById(this._layers[i])?.removeMeshInstances([meshInstance]);
            }
        }
    }

    /** @private */
    onRemoveChild() {
        this.removeFromLayers();
    }

    /** @private */
    onInsertChild() {
        if (this.enabled && this.entity.enabled) {
            if (this._instance || this._placement) {
                this.addToLayers();
            }
        }
    }

    onRemove() {
        this.destroyInstance();

        this.asset = null;
        this._assetReference.id = null;

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
        if (this.unified) {
            Debug.errorOnce('GSplatComponent#onLayerAdded is not supported when unified is true.');
            return;
        }

        if (this._instance) {
            layer.addMeshInstances(this._instance.meshInstance);
        }
    }

    onLayerRemoved(layer) {
        const index = this.layers.indexOf(layer.id);
        if (index < 0) return;
        if (this.unified) {
            Debug.errorOnce('GSplatComponent#onLayerRemoved is not supported when unified is true.');
            return;
        }

        if (this._instance) {
            layer.removeMeshInstances(this._instance.meshInstance);
        }
    }

    onEnable() {
        const scene = this.system.app.scene;
        const layers = scene.layers;

        this._evtLayersChanged = scene.on('set:layers', this.onLayersChanged, this);

        if (layers) {
            this._evtLayerAdded = layers.on('add', this.onLayerAdded, this);
            this._evtLayerRemoved = layers.on('remove', this.onLayerRemoved, this);
        }

        if (this._instance || this._placement) {
            this.addToLayers();
        } else if (this.asset) {
            this._onGSplatAssetAdded();
        } else if (this._resource) {
            this._onGSplatAssetLoad();
        }
    }

    onDisable() {
        const scene = this.system.app.scene;
        const layers = scene.layers;

        this._evtLayersChanged?.off();
        this._evtLayersChanged = null;

        if (layers) {
            this._evtLayerAdded?.off();
            this._evtLayerAdded = null;
            this._evtLayerRemoved?.off();
            this._evtLayerRemoved = null;
        }

        this.removeFromLayers();
    }

    /**
     * Stop rendering this component without removing its mesh instance from the scene hierarchy.
     */
    hide() {
        if (this._instance) {
            this._instance.meshInstance.visible = false;
        }
    }

    /**
     * Enable rendering of the component if hidden using {@link GSplatComponent#hide}.
     */
    show() {
        if (this._instance) {
            this._instance.meshInstance.visible = true;
        }
    }

    /**
     * Sets a shader parameter for this gsplat instance. Parameters set here are applied
     * during unified rendering.
     *
     * @param {string} name - The name of the parameter (uniform name in shader).
     * @param {number|number[]|ArrayBufferView|Texture|StorageBuffer} data - The value for the parameter.
     */
    setParameter(name, data) {
        const scopeId = this.system.app.graphicsDevice.scope.resolve(name);
        this._parameters.set(name, { scopeId, data });
        if (this._placement) this._placement.renderDirty = true;
    }

    /**
     * Gets a shader parameter value previously set with {@link setParameter}.
     *
     * @param {string} name - The name of the parameter.
     * @returns {number|number[]|ArrayBufferView|undefined} The parameter value, or undefined if not set.
     */
    getParameter(name) {
        return this._parameters.get(name)?.data;
    }

    /**
     * Deletes a shader parameter previously set with {@link setParameter}.
     *
     * @param {string} name - The name of the parameter to delete.
     */
    deleteParameter(name) {
        this._parameters.delete(name);
        if (this._placement) this._placement.renderDirty = true;
    }

    /**
     * Gets an instance texture by name. Instance textures are per-component textures defined
     * in the resource's format with `storage: GSPLAT_STREAM_INSTANCE`. Only available in unified mode.
     *
     * @param {string} name - The name of the texture.
     * @returns {Texture|null} The texture, or null if not found or not in unified mode.
     * @example
     * // Add an instance stream to the resource format
     * resource.format.addExtraStreams([
     *     { name: 'instanceTint', format: pc.PIXELFORMAT_RGBA8, storage: pc.GSPLAT_STREAM_INSTANCE }
     * ]);
     *
     * // Get the instance texture and fill it with data
     * const texture = entity.gsplat.getInstanceTexture('instanceTint');
     * if (texture) {
     *     const data = texture.lock();
     *     // Fill texture data...
     *     texture.unlock();
     * }
     */
    getInstanceTexture(name) {
        if (!this._placement) {
            return null;
        }
        return this._placement.getInstanceTexture(name, this.system.app.graphicsDevice) ?? null;
    }

    _onGSplatAssetAdded() {
        if (!this._assetReference.asset) {
            return;
        }

        if (this._assetReference.asset.resource) {
            this._onGSplatAssetLoad();
        } else if (this.enabled && this.entity.enabled) {
            this.system.app.assets.load(this._assetReference.asset);
        }
    }

    _onGSplatAssetLoad() {

        // remove existing instance
        this.destroyInstance();

        // Get resource from either direct resource or asset
        const resource = this._resource ?? this._assetReference.asset?.resource;
        if (!resource) return;

        if (this.unified) {

            this._placement = null;

            this._placement = new GSplatPlacement(resource, this.entity, 0, this._parameters, null, this._id);
            this._placement.lodDistances = this._lodDistances;
            this._placement.workBufferUpdate = this._workBufferUpdate;
            this._placement.workBufferModifier = this._workBufferModifier;

            // add placement to layers if component is enabled
            if (this.enabled && this.entity.enabled) {
                this.addToLayers();
            }

        } else {

            // create new instance
            this.instance = new GSplatInstance(resource, {
                material: this._materialTmp,
                highQualitySH: this._highQualitySH,
                scene: this.system.app.scene
            });
            this._materialTmp = null;
        }
    }

    _onGSplatAssetUnload() {
        // when unloading asset, only remove the instance
        this.destroyInstance();
    }

    _onGSplatAssetRemove() {
        this._onGSplatAssetUnload();
    }
}

export { GSplatComponent };
