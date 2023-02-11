import { Debug } from '../core/debug.js';
import { hashCode } from '../core/hash.js';

import {
    LIGHTTYPE_DIRECTIONAL,
    BLEND_NONE,
    LAYER_FX,
    SHADER_FORWARD,
    SORTKEY_FORWARD,
    SORTMODE_BACK2FRONT, SORTMODE_CUSTOM, SORTMODE_FRONT2BACK, SORTMODE_MATERIALMESH, SORTMODE_NONE
} from './constants.js';
import { Material } from './materials/material.js';

let keyA, keyB, sortPos, sortDir;

function sortManual(drawCallA, drawCallB) {
    return drawCallA.drawOrder - drawCallB.drawOrder;
}

function sortMaterialMesh(drawCallA, drawCallB) {
    keyA = drawCallA._key[SORTKEY_FORWARD];
    keyB = drawCallB._key[SORTKEY_FORWARD];
    if (keyA === keyB && drawCallA.mesh && drawCallB.mesh) {
        return drawCallB.mesh.id - drawCallA.mesh.id;
    }
    return keyB - keyA;
}

function sortBackToFront(drawCallA, drawCallB) {
    return drawCallB.zdist - drawCallA.zdist;
}

function sortFrontToBack(drawCallA, drawCallB) {
    return drawCallA.zdist - drawCallB.zdist;
}

const sortCallbacks = [null, sortManual, sortMaterialMesh, sortBackToFront, sortFrontToBack];

function sortLights(lightA, lightB) {
    return lightB.key - lightA.key;
}

// Layers
let layerCounter = 0;

class VisibleInstanceList {
    constructor() {
        this.list = [];
        this.length = 0;
        this.done = false;
    }
}

class InstanceList {
    constructor() {
        this.opaqueMeshInstances = [];
        this.transparentMeshInstances = [];
        this.shadowCasters = [];

        // arrays of VisibleInstanceList for each camera of this layer
        this.visibleOpaque = [];
        this.visibleTransparent = [];
    }

    // prepare for culling of camera with specified index
    prepare(index) {

        // make sure visibility lists are allocated
        if (!this.visibleOpaque[index]) {
            this.visibleOpaque[index] = new VisibleInstanceList();
        }

        if (!this.visibleTransparent[index]) {
            this.visibleTransparent[index] = new VisibleInstanceList();
        }

        // mark them as not processed yet
        this.visibleOpaque[index].done = false;
        this.visibleTransparent[index].done = false;
    }

    // delete entry for a camera with specified index
    delete(index) {
        if (index < this.visibleOpaque.length) {
            this.visibleOpaque.splice(index, 1);
        }
        if (index < this.visibleTransparent.length) {
            this.visibleTransparent.splice(index, 1);
        }
    }
}

/**
 * A Layer represents a renderable subset of the scene. It can contain a list of mesh instances,
 * lights and cameras, their render settings and also defines custom callbacks before, after or
 * during rendering. Layers are organized inside {@link LayerComposition} in a desired order.
 */
class Layer {
    /**
     * Create a new Layer instance.
     *
     * @param {object} options - Object for passing optional arguments. These arguments are the
     * same as properties of the Layer.
     */
    constructor(options = {}) {

        if (options.id !== undefined) {
            /**
             * A unique ID of the layer. Layer IDs are stored inside {@link ModelComponent#layers},
             * {@link RenderComponent#layers}, {@link CameraComponent#layers},
             * {@link LightComponent#layers} and {@link ElementComponent#layers} instead of names.
             * Can be used in {@link LayerComposition#getLayerById}.
             *
             * @type {number}
             */
            this.id = options.id;
            layerCounter = Math.max(this.id + 1, layerCounter);
        } else {
            this.id = layerCounter++;
        }

        /**
         * Name of the layer. Can be used in {@link LayerComposition#getLayerByName}.
         *
         * @type {string}
         */
        this.name = options.name;

        /**
         * @type {boolean}
         * @private
         */
        this._enabled = options.enabled ?? true;
        /**
         * @type {number}
         * @private
         */
        this._refCounter = this._enabled ? 1 : 0;

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
        this.opaqueSortMode = options.opaqueSortMode ?? SORTMODE_MATERIALMESH;

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
        this.transparentSortMode = options.transparentSortMode ?? SORTMODE_BACK2FRONT;

        if (options.renderTarget) {
            this.renderTarget = options.renderTarget;
        }

        /**
         * A type of shader to use during rendering. Possible values are:
         *
         * - {@link SHADER_FORWARD}
         * - {@link SHADER_FORWARDHDR}
         * - {@link SHADER_DEPTH}
         * - Your own custom value. Should be in 19 - 31 range. Use {@link StandardMaterial#onUpdateShader}
         * to apply shader modifications based on this value.
         *
         * Defaults to {@link SHADER_FORWARD}.
         *
         * @type {number}
         */
        this.shaderPass = options.shaderPass ?? SHADER_FORWARD;

        /**
         * Tells that this layer is simple and needs to just render a bunch of mesh instances
         * without lighting, skinning and morphing (faster). Used for UI and Gizmo layers (the
         * layer doesn't use lights, shadows, culling, etc).
         *
         * @type {boolean}
         */
        this.passThrough = options.passThrough ?? false;

        // clear flags
        /**
         * @type {boolean}
         * @private
         */
        this._clearColorBuffer = !!options.clearColorBuffer;

        /**
         * @type {boolean}
         * @private
         */
        this._clearDepthBuffer = !!options.clearDepthBuffer;

        /**
         * @type {boolean}
         * @private
         */
        this._clearStencilBuffer = !!options.clearStencilBuffer;

        /**
         * Custom function that is called before visibility culling is performed for this layer.
         * Useful, for example, if you want to modify camera projection while still using the same
         * camera and make frustum culling work correctly with it (see
         * {@link CameraComponent#calculateTransform} and {@link CameraComponent#calculateProjection}).
         * This function will receive camera index as the only argument. You can get the actual
         * camera being used by looking up {@link LayerComposition#cameras} with this index.
         *
         * @type {Function}
         */
        this.onPreCull = options.onPreCull;
        /**
         * Custom function that is called before this layer is rendered. Useful, for example, for
         * reacting on screen size changes. This function is called before the first occurrence of
         * this layer in {@link LayerComposition}. It will receive camera index as the only
         * argument. You can get the actual camera being used by looking up
         * {@link LayerComposition#cameras} with this index.
         *
         * @type {Function}
         */
        this.onPreRender = options.onPreRender;
        /**
         * Custom function that is called before opaque mesh instances (not semi-transparent) in
         * this layer are rendered. This function will receive camera index as the only argument.
         * You can get the actual camera being used by looking up {@link LayerComposition#cameras}
         * with this index.
         *
         * @type {Function}
         */
        this.onPreRenderOpaque = options.onPreRenderOpaque;
        /**
         * Custom function that is called before semi-transparent mesh instances in this layer are
         * rendered. This function will receive camera index as the only argument. You can get the
         * actual camera being used by looking up {@link LayerComposition#cameras} with this index.
         *
         * @type {Function}
         */
        this.onPreRenderTransparent = options.onPreRenderTransparent;

        /**
         * Custom function that is called after visibility culling is performed for this layer.
         * Useful for reverting changes done in {@link Layer#onPreCull} and determining final mesh
         * instance visibility (see {@link MeshInstance#visibleThisFrame}). This function will
         * receive camera index as the only argument. You can get the actual camera being used by
         * looking up {@link LayerComposition#cameras} with this index.
         *
         * @type {Function}
         */
        this.onPostCull = options.onPostCull;
        /**
         * Custom function that is called after this layer is rendered. Useful to revert changes
         * made in {@link Layer#onPreRender}. This function is called after the last occurrence of this
         * layer in {@link LayerComposition}. It will receive camera index as the only argument.
         * You can get the actual camera being used by looking up {@link LayerComposition#cameras}
         * with this index.
         *
         * @type {Function}
         */
        this.onPostRender = options.onPostRender;
        /**
         * Custom function that is called after opaque mesh instances (not semi-transparent) in
         * this layer are rendered. This function will receive camera index as the only argument.
         * You can get the actual camera being used by looking up {@link LayerComposition#cameras}
         * with this index.
         *
         * @type {Function}
         */
        this.onPostRenderOpaque = options.onPostRenderOpaque;
        /**
         * Custom function that is called after semi-transparent mesh instances in this layer are
         * rendered. This function will receive camera index as the only argument. You can get the
         * actual camera being used by looking up {@link LayerComposition#cameras} with this index.
         *
         * @type {Function}
         */
        this.onPostRenderTransparent = options.onPostRenderTransparent;

        /**
         * Custom function that is called before every mesh instance in this layer is rendered. It
         * is not recommended to set this function when rendering many objects every frame due to
         * performance reasons.
         *
         * @type {Function}
         */
        this.onDrawCall = options.onDrawCall;
        /**
         * Custom function that is called after the layer has been enabled. This happens when:
         *
         * - The layer is created with {@link Layer#enabled} set to true (which is the default value).
         * - {@link Layer#enabled} was changed from false to true
         * - {@link Layer#incrementCounter} was called and incremented the counter above zero.
         *
         * Useful for allocating resources this layer will use (e.g. creating render targets).
         *
         * @type {Function}
         */
        this.onEnable = options.onEnable;
        /**
         * Custom function that is called after the layer has been disabled. This happens when:
         *
         * - {@link Layer#enabled} was changed from true to false
         * - {@link Layer#decrementCounter} was called and set the counter to zero.
         *
         * @type {Function}
         */
        this.onDisable = options.onDisable;

        if (this._enabled && this.onEnable) {
            this.onEnable();
        }

        /**
         * Make this layer render the same mesh instances that another layer does instead of having
         * its own mesh instance list. Both layers must share cameras. Frustum culling is only
         * performed for one layer. Useful for rendering multiple passes using different shaders.
         *
         * @type {Layer}
         */
        this.layerReference = options.layerReference; // should use the same camera

        /**
         * @type {InstanceList}
         * @ignore
         */
        this.instances = options.layerReference ? options.layerReference.instances : new InstanceList();

        /**
         * Visibility bit mask that interacts with {@link MeshInstance#mask}. Especially useful
         * when combined with layerReference, allowing for the filtering of some objects, while
         * sharing their list and culling.
         *
         * @type {number}
         */
        this.cullingMask = options.cullingMask ? options.cullingMask : 0xFFFFFFFF;

        /**
         * @type {import('./mesh-instance.js').MeshInstance[]}
         * @ignore
         */
        this.opaqueMeshInstances = this.instances.opaqueMeshInstances;
        /**
         * @type {import('./mesh-instance.js').MeshInstance[]}
         * @ignore
         */
        this.transparentMeshInstances = this.instances.transparentMeshInstances;
        /**
         * @type {import('./mesh-instance.js').MeshInstance[]}
         * @ignore
         */
        this.shadowCasters = this.instances.shadowCasters;

        /**
         * @type {Function|null}
         * @ignore
         */
        this.customSortCallback = null;
        /**
         * @type {Function|null}
         * @ignore
         */
        this.customCalculateSortValues = null;

        /**
         * @type {import('./light.js').Light[]}
         * @private
         */
        this._lights = [];
        /**
         * @type {Set<import('./light.js').Light>}
         * @private
         */
        this._lightsSet = new Set();

        /**
         * Set of light used by clustered lighting (omni and spot, but no directional).
         *
         * @type {Set<import('./light.js').Light>}
         * @private
         */
        this._clusteredLightsSet = new Set();

        /**
         * Lights separated by light type.
         *
         * @type {import('./light.js').Light[][]}
         * @ignore
         */
        this._splitLights = [[], [], []];

        /**
         * @type {import('../framework/components/camera/component.js').CameraComponent[]}
         * @ignore
         */
        this.cameras = [];

        this._dirty = false;
        this._dirtyLights = false;
        this._dirtyCameras = false;

        this._lightHash = 0;
        this._staticLightHash = 0;
        this._needsStaticPrepare = true;
        this._staticPrepareDone = false;

        // #if _PROFILER
        this.skipRenderAfter = Number.MAX_VALUE;
        this._skipRenderCounter = 0;

        this._renderTime = 0;
        this._forwardDrawCalls = 0;
        this._shadowDrawCalls = 0;  // deprecated, not useful on a layer anymore, could be moved to camera
        // #endif

        this._shaderVersion = -1;

        /**
         * @type {Float32Array}
         * @ignore
         */
        this._lightCube = null;
    }

    /**
     * True if the layer contains omni or spot lights
     *
     * @type {boolean}
     * @ignore
     */
    get hasClusteredLights() {
        return this._clusteredLightsSet.size > 0;
    }

    /**
     * Enable the layer. Disabled layers are skipped. Defaults to true.
     *
     * @type {boolean}
     */
    set enabled(val) {
        if (val !== this._enabled) {
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

    get enabled() {
        return this._enabled;
    }

    /**
     * If true, the camera will clear the color buffer when it renders this layer.
     *
     * @type {boolean}
     */
    set clearColorBuffer(val) {
        this._clearColorBuffer = val;
        this._dirtyCameras = true;
    }

    get clearColorBuffer() {
        return this._clearColorBuffer;
    }

    /**
     * If true, the camera will clear the depth buffer when it renders this layer.
     *
     * @type {boolean}
     */
    set clearDepthBuffer(val) {
        this._clearDepthBuffer = val;
        this._dirtyCameras = true;
    }

    get clearDepthBuffer() {
        return this._clearDepthBuffer;
    }

    /**
     * If true, the camera will clear the stencil buffer when it renders this layer.
     *
     * @type {boolean}
     */
    set clearStencilBuffer(val) {
        this._clearStencilBuffer = val;
        this._dirtyCameras = true;
    }

    get clearStencilBuffer() {
        return this._clearStencilBuffer;
    }

    /**
     * Returns lights used by clustered lighting in a set.
     *
     * @type {Set<import('./light.js').Light>}
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
     * disable the layer and call {@link Layer.onDisable}. See {@link Layer#incrementCounter} for
     * more details.
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
     * Adds an array of mesh instances to this layer.
     *1
     *
     * @param {import('./mesh-instance.js').MeshInstance[]} meshInstances - Array of
     * {@link MeshInstance}.
     * @param {boolean} [skipShadowCasters] - Set it to true if you don't want these mesh instances
     * to cast shadows in this layer.
     */
    addMeshInstances(meshInstances, skipShadowCasters) {
        const sceneShaderVer = this._shaderVersion;

        const casters = this.shadowCasters;
        for (let i = 0; i < meshInstances.length; i++) {
            const m = meshInstances[i];
            const mat = m.material;
            const arr = mat.blendType === BLEND_NONE ? this.opaqueMeshInstances : this.transparentMeshInstances;

            // test for meshInstance in both arrays, as material's alpha could have changed since LayerComposition's update to avoid duplicates
            // TODO - following uses of indexOf are expensive, to add 5000 meshInstances costs about 70ms on Mac. Consider using Set.
            if (this.opaqueMeshInstances.indexOf(m) < 0 && this.transparentMeshInstances.indexOf(m) < 0) {
                arr.push(m);
            }

            if (!skipShadowCasters && m.castShadow && casters.indexOf(m) < 0) casters.push(m);

            // clear old shader variants if necessary
            if (!this.passThrough && sceneShaderVer >= 0 && mat._shaderVersion !== sceneShaderVer) {

                // skip this for materials not using variants
                if (mat.getShaderVariant !== Material.prototype.getShaderVariant) {
                    // clear shader variants on the material and also on mesh instances that use it
                    mat.clearVariants();
                }
                mat._shaderVersion = sceneShaderVer;
            }
        }
        if (!this.passThrough) this._dirty = true;
    }

    /**
     * Internal function to remove a mesh instance from an array.
     *
     * @param {import('./mesh-instance.js').MeshInstance} m - Mesh instance to remove.
     * @param {import('./mesh-instance.js').MeshInstance[]} arr - Array of mesh instances to remove
     * from.
     * @private
     */
    removeMeshInstanceFromArray(m, arr) {
        let spliceOffset = -1;
        let spliceCount = 0;
        const len = arr.length;
        for (let j = 0; j < len; j++) {
            const drawCall = arr[j];
            if (drawCall === m) {
                spliceOffset = j;
                spliceCount = 1;
                break;
            }
            if (drawCall._staticSource === m) {
                if (spliceOffset < 0) spliceOffset = j;
                spliceCount++;
            } else if (spliceOffset >= 0) {
                break;
            }
        }

        if (spliceOffset >= 0) {
            arr.splice(spliceOffset, spliceCount);
        }
    }

    /**
     * Removes multiple mesh instances from this layer.
     *
     * @param {import('./mesh-instance.js').MeshInstance[]} meshInstances - Array of
     * {@link MeshInstance}. If they were added to this layer, they will be removed.
     * @param {boolean} [skipShadowCasters] - Set it to true if you want to still cast shadows from
     * removed mesh instances or if they never did cast shadows before.
     */
    removeMeshInstances(meshInstances, skipShadowCasters) {

        const opaque = this.opaqueMeshInstances;
        const transparent = this.transparentMeshInstances;
        const casters = this.shadowCasters;

        for (let i = 0; i < meshInstances.length; i++) {
            const m = meshInstances[i];

            // remove from opaque
            this.removeMeshInstanceFromArray(m, opaque);

            // remove from transparent
            this.removeMeshInstanceFromArray(m, transparent);

            // remove from casters
            if (!skipShadowCasters) {
                const j = casters.indexOf(m);
                if (j >= 0)
                    casters.splice(j, 1);
            }
        }

        this._dirty = true;
    }

    /**
     * Removes all mesh instances from this layer.
     *
     * @param {boolean} [skipShadowCasters] - Set it to true if you want to still cast shadows from
     * removed mesh instances or if they never did cast shadows before.
     */
    clearMeshInstances(skipShadowCasters) {
        if (this.opaqueMeshInstances.length === 0 && this.transparentMeshInstances.length === 0) {
            if (skipShadowCasters || this.shadowCasters.length === 0) return;
        }
        this.opaqueMeshInstances.length = 0;
        this.transparentMeshInstances.length = 0;
        if (!skipShadowCasters) this.shadowCasters.length = 0;
        if (!this.passThrough) this._dirty = true;
    }

    /**
     * Adds a light to this layer.
     *
     * @param {import('../framework/components/light/component.js').LightComponent} light - A
     * {@link LightComponent}.
     */
    addLight(light) {

        // if the light is not in the layer already
        const l = light.light;
        if (!this._lightsSet.has(l)) {
            this._lightsSet.add(l);

            this._lights.push(l);
            this._dirtyLights = true;
            this._generateLightHash();
        }

        if (l.type !== LIGHTTYPE_DIRECTIONAL) {
            this._clusteredLightsSet.add(l);
        }
    }

    /**
     * Removes a light from this layer.
     *
     * @param {import('../framework/components/light/component.js').LightComponent} light - A
     * {@link LightComponent}.
     */
    removeLight(light) {

        const l = light.light;
        if (this._lightsSet.has(l)) {
            this._lightsSet.delete(l);

            this._lights.splice(this._lights.indexOf(l), 1);
            this._dirtyLights = true;
            this._generateLightHash();
        }

        if (l.type !== LIGHTTYPE_DIRECTIONAL) {
            this._clusteredLightsSet.delete(l);
        }
    }

    /**
     * Removes all lights from this layer.
     */
    clearLights() {
        this._lightsSet.clear();
        this._clusteredLightsSet.clear();
        this._lights.length = 0;
        this._dirtyLights = true;
    }

    /**
     * Adds an array of mesh instances to this layer, but only as shadow casters (they will not be
     * rendered anywhere, but only cast shadows on other objects).
     *
     * @param {import('./mesh-instance.js').MeshInstance[]} meshInstances - Array of
     * {@link MeshInstance}.
     */
    addShadowCasters(meshInstances) {
        const arr = this.shadowCasters;
        for (let i = 0; i < meshInstances.length; i++) {
            const m = meshInstances[i];
            if (!m.castShadow) continue;
            if (arr.indexOf(m) < 0) arr.push(m);
        }
        this._dirtyLights = true;
    }

    /**
     * Removes multiple mesh instances from the shadow casters list of this layer, meaning they
     * will stop casting shadows.
     *
     * @param {import('./mesh-instance.js').MeshInstance[]} meshInstances - Array of
     * {@link MeshInstance}. If they were added to this layer, they will be removed.
     */
    removeShadowCasters(meshInstances) {
        const arr = this.shadowCasters;
        for (let i = 0; i < meshInstances.length; i++) {
            const id = arr.indexOf(meshInstances[i]);
            if (id >= 0) arr.splice(id, 1);
        }
        this._dirtyLights = true;
    }

    /** @private */
    _generateLightHash() {
        // generate hash to check if layers have the same set of static lights
        // order of lights shouldn't matter
        if (this._lights.length > 0) {
            this._lights.sort(sortLights);
            let str = '';
            let strStatic = '';

            for (let i = 0; i < this._lights.length; i++) {
                if (this._lights[i].isStatic) {
                    strStatic += this._lights[i].key;
                } else {
                    str += this._lights[i].key;
                }
            }

            if (str.length === 0) {
                this._lightHash = 0;
            } else {
                this._lightHash = hashCode(str);
            }

            if (strStatic.length === 0) {
                this._staticLightHash = 0;
            } else {
                this._staticLightHash = hashCode(strStatic);
            }

        } else {
            this._lightHash = 0;
            this._staticLightHash = 0;
        }
    }

    /**
     * Adds a camera to this layer.
     *
     * @param {import('../framework/components/camera/component.js').CameraComponent} camera - A
     * {@link CameraComponent}.
     */
    addCamera(camera) {
        if (this.cameras.indexOf(camera) >= 0) return;
        this.cameras.push(camera);
        this._dirtyCameras = true;
    }

    /**
     * Removes a camera from this layer.
     *
     * @param {import('../framework/components/camera/component.js').CameraComponent} camera - A
     * {@link CameraComponent}.
     */
    removeCamera(camera) {
        const index = this.cameras.indexOf(camera);
        if (index >= 0) {
            this.cameras.splice(index, 1);
            this._dirtyCameras = true;

            // delete the visible list for this camera
            this.instances.delete(index);
        }
    }

    /**
     * Removes all cameras from this layer.
     */
    clearCameras() {
        this.cameras.length = 0;
        this._dirtyCameras = true;
    }

    /**
     * @param {import('./mesh-instance.js').MeshInstance[]} drawCalls - Array of mesh instances.
     * @param {number} drawCallsCount - Number of mesh instances.
     * @param {Vec3} camPos - Camera position.
     * @param {Vec3} camFwd - Camera forward vector.
     * @private
     */
    _calculateSortDistances(drawCalls, drawCallsCount, camPos, camFwd) {
        for (let i = 0; i < drawCallsCount; i++) {
            const drawCall = drawCalls[i];
            if (drawCall.command) continue;
            if (drawCall.layer <= LAYER_FX) continue; // Only alpha sort mesh instances in the main world (backwards comp)
            if (drawCall.calculateSortDistance) {
                drawCall.zdist = drawCall.calculateSortDistance(drawCall, camPos, camFwd);
                continue;
            }
            const meshPos = drawCall.aabb.center;
            const tempx = meshPos.x - camPos.x;
            const tempy = meshPos.y - camPos.y;
            const tempz = meshPos.z - camPos.z;
            drawCall.zdist = tempx * camFwd.x + tempy * camFwd.y + tempz * camFwd.z;
        }
    }

    /**
     * @param {boolean} transparent - True if transparent sorting should be used.
     * @param {import('./graph-node.js').GraphNode} cameraNode - Graph node that the camera is
     * attached to.
     * @param {number} cameraPass - Camera pass.
     * @ignore
     */
    _sortVisible(transparent, cameraNode, cameraPass) {
        const objects = this.instances;
        const sortMode = transparent ? this.transparentSortMode : this.opaqueSortMode;
        if (sortMode === SORTMODE_NONE) return;

        const visible = transparent ? objects.visibleTransparent[cameraPass] : objects.visibleOpaque[cameraPass];

        if (sortMode === SORTMODE_CUSTOM) {
            sortPos = cameraNode.getPosition();
            sortDir = cameraNode.forward;
            if (this.customCalculateSortValues) {
                this.customCalculateSortValues(visible.list, visible.length, sortPos, sortDir);
            }

            if (visible.list.length !== visible.length) {
                visible.list.length = visible.length;
            }

            if (this.customSortCallback) {
                visible.list.sort(this.customSortCallback);
            }
        } else {
            if (sortMode === SORTMODE_BACK2FRONT || sortMode === SORTMODE_FRONT2BACK) {
                sortPos = cameraNode.getPosition();
                sortDir = cameraNode.forward;
                this._calculateSortDistances(visible.list, visible.length, sortPos, sortDir);
            }

            if (visible.list.length !== visible.length) {
                visible.list.length = visible.length;
            }

            visible.list.sort(sortCallbacks[sortMode]);
        }
    }
}

export { Layer };
