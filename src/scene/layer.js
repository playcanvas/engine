import { Debug } from '../core/debug.js';
import { hash32Fnv1a } from '../core/hash.js';
import {
    LIGHTTYPE_DIRECTIONAL,
    SORTMODE_BACK2FRONT, SORTMODE_CUSTOM, SORTMODE_FRONT2BACK, SORTMODE_MATERIALMESH, SORTMODE_NONE
} from './constants.js';
import { LightList } from './lighting/light-list.js';
import { Material } from './materials/material.js';

/**
 * @import { Camera } from './camera.js'
 * @import { CameraComponent } from '../framework/components/camera/component.js'
 * @import { Light } from './light.js'
 * @import { LightComponent } from '../framework/components/light/component.js'
 * @import { MeshInstance } from './mesh-instance.js'
 * @import { Vec3 } from '../core/math/vec3.js'
 * @import { GSplatPlacement } from './gsplat-unified/gsplat-placement.js'
 */

// Layers
let layerCounter = 0;

const lightKeys = [];
const _tempMaterials = new Set();

function sortManual(drawCallA, drawCallB) {
    return drawCallA.drawOrder - drawCallB.drawOrder;
}

function sortMaterialMesh(drawCallA, drawCallB) {
    const keyA = drawCallA._sortKeyForward;
    const keyB = drawCallB._sortKeyForward;
    if (keyA === keyB) {
        return drawCallB.mesh.id - drawCallA.mesh.id;
    }
    return keyB - keyA;
}

function sortBackToFront(drawCallA, drawCallB) {
    return drawCallB._sortKeyDynamic - drawCallA._sortKeyDynamic;
}

function sortFrontToBack(drawCallA, drawCallB) {
    return drawCallA._sortKeyDynamic - drawCallB._sortKeyDynamic;
}

const sortCallbacks = [null, sortManual, sortMaterialMesh, sortBackToFront, sortFrontToBack];

class CulledInstances {
    /**
     * Visible opaque mesh instances.
     *
     * @type {MeshInstance[]}
     */
    opaque = [];

    /**
     * Visible transparent mesh instances.
     *
     * @type {MeshInstance[]}
     */
    transparent = [];
}

/**
 * A Layer represents a renderable subset of the scene. It can contain a list of mesh instances,
 * lights and cameras, their render settings and also defines custom callbacks before, after or
 * during rendering. Layers are organized inside {@link LayerComposition} in a desired order.
 *
 * A mesh instance is drawn through the layers it belongs to, and a camera draws only the layers
 * listed in {@link CameraComponent#layers}. Components place their mesh instances by layer id, for
 * example through {@link RenderComponent#layers}, and lights through {@link LightComponent#layers};
 * mesh instances you create yourself go in with {@link addMeshInstances} and out with
 * {@link removeMeshInstances}.
 *
 * The application creates five layers, reachable by id from {@link Scene#layers}:
 * {@link LAYERID_WORLD} for the scene itself, {@link LAYERID_DEPTH}, {@link LAYERID_SKYBOX},
 * {@link LAYERID_IMMEDIATE} for debug drawing and {@link LAYERID_UI}. Within a layer, opaque and
 * transparent mesh instances are drawn as two separate parts, ordered by {@link opaqueSortMode}
 * and {@link transparentSortMode}, and the composition decides where each part falls in the frame.
 * Set {@link enabled} to false to skip a layer entirely, and use {@link onEnable} and
 * {@link onDisable} to react to that.
 *
 * @example
 * // Draw a set of mesh instances in a layer of their own, right after the world's opaque objects
 * const layers = app.scene.layers;
 * const layer = new Layer({ name: 'Overlay' });
 * const world = layers.getLayerById(LAYERID_WORLD);
 * layers.insert(layer, layers.getOpaqueIndex(world) + 1);
 * layer.addMeshInstances(meshInstances);
 * @category Graphics
 */
class Layer {
    // --- Identity ---

    /**
     * A unique ID of the layer. Layer IDs are stored inside {@link ModelComponent#layers},
     * {@link RenderComponent#layers}, {@link CameraComponent#layers},
     * {@link LightComponent#layers} and {@link ElementComponent#layers} instead of names.
     * Can be used in {@link LayerComposition#getLayerById}.
     *
     * @type {number}
     */
    id;

    /**
     * Name of the layer. Can be used in {@link LayerComposition#getLayerByName}.
     *
     * @type {string}
     */
    name;

    // --- Enabled state & ref counting ---

    /**
     * @type {boolean}
     * @private
     */
    _enabled = true;

    /**
     * @type {number}
     * @private
     */
    _refCounter = 1;

    // --- Sorting ---

    /**
     * Defines the method used for sorting opaque (that is, not semi-transparent) mesh
     * instances before rendering. Can be:
     *
     * - {@link SORTMODE_NONE}
     * - {@link SORTMODE_MANUAL}
     * - {@link SORTMODE_MATERIALMESH}
     * - {@link SORTMODE_BACK2FRONT}
     * - {@link SORTMODE_FRONT2BACK}
     *
     * Defaults to {@link SORTMODE_MATERIALMESH}.
     *
     * @type {number}
     */
    opaqueSortMode = SORTMODE_MATERIALMESH;

    /**
     * Defines the method used for sorting semi-transparent mesh instances before rendering. Can be:
     *
     * - {@link SORTMODE_NONE}
     * - {@link SORTMODE_MANUAL}
     * - {@link SORTMODE_MATERIALMESH}
     * - {@link SORTMODE_BACK2FRONT}
     * - {@link SORTMODE_FRONT2BACK}
     *
     * Defaults to {@link SORTMODE_BACK2FRONT}.
     *
     * @type {number}
     */
    transparentSortMode = SORTMODE_BACK2FRONT;

    /**
     * @type {Function|null}
     * @ignore
     */
    customSortCallback = null;

    /**
     * @type {Function|null}
     * @ignore
     */
    customCalculateSortValues = null;

    // --- Clear flags ---

    /** @private */
    _clearColorBuffer = false;

    /** @private */
    _clearDepthBuffer = false;

    /** @private */
    _clearStencilBuffer = false;

    // --- Enable / disable callbacks ---

    /**
     * Custom function that is called after the layer has been enabled. This happens when:
     *
     * - The layer is created with {@link enabled} set to true (which is the default value).
     * - {@link enabled} was changed from false to true
     *
     * @type {Function}
     */
    onEnable;

    /**
     * Custom function that is called after the layer has been disabled. This happens when:
     *
     * - {@link enabled} was changed from true to false
     * - `decrementCounter` was called and set the counter to zero.
     *
     * @type {Function}
     */
    onDisable;

    // --- Mesh instances & shadow casters ---

    /**
     * Cached mesh instances, rebuilt from the set after removals.
     *
     * @type {MeshInstance[]}
     * @private
     */
    _meshInstances = [];

    /**
     * Whether both membership caches need rebuilding from their sets.
     *
     * @private
     */
    _meshInstancesDirty = false;

    /**
     * Mesh instances assigned to this layer, stored in a set.
     *
     * @type {Set<MeshInstance>}
     * @ignore
     */
    meshInstancesSet = new Set();

    /**
     * Cached shadow casters, rebuilt from the set after removals.
     *
     * @type {MeshInstance[]}
     * @private
     */
    _shadowCasters = [];

    /**
     * Shadow casting instances assigned to this layer, stored in a set.
     *
     * @type {Set<MeshInstance>}
     * @ignore
     */
    shadowCastersSet = new Set();

    /**
     * Visible (culled) mesh instances assigned to this layer. Looked up by the Camera.
     *
     * @type {WeakMap<Camera, CulledInstances>}
     * @private
     */
    _visibleInstances = new WeakMap();

    // --- Lights ---

    /**
     * All lights assigned to a layer.
     *
     * @type {Light[]}
     * @private
     */
    _lights = [];

    /**
     * All lights assigned to a layer stored in a set.
     *
     * @type {Set<Light>}
     * @private
     */
    _lightsSet = new Set();

    /**
     * Set of light used by clustered lighting (omni and spot, but no directional).
     *
     * @type {Set<Light>}
     * @private
     */
    _clusteredLightsSet = new Set();

    /**
     * The lights of the layer in the forms the renderer consumes, see {@link LightList}. Rebuilt
     * lazily by {@link Layer#getLightList} when lights were added or removed, or their key changed.
     *
     * @type {LightList}
     * @private
     */
    _lightList = new LightList();

    /** @private */
    _lightListDirty = true;

    /** @private */
    _lightIdHash = 0;

    /** @private */
    _lightIdHashDirty = false;

    /**
     * True if the objects rendered on the layer require light cube (emitters with lighting do).
     *
     * @ignore
     */
    requiresLightCube = false;

    // --- Cameras ---

    /**
     * @type {CameraComponent[]}
     * @ignore
     */
    cameras = [];

    /**
     * @type {Set<Camera>}
     * @ignore
     */
    camerasSet = new Set();

    // --- GSplat ---

    /**
     * @type {GSplatPlacement[]}
     * @ignore
     */
    gsplatPlacements = [];

    /**
     * @type {Set<GSplatPlacement>}
     * @ignore
     */
    gsplatPlacementsSet = new Set();

    /**
     * @type {GSplatPlacement[]}
     * @ignore
     */
    gsplatShadowCasters = [];

    /**
     * @type {Set<GSplatPlacement>}
     * @ignore
     */
    gsplatShadowCastersSet = new Set();

    /**
     * True if the gsplatPlacements array was modified.
     *
     * @ignore
     */
    gsplatPlacementsDirty = true;

    // --- Composition / shader versioning ---

    /**
     * True if the composition is invalidated.
     *
     * @ignore
     */
    _dirtyComposition = false;

    /** @private */
    _shaderVersion = -1;

    // --- Profiler ---

    // #if _PROFILER
    _renderTime = 0;

    _forwardDrawCalls = 0;

    // deprecated, not useful on a layer anymore, could be moved to camera
    _shadowDrawCalls = 0;
    // #endif

    /**
     * Create a new Layer instance.
     *
     * @param {object} options - Object for passing optional arguments. These arguments are the
     * same as properties of the Layer.
     */
    constructor(options = {}) {

        if (options.id !== undefined) {
            this.id = options.id;
            layerCounter = Math.max(this.id + 1, layerCounter);
        } else {
            this.id = layerCounter++;
        }

        this.name = options.name;

        this._enabled = options.enabled ?? true;
        this._refCounter = this._enabled ? 1 : 0;

        this.opaqueSortMode = options.opaqueSortMode ?? SORTMODE_MATERIALMESH;
        this.transparentSortMode = options.transparentSortMode ?? SORTMODE_BACK2FRONT;

        this._clearColorBuffer = !!options.clearColorBuffer;
        this._clearDepthBuffer = !!options.clearDepthBuffer;
        this._clearStencilBuffer = !!options.clearStencilBuffer;

        this.onEnable = options.onEnable;
        this.onDisable = options.onDisable;

        if (this._enabled && this.onEnable) {
            this.onEnable();
        }
    }

    /**
     * Mesh instances assigned to this layer. The cached array is refreshed on access after
     * removals; callers should use the layer's add/remove methods to change membership.
     *
     * @type {MeshInstance[]}
     * @ignore
     */
    get meshInstances() {
        if (this._meshInstancesDirty) {
            this._updateMeshInstanceCaches();
        }
        return this._meshInstances;
    }

    /**
     * Shadow casting instances assigned to this layer. The cached array is refreshed on access
     * after removals; callers should use the layer's add/remove methods to change membership.
     *
     * @type {MeshInstance[]}
     * @ignore
     */
    get shadowCasters() {
        if (this._meshInstancesDirty) {
            this._updateMeshInstanceCaches();
        }
        return this._shadowCasters;
    }

    /** @private */
    _updateMeshInstanceCaches() {
        let index = 0;
        for (const meshInstance of this.meshInstancesSet) {
            this._meshInstances[index++] = meshInstance;
        }
        this._meshInstances.length = index;

        index = 0;
        for (const meshInstance of this.shadowCastersSet) {
            this._shadowCasters[index++] = meshInstance;
        }
        this._shadowCasters.length = index;
        this._meshInstancesDirty = false;
    }

    /** @private */
    _clearMeshInstanceCaches() {
        // Release removed instances even if the layer is never rendered or read again.
        this._meshInstances.length = 0;
        this._shadowCasters.length = 0;
    }

    /**
     * Sets the enabled state of the layer. Disabled layers are skipped. Defaults to true.
     *
     * @type {boolean}
     */
    set enabled(val) {
        if (val !== this._enabled) {
            this._dirtyComposition = true;
            this.gsplatPlacementsDirty = true;
            this._enabled = val;
            if (val) {
                this.incrementCounter();
                if (this.onEnable) this.onEnable();
            } else {
                this.decrementCounter();
                if (this.onDisable) this.onDisable();
            }
        }
    }

    /**
     * Gets the enabled state of the layer.
     *
     * @type {boolean}
     */
    get enabled() {
        return this._enabled;
    }

    /**
     * Sets whether the camera will clear the color buffer when it renders this layer.
     *
     * @type {boolean}
     */
    set clearColorBuffer(val) {
        this._clearColorBuffer = val;
        this._dirtyComposition = true;
    }

    /**
     * Gets whether the camera will clear the color buffer when it renders this layer.
     *
     * @type {boolean}
     */
    get clearColorBuffer() {
        return this._clearColorBuffer;
    }

    /**
     * Sets whether the camera will clear the depth buffer when it renders this layer.
     *
     * @type {boolean}
     */
    set clearDepthBuffer(val) {
        this._clearDepthBuffer = val;
        this._dirtyComposition = true;
    }

    /**
     * Gets whether the camera will clear the depth buffer when it renders this layer.
     *
     * @type {boolean}
     */
    get clearDepthBuffer() {
        return this._clearDepthBuffer;
    }

    /**
     * Sets whether the camera will clear the stencil buffer when it renders this layer.
     *
     * @type {boolean}
     */
    set clearStencilBuffer(val) {
        this._clearStencilBuffer = val;
        this._dirtyComposition = true;
    }

    /**
     * Gets whether the camera will clear the stencil buffer when it renders this layer.
     *
     * @type {boolean}
     */
    get clearStencilBuffer() {
        return this._clearStencilBuffer;
    }

    /**
     * Gets whether the layer contains omni or spot lights.
     *
     * @type {boolean}
     * @ignore
     */
    get hasClusteredLights() {
        return this._clusteredLightsSet.size > 0;
    }

    /**
     * Gets the lights used by clustered lighting in a set.
     *
     * @type {Set<Light>}
     * @ignore
     */
    get clusteredLightsSet() {
        return this._clusteredLightsSet;
    }

    /**
     * Increments the usage counter of this layer. By default, layers are created with counter set
     * to 1 (if {@link Layer.enabled} is true) or 0 (if it was false). Incrementing the counter
     * from 0 to 1 will enable the layer and call {@link Layer.onEnable}. Use this function to
     * "subscribe" multiple effects to the same layer. For example, if the layer is used to render
     * a reflection texture which is used by 2 mirrors, then each mirror can call this function
     * when visible and {@link Layer.decrementCounter} if invisible. In such case the reflection
     * texture won't be updated, when there is nothing to use it, saving performance.
     *
     * @ignore
     */
    incrementCounter() {
        if (this._refCounter === 0) {
            this._enabled = true;
            if (this.onEnable) this.onEnable();
        }
        this._refCounter++;
    }

    /**
     * Decrements the usage counter of this layer. Decrementing the counter from 1 to 0 will
     * disable the layer and call {@link Layer.onDisable}.
     *
     * @ignore
     */
    decrementCounter() {
        if (this._refCounter === 1) {
            this._enabled = false;
            if (this.onDisable) this.onDisable();

        } else if (this._refCounter === 0) {
            Debug.warn('Trying to decrement layer counter below 0');
            return;
        }
        this._refCounter--;
    }

    /**
     * Adds a gsplat placement to this layer.
     *
     * @param {GSplatPlacement} placement - A placement of a gsplat.
     * @ignore
     */
    addGSplatPlacement(placement) {
        if (!this.gsplatPlacementsSet.has(placement)) {
            this.gsplatPlacements.push(placement);
            this.gsplatPlacementsSet.add(placement);
            this.gsplatPlacementsDirty = true;
        }
    }

    /**
     * Removes a gsplat placement from this layer.
     *
     * @param {GSplatPlacement} placement - A placement of a gsplat.
     * @ignore
     */
    removeGSplatPlacement(placement) {
        const index = this.gsplatPlacements.indexOf(placement);
        if (index >= 0) {
            this.gsplatPlacements.splice(index, 1);
            this.gsplatPlacementsSet.delete(placement);
            this.gsplatPlacementsDirty = true;
        }
    }

    /**
     * Adds a gsplat placement to this layer as a shadow caster.
     *
     * @param {GSplatPlacement} placement - A placement of a gsplat.
     * @ignore
     */
    addGSplatShadowCaster(placement) {
        if (!this.gsplatShadowCastersSet.has(placement)) {
            this.gsplatShadowCasters.push(placement);
            this.gsplatShadowCastersSet.add(placement);
            this.gsplatPlacementsDirty = true;
        }
    }

    /**
     * Removes a gsplat placement from the shadow casters of this layer.
     *
     * @param {GSplatPlacement} placement - A placement of a gsplat.
     * @ignore
     */
    removeGSplatShadowCaster(placement) {
        const index = this.gsplatShadowCasters.indexOf(placement);
        if (index >= 0) {
            this.gsplatShadowCasters.splice(index, 1);
            this.gsplatShadowCastersSet.delete(placement);
            this.gsplatPlacementsDirty = true;
        }
    }

    /**
     * Adds an array of mesh instances to this layer.
     *
     * @param {MeshInstance[]} meshInstances - Array of {@link MeshInstance}.
     * @param {boolean} [skipShadowCasters] - Set it to true if you don't want these mesh instances
     * to cast shadows in this layer. Defaults to false.
     */
    addMeshInstances(meshInstances, skipShadowCasters) {

        // Adds do not dirty the caches: append while they are clean, or update only the set if a
        // removal already dirtied them. Either getter then rebuilds both arrays with those additions.
        const destMeshInstances = this._meshInstancesDirty ? null : this._meshInstances;
        const destMeshInstancesSet = this.meshInstancesSet;

        for (let i = 0; i < meshInstances.length; i++) {
            const mi = meshInstances[i];
            if (!destMeshInstancesSet.has(mi)) {
                destMeshInstances?.push(mi);
                destMeshInstancesSet.add(mi);
                _tempMaterials.add(mi.material);
            }
        }

        // shadow casters
        if (!skipShadowCasters) {
            this.addShadowCasters(meshInstances);
        }

        // clear old shader variants if necessary
        if (_tempMaterials.size > 0) {
            const sceneShaderVer = this._shaderVersion;
            _tempMaterials.forEach((mat) => {
                if (sceneShaderVer >= 0 && mat._shaderVersion !== sceneShaderVer)  {
                    // skip this for materials not using variants
                    if (mat.getShaderVariant !== Material.prototype.getShaderVariant) {
                        // clear shader variants on the material and also on mesh instances that use it
                        mat.clearVariants();
                    }
                    mat._shaderVersion = sceneShaderVer;
                }
            });
            _tempMaterials.clear();
        }
    }

    /**
     * Removes multiple mesh instances from this layer.
     *
     * @param {MeshInstance[]} meshInstances - Array of {@link MeshInstance}. If they were added to
     * this layer, they will be removed.
     * @param {boolean} [skipShadowCasters] - Set it to true if you want to still cast shadows from
     * removed mesh instances or if they never did cast shadows before. Defaults to false.
     */
    removeMeshInstances(meshInstances, skipShadowCasters) {

        const destMeshInstancesSet = this.meshInstancesSet;

        // mesh instances
        for (let i = 0; i < meshInstances.length; i++) {
            const mi = meshInstances[i];

            // remove from mesh instances list
            if (destMeshInstancesSet.delete(mi)) {
                this._meshInstancesDirty = true;
            }
        }

        // shadow casters
        if (!skipShadowCasters) {
            this.removeShadowCasters(meshInstances);
        }

        // The input can alias either cache, so consume it for both sets before clearing arrays.
        if (this._meshInstancesDirty) {
            this._clearMeshInstanceCaches();
        }
    }

    /**
     * Adds an array of mesh instances to this layer, but only as shadow casters (they will not be
     * rendered anywhere, but only cast shadows on other objects).
     *
     * @param {MeshInstance[]} meshInstances - Array of {@link MeshInstance}.
     */
    addShadowCasters(meshInstances) {
        const shadowCasters = this._meshInstancesDirty ? null : this._shadowCasters;
        const shadowCastersSet = this.shadowCastersSet;

        for (let i = 0; i < meshInstances.length; i++) {
            const mi = meshInstances[i];
            if (mi.castShadow && !shadowCastersSet.has(mi)) {
                shadowCastersSet.add(mi);
                shadowCasters?.push(mi);
            }
        }
    }

    /**
     * Removes multiple mesh instances from the shadow casters list of this layer, meaning they
     * will stop casting shadows.
     *
     * @param {MeshInstance[]} meshInstances - Array of {@link MeshInstance}. If they were added to
     * this layer, they will be removed.
     */
    removeShadowCasters(meshInstances) {
        const shadowCastersSet = this.shadowCastersSet;

        for (let i = 0; i < meshInstances.length; i++) {
            const mi = meshInstances[i];
            if (shadowCastersSet.delete(mi)) {
                this._meshInstancesDirty = true;
            }
        }

        if (this._meshInstancesDirty) {
            this._clearMeshInstanceCaches();
        }
    }

    /**
     * Removes all mesh instances from this layer.
     *
     * @param {boolean} [skipShadowCasters] - Set it to true if you want to continue the existing mesh
     * instances to cast shadows. Defaults to false, which removes shadow casters as well.
     */
    clearMeshInstances(skipShadowCasters = false) {
        this._meshInstances.length = 0;
        this.meshInstancesSet.clear();

        if (!skipShadowCasters) {
            this._shadowCasters.length = 0;
            this.shadowCastersSet.clear();
            this._meshInstancesDirty = false;
        }
    }

    markLightsDirty() {
        this._lightIdHashDirty = true;
        this._lightListDirty = true;
    }

    hasLight(light) {
        return this._lightsSet.has(light);
    }

    /**
     * Adds a light to this layer.
     *
     * @param {LightComponent} light - A {@link LightComponent}.
     */
    addLight(light) {

        // if the light is not in the layer already
        const l = light.light;
        if (!this._lightsSet.has(l)) {
            this._lightsSet.add(l);

            this._lights.push(l);
            this.markLightsDirty();
        }

        if (l.type !== LIGHTTYPE_DIRECTIONAL) {
            this._clusteredLightsSet.add(l);
        }
    }

    /**
     * Removes a light from this layer.
     *
     * @param {LightComponent} light - A {@link LightComponent}.
     */
    removeLight(light) {

        const l = light.light;
        if (this._lightsSet.has(l)) {
            this._lightsSet.delete(l);

            this._lights.splice(this._lights.indexOf(l), 1);
            this.markLightsDirty();
        }

        if (l.type !== LIGHTTYPE_DIRECTIONAL) {
            this._clusteredLightsSet.delete(l);
        }
    }

    /**
     * Removes all lights from this layer.
     */
    clearLights() {

        // notify lights
        this._lightsSet.forEach(light => light.removeLayer(this));

        this._lightsSet.clear();
        this._clusteredLightsSet.clear();
        this._lights.length = 0;
        this.markLightsDirty();
    }

    /**
     * Returns the lights of the layer in the forms the renderer consumes, rebuilding them if the
     * lights changed since, or if clustered lighting was toggled - the local lights take a light
     * slot only when it is disabled. Callers reading only the directional lights, which do not
     * depend on it, may leave the flag out.
     *
     * @param {boolean} [clustered] - Whether clustered lighting is enabled. Defaults to the value
     * the list was last built for.
     * @returns {LightList} The lights of the layer.
     * @ignore
     */
    getLightList(clustered = this._lightList.clustered) {
        const lightList = this._lightList;
        if (this._lightListDirty || lightList.clustered !== clustered) {
            this._lightListDirty = false;
            lightList.update(this._lights, clustered);
        }
        return lightList;
    }

    evaluateLightHash(localLights, directionalLights, useIds) {

        let hash = 0;

        // select local/directional lights based on request
        const lights = this._lights;
        for (let i = 0; i < lights.length; i++) {

            const isLocalLight = lights[i].type !== LIGHTTYPE_DIRECTIONAL;

            if ((localLights && isLocalLight) || (directionalLights && !isLocalLight)) {
                lightKeys.push(useIds ? lights[i].id : lights[i].key);
            }
        }

        if (lightKeys.length > 0) {

            // sort the keys to make sure the hash is the same for the same set of lights
            lightKeys.sort();

            hash = hash32Fnv1a(lightKeys);
            lightKeys.length = 0;
        }

        return hash;
    }


    // This is only used in clustered lighting mode
    getLightIdHash() {
        if (this._lightIdHashDirty) {
            this._lightIdHashDirty = false;

            // Generate hash based on Ids of lights sorted by ids, to check if the layers have the same set of lights
            // Only use local lights (directional lights are not used for clustered lighting)
            this._lightIdHash = this.evaluateLightHash(true, false, true);
        }

        return this._lightIdHash;
    }

    /**
     * Adds a camera to this layer.
     *
     * @param {CameraComponent} camera - A {@link CameraComponent}.
     */
    addCamera(camera) {
        if (!this.camerasSet.has(camera.camera)) {
            this.camerasSet.add(camera.camera);
            this.cameras.push(camera);
            this._dirtyComposition = true;
        }
    }

    /**
     * Removes a camera from this layer.
     *
     * @param {CameraComponent} camera - A {@link CameraComponent}.
     */
    removeCamera(camera) {
        if (this.camerasSet.has(camera.camera)) {
            this.camerasSet.delete(camera.camera);
            const index = this.cameras.indexOf(camera);
            this.cameras.splice(index, 1);
            this._dirtyComposition = true;
        }
    }

    /**
     * Removes all cameras from this layer.
     */
    clearCameras() {
        this.cameras.length = 0;
        this.camerasSet.clear();
        this._dirtyComposition = true;
    }

    /**
     * @param {MeshInstance[]} drawCalls - Array of mesh instances.
     * @param {Vec3} camPos - Camera position.
     * @param {Vec3} camFwd - Camera forward vector.
     * @private
     */
    _calculateSortDistances(drawCalls, camPos, camFwd) {
        const count = drawCalls.length;
        const { x: px, y: py, z: pz } = camPos;
        const { x: fx, y: fy, z: fz } = camFwd;

        for (let i = 0; i < count; i++) {
            const drawCall = drawCalls[i];

            // compute distance from camera to mesh along the forward vector
            let zDist;
            if (drawCall.calculateSortDistance) {
                zDist = drawCall.calculateSortDistance(drawCall, camPos, camFwd);
            } else {
                const meshPos = drawCall.aabb.center;
                zDist = (meshPos.x - px) * fx + (meshPos.y - py) * fy + (meshPos.z - pz) * fz;
            }

            // scale the bucket to give it a significantly higher magnitude than distance (1 billion)
            const bucket = drawCall._drawBucket * 1e9;

            // create sorting key based on the drawBucket and distance
            drawCall._sortKeyDynamic = bucket + zDist;
        }
    }

    /**
     * Get access to culled mesh instances for the provided camera.
     *
     * @param {Camera} camera - The camera.
     * @returns {CulledInstances} The culled mesh instances.
     * @ignore
     */
    getCulledInstances(camera) {
        let instances = this._visibleInstances.get(camera);
        if (!instances) {
            instances = new CulledInstances();
            this._visibleInstances.set(camera, instances);
        }
        return instances;
    }

    /**
     * @param {Camera} camera - The camera to sort the visible mesh instances for.
     * @param {boolean} transparent - True if transparent sorting should be used.
     * @ignore
     */
    sortVisible(camera, transparent) {

        const sortMode = transparent ? this.transparentSortMode : this.opaqueSortMode;
        if (sortMode === SORTMODE_NONE) {
            return;
        }

        const culledInstances = this.getCulledInstances(camera);
        const instances = transparent ? culledInstances.transparent : culledInstances.opaque;
        const cameraNode = camera.node;

        if (sortMode === SORTMODE_CUSTOM) {
            const sortPos = cameraNode.getPosition();
            const sortDir = cameraNode.forward;
            if (this.customCalculateSortValues) {
                this.customCalculateSortValues(instances, instances.length, sortPos, sortDir);
            }

            if (this.customSortCallback) {
                instances.sort(this.customSortCallback);
            }
        } else {
            if (sortMode === SORTMODE_BACK2FRONT || sortMode === SORTMODE_FRONT2BACK) {
                const sortPos = cameraNode.getPosition();
                const sortDir = cameraNode.forward;
                this._calculateSortDistances(instances, sortPos, sortDir);
            }

            instances.sort(sortCallbacks[sortMode]);
        }
    }
}

export { Layer, CulledInstances };
