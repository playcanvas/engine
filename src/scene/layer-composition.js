import { EventHandler } from '../core/event-handler.js';

import {
    LAYERID_DEPTH,
    BLEND_NONE,
    COMPUPDATED_BLEND, COMPUPDATED_CAMERAS, COMPUPDATED_INSTANCES, COMPUPDATED_LIGHTS,
    LIGHTTYPE_DIRECTIONAL, LIGHTTYPE_OMNI, LIGHTTYPE_SPOT
} from './constants.js';

import { RenderAction } from './render-action.js';

/**
 * @class
 * @name LayerComposition
 * @augments EventHandler
 * @classdesc Layer Composition is a collection of {@link Layer} that is fed to {@link Scene#layers} to define rendering order.
 * @description Create a new layer composition.
 * @param {string} [name] - Optional non-unique name of the layer composition. Defaults to "Untitled" if not specified.
 * @property {Layer[]} layerList A read-only array of {@link Layer} sorted in the order they will be rendered.
 * @property {boolean[]} subLayerList A read-only array of boolean values, matching {@link Layer#layerList}.
 * True means only semi-transparent objects are rendered, and false means opaque.
 * @property {boolean[]} subLayerEnabled A read-only array of boolean values, matching {@link Layer#layerList}.
 * True means the layer is rendered, false means it's skipped.
 * @property {CameraComponent[]} cameras A read-only array of {@link CameraComponent} that can be used during rendering. e.g. Inside
 * {@link Layer#onPreCull}, {@link Layer#onPostCull}, {@link Layer#onPreRender}, {@link Layer#onPostRender}.
 */
// Composition can hold only 2 sublayers of each layer
class LayerComposition extends EventHandler {
    constructor(name = "Untitled") {
        super();

        this.name = name;

        // enable logging
        this.logRenderActions = false;

        // all layers added into the composition
        this.layerList = [];

        this.subLayerList = [];
        this.subLayerEnabled = []; // more granular control on top of layer.enabled (ANDed)
        this._opaqueOrder = {};
        this._transparentOrder = {};

        this._dirty = false;
        this._dirtyBlend = false;
        this._dirtyLights = false;
        this._dirtyCameras = false;

        // all unique meshInstances from all layers, stored both as an array, and also a set for fast search
        this._meshInstances = [];
        this._meshInstancesSet = new Set();

        // all unique lights from all layers, stored both as an array, and also map for fast search (key is light, values is its index in _lights array)
        this._lights = [];
        this._lightsMap = new Map();

        // each light in _lights has entry here at the same index, storing an array and also a set of shadow casters for it
        this._lightShadowCasters = [];
        this._lightShadowCastersSets = [];

        // _lights split into arrays per type of light, indexed by LIGHTTYPE_*** constants
        this._splitLights = [[], [], []];

        // for each directional light (in _splitLights[LIGHTTYPE_DIRECTIONAL]), this stores array of unique cameras that are on the same layer as the light
        this._globalLightCameras = [];

        // array of unique cameras from all layers (CameraComponent type)
        this.cameras = [];


        this._globalLightCameraIds = []; // array mapping _globalLights to camera ids in composition

        // the actual rendering sequence, generated based on layers and cameras
        this._renderActions = [];
    }

    // function which splits list of lights on a a target object into separate lists of lights based on light type
    _splitLightsArray(target) {
        var light;
        var lights = target._lights;
        target._splitLights[LIGHTTYPE_DIRECTIONAL].length = 0;
        target._splitLights[LIGHTTYPE_OMNI].length = 0;
        target._splitLights[LIGHTTYPE_SPOT].length = 0;

        for (var i = 0; i < lights.length; i++) {
            light = lights[i];
            if (light.enabled) {
                target._splitLights[light._type].push(light);
            }
        }
    }

    _update() {
        var i, j, k, l;
        var layer;
        var len = this.layerList.length;
        var result = 0;

        // if composition dirty flags are not set, test if layers are marked dirty
        if (!this._dirty || !this._dirtyLights || !this._dirtyCameras) {
            for (i = 0; i < len; i++) {
                layer = this.layerList[i];
                if (layer._dirty) {
                    this._dirty = true;
                }
                if (layer._dirtyLights) {
                    this._dirtyLights = true;
                }
                if (layer._dirtyCameras) {
                    this._dirtyCameras = true;
                }
            }
        }

        // function adds unique meshInstances from src array into destArray. A destSet is a Set containing already
        // existing meshInstances  to accelerate the removal of duplicates
        // returns true if any of the materials on these meshInstances has _dirtyBlend set
        function addUniqueMeshInstance(destArray, destSet, srcArray) {
            var meshInst, material, dirtyBlend = false;
            var srcLen = srcArray.length;
            for (var s = 0; s < srcLen; s++) {
                meshInst = srcArray[s];

                if (!destSet.has(meshInst)) {
                    destSet.add(meshInst);
                    destArray.push(meshInst);

                    material = meshInst.material;
                    if (material && material._dirtyBlend) {
                        dirtyBlend = true;
                        material._dirtyBlend = false;
                    }
                }
            }
            return dirtyBlend;
        }

        // rebuild this._meshInstances array - add all unique meshInstances from all layers to it
        // also set this._dirtyBlend to true if material of any meshInstance has _dirtyBlend set, and clear those flags on materials
        if (this._dirty) {
            result |= COMPUPDATED_INSTANCES;
            this._meshInstances.length = 0;
            this._meshInstancesSet.clear();

            for (i = 0; i < len; i++) {
                layer = this.layerList[i];
                if (!layer.passThrough) {

                    // add meshInstances from both opaque and transparent lists
                    this._dirtyBlend = addUniqueMeshInstance(this._meshInstances, this._meshInstancesSet, layer.opaqueMeshInstances) || this._dirtyBlend;
                    this._dirtyBlend = addUniqueMeshInstance(this._meshInstances, this._meshInstancesSet, layer.transparentMeshInstances) || this._dirtyBlend;
                }

                layer._dirty = false;
                layer._version++;
            }

            this._dirty = false;
        }

        // funtion moves transparent or opaque meshes based on moveTransparent from src to dest array
        function moveByBlendType(dest, src, moveTransparent) {
            var material, isTransparent;
            for (var s = 0; s < src.length; ) {

                material = src[s].material;
                isTransparent = material && material.blendType !== BLEND_NONE;

                if (isTransparent === moveTransparent) {

                    // add it to dest
                    dest.push(src[s]);

                    // remove it from src
                    src[s] = src[src.length - 1];
                    src.length--;

                } else {

                    // just skip it
                    s++;
                }
            }
        }

        // for each layer, split its meshInstances to either opaque or transparent array based on material blend type
        if (this._dirtyBlend) {
            result |= COMPUPDATED_BLEND;

            for (i = 0; i < len; i++) {
                layer = this.layerList[i];
                if (!layer.passThrough) {

                    // move any opaque meshInstances from transparentMeshInstances to opaqueMeshInstances
                    moveByBlendType(layer.opaqueMeshInstances, layer.transparentMeshInstances, false);

                    // move any transparent meshInstances from opaqueMeshInstances to transparentMeshInstances
                    moveByBlendType(layer.transparentMeshInstances, layer.opaqueMeshInstances, true);
                }
            }
            this._dirtyBlend = false;
        }

        var light, lights;
        if (this._dirtyLights) {
            result |= COMPUPDATED_LIGHTS;

            // build a list and map of all unique lights from all layers
            this._lights.length = 0;
            this._lightsMap.clear();

            // create a list of all unique lights from all layers
            for (i = 0; i < len; i++) {
                layer = this.layerList[i];
                lights = layer._lights;
                for (j = 0; j < lights.length; j++) {
                    light = lights[j];

                    // add new light
                    if (!this._lightsMap.has(light)) {

                        this._lightsMap.set(light, this._lights.length);
                        this._lights.push(light);
                    }
                }
            }

            // adjust _lightShadowCasters to the right size, matching number of lights, and clean it up (minimize allocations)
            var lightCount = this._lights.length;
            this._lightShadowCasters.length = lightCount;
            this._lightShadowCastersSets.length = lightCount;
            for (i = 0; i < lightCount; i++) {

                // clear array
                if (this._lightShadowCasters[i]) {
                    this._lightShadowCasters[i].length = 0;
                } else {
                    this._lightShadowCasters[i] = [];
                }

                // clear set
                if (this._lightShadowCastersSets[i]) {
                    this._lightShadowCastersSets[i].clear();
                } else {
                    this._lightShadowCastersSets[i] = new Set();
                }
            }

            // split global lights list by type
            this._splitLightsArray(this);
            this._dirtyLights = false;

            // split layer lights lists by type
            for (i = 0; i < len; i++) {
                layer = this.layerList[i];
                this._splitLightsArray(layer);
                layer._dirtyLights = false;
            }
        }

        // if meshes OR lights changed, rebuild shadow casters
        var casters, castersSet;
        var meshInstances, meshInstance;
        var lightIndex;
        if (result) {

            // start with empty shadow casters
            for (i = 0; i < this._lightShadowCasters.length; i++) {
                this._lightShadowCasters[i].length = 0;
                this._lightShadowCastersSets[i].clear();
            }

            // for each layer
            for (i = 0; i < len; i++) {
                layer = this.layerList[i];
                lights = layer._lights;

                // for each light of a layer
                for (j = 0; j < lights.length; j++) {

                    // find its index in global light list, and get shadow casters for it
                    lightIndex = this._lightsMap.get(lights[j]);
                    casters = this._lightShadowCasters[lightIndex];
                    castersSet = this._lightShadowCastersSets[lightIndex];

                    // add unique meshes from the layer to casters
                    meshInstances = layer.shadowCasters;
                    for (k = 0; k < meshInstances.length; k++) {

                        meshInstance = meshInstances[k];

                        if (!castersSet.has(meshInstance)) {
                            castersSet.add(meshInstance);
                            casters.push(meshInstance);
                        }
                    }
                }
            }
        }

        // rebuild _globalLightCameras - list of cameras for each directional light
        if ((result & COMPUPDATED_LIGHTS) || this._dirtyCameras) {

            // TODO: make dirty when changing layer.enabled on/off
            this._globalLightCameras.length = 0;
            var globalLights = this._splitLights[LIGHTTYPE_DIRECTIONAL];

            for (l = 0; l < globalLights.length; l++) {
                light = globalLights[l];
                this._globalLightCameras[l] = [];

                for (i = 0; i < len; i++) {
                    layer = this.layerList[i];
                    if (layer._splitLights[LIGHTTYPE_DIRECTIONAL].indexOf(light) >= 0) {

                        for (k = 0; k < layer.cameras.length; k++) {
                            if (this._globalLightCameras[l].indexOf(layer.cameras[k]) < 0) {
                                this._globalLightCameras[l].push(layer.cameras[k]);
                            }
                        }
                    }
                }
            }
        }

        // function adds new render action to a list, while trying to limit allocation and reuse already allocated objects
        var renderActionCount = 0;
        var renderActions = this._renderActions;
        function addRenderAction(layer, layerIndex, cameraIndex, cameraFirstRenderAction, postProcessMarked) {

            // try and reuse object, otherwise allocate new
            var renderAction = renderActions[renderActionCount];
            if (!renderAction) {
                renderAction = renderActions[renderActionCount] = new RenderAction();
            }

            // render target from the camera takes precedence over the render target from the layer
            var rt = layer.renderTarget;
            var camera = layer.cameras[cameraIndex];
            if (camera && camera.renderTarget) {
                if (layer.id !== LAYERID_DEPTH) {   // ignore depth layer
                    rt = camera.renderTarget;
                }
            }

            // clear flags - use camera clear flags in the first render action for each camera, other render actions don't clear
            let clearColor = cameraFirstRenderAction ? camera.clearColorBuffer : false;
            let clearDepth = cameraFirstRenderAction ? camera.clearDepthBuffer : false;
            let clearStencil = cameraFirstRenderAction ? camera.clearStencilBuffer : false;

            // clear buffers if requested by the layer
            clearColor |= layer.clearColorBuffer;
            clearDepth |= layer.clearDepthBuffer;
            clearStencil |= layer.clearStencilBuffer;

            // for cameras with post processing enabled, on layers after post processing has been applied already (so UI and similar),
            // don't render them to render target anymore
            if (postProcessMarked && camera.postEffectsEnabled) {
                rt = null;
            }

            // store the properties - write all as we reuse previously allocated class instances
            renderAction.triggerPostprocess = false;
            renderAction.layerIndex = layerIndex;
            renderAction.cameraIndex = cameraIndex;
            renderAction.renderTarget = rt;
            renderAction.clearColor = clearColor;
            renderAction.clearDepth = clearDepth;
            renderAction.clearStencil = clearStencil;
            renderAction.firstCameraUse = cameraFirstRenderAction;
            renderActionCount++;

            return renderAction;
        }

        var camera, index, cameraIndex;
        if (this._dirtyCameras) {

            this._dirtyCameras = false;
            result |= COMPUPDATED_CAMERAS;

            // walk the layers and build an array of unique cameras from all layers
            this.cameras.length = 0;
            for (i = 0; i < len; i++) {
                layer = this.layerList[i];
                layer._dirtyCameras = false;

                // for all cameras in the layer
                for (j = 0; j < layer.cameras.length; j++) {
                    camera = layer.cameras[j];
                    index = this.cameras.indexOf(camera);
                    if (index < 0) {
                        this.cameras.push(camera);
                    }
                }
            }

            // sort cameras by priority
            if (this.cameras.length > 1) {
                this.cameras.sort((a, b) => a.priority - b.priority);
            }

            // render in order of cameras sorted by priority
            for (i = 0; i < this.cameras.length; i++) {
                camera = this.cameras[i];

                // first render action for this camera
                let cameraFirstRenderAction = true;
                let cameraFirstRenderActionIndex = renderActionCount;

                // last render action for the camera
                let lastRenderAction = null;

                // true if post processing stop layer was found for the camera
                let postProcessMarked = false;

                // walk all global sorted list of layers (sublayers) to check if camera renders it
                // this adds both opaque and transparent sublayers if camera renders the layer
                for (j = 0; j < len; j++) {

                    layer = this.layerList[j];
                    if (layer) {

                        // if layer needs to be rendered
                        if (layer.cameras.length > 0) {

                            // if the camera renders this layer
                            if (camera.layers.indexOf(layer.id) >= 0) {

                                // if this layer is the stop layer for postprocessing
                                if (layer.id === camera.disablePostEffectsLayer) {
                                    postProcessMarked = true;

                                    // the previously added render action is the last post-processed layer
                                    if (lastRenderAction) {

                                        // mark it to trigger postprocessing callback
                                        lastRenderAction.triggerPostprocess = true;
                                    }
                                }

                                // camera index in the layer array
                                cameraIndex = layer.cameras.indexOf(camera);
                                if (cameraIndex >= 0) {

                                    // add render action to describe rendering step
                                    lastRenderAction = addRenderAction(layer, j, cameraIndex, cameraFirstRenderAction, postProcessMarked);
                                    cameraFirstRenderAction = false;
                                }
                            }
                        }
                    }
                }

                // if no render action for this camera was marked for end of posprocessing, mark last one
                if (!postProcessMarked && lastRenderAction) {
                    lastRenderAction.triggerPostprocess = true;
                }

                // handle camera stacking if this render action has postprocessing enabled
                if (camera.renderTarget && camera.postEffectsEnabled) {
                    // process previous render actions starting with previous camera
                    this.propagateRenderTarget(cameraFirstRenderActionIndex - 1, camera.renderTarget);
                }
            }

            this._renderActions.length = renderActionCount;

            this._logRenderActions();
        }

        var arr;
        if ((result & COMPUPDATED_LIGHTS) || (result & COMPUPDATED_CAMERAS)) {
            // cameras/lights changed
            this._globalLightCameraIds.length = 0;
            for (l = 0; l < this._globalLightCameras.length; l++) {
                arr = [];
                for (i = 0; i < this._globalLightCameras[l].length; i++) {
                    index = this.cameras.indexOf( this._globalLightCameras[l][i] );
                    if (index < 0) {
                        // #ifdef DEBUG
                        console.warn("Can't find _globalLightCameras[l][i] in cameras");
                        // #endif
                        continue;
                    }
                    arr.push(index);
                }
                this._globalLightCameraIds.push(arr);
            }
        }

        return result;
    }

    // executes when post-processing camera's render actions were created to propage rendering to
    // render targets to previous camera as needed
    propagateRenderTarget(startIndex, renderTarget) {
        for (let a = startIndex; a >= 0; a--) {

            let ra = this._renderActions[a];
            const layer = this.layerList[ra.layerIndex];

            // if we hit render action with a render target (other than depth layer), that marks the end of camera stack
            // TODO: refactor this as part of depth layer refactoring
            if (ra.renderTarget && layer.id !== LAYERID_DEPTH) {
                break;
            }

            // skip over depth layer
            if (layer.id === LAYERID_DEPTH) {
                continue;
            }

            // render it to render target
            ra.renderTarget = renderTarget;
        }
    }

    // logs render action and their properties
    _logRenderActions() {

        // #ifdef DEBUG
        if (this.logRenderActions) {
            console.log("Render Actions for composition: " + this.name);
            for (let i = 0; i < this._renderActions.length; i++) {
                const ra = this._renderActions[i];
                const layerIndex = ra.layerIndex;
                const layer = this.layerList[layerIndex];
                const enabled = layer.enabled && this.subLayerEnabled[layerIndex];
                const transparent = this.subLayerList[layerIndex];
                const camera = layer.cameras[ra.cameraIndex];
                const clear = (ra.clearColor ? "Color " : "..... ") + (ra.clearDepth ? "Depth " : "..... ") + (ra.clearStencil ? "Stencil" : ".......");

                console.log(i +
                    (" Cam: " + (camera ? camera.entity.name : "-")).padEnd(22, " ") +
                    (" Lay: " + layer.name).padEnd(22, " ") +
                    (transparent ? " TRANSP" : " OPAQUE") +
                    (enabled ? " ENABLED " : " DISABLED") +
                    " Meshes: ", (transparent ? layer.transparentMeshInstances.length : layer.opaqueMeshInstances.length) +
                    (" RT: " + (ra.renderTarget ? ra.renderTarget.name : "-")).padEnd(30, " ") +
                    " Clear: " + clear +
                    (ra.firstCameraUse ? " CAM-FIRST" : "") +
                    (ra.triggerPostprocess ? " POSTPROCESS" : ""));
            }
        }
        // #endif
    }

    _isLayerAdded(layer) {
        if (this.layerList.indexOf(layer) >= 0) {
            // #ifdef DEBUG
            console.error("Layer is already added.");
            // #endif
            return true;
        }
        return false;
    }

    _isSublayerAdded(layer, transparent) {
        for (var i = 0; i < this.layerList.length; i++) {
            if (this.layerList[i] === layer && this.subLayerList[i] === transparent) {
                // #ifdef DEBUG
                console.error("Sublayer is already added.");
                // #endif
                return true;
            }
        }
        return false;
    }

    // Whole layer API

    /**
     * @function
     * @name LayerComposition#push
     * @description Adds a layer (both opaque and semi-transparent parts) to the end of the {@link Layer#layerList}.
     * @param {Layer} layer - A {@link Layer} to add.
     */
    push(layer) {
        // add both opaque and transparent to the end of the array
        if (this._isLayerAdded(layer)) return;
        this.layerList.push(layer);
        this.layerList.push(layer);
        this._opaqueOrder[layer.id] = this.subLayerList.push(false) - 1;
        this._transparentOrder[layer.id] = this.subLayerList.push(true) - 1;
        this.subLayerEnabled.push(true);
        this.subLayerEnabled.push(true);
        this._dirty = true;
        this._dirtyLights = true;
        this._dirtyCameras = true;
        this.fire("add", layer);
    }

    /**
     * @function
     * @name LayerComposition#insert
     * @description Inserts a layer (both opaque and semi-transparent parts) at the chosen index in the {@link Layer#layerList}.
     * @param {Layer} layer - A {@link Layer} to add.
     * @param {number} index - Insertion position.
     */
    insert(layer, index) {
        // insert both opaque and transparent at the index
        if (this._isLayerAdded(layer)) return;
        this.layerList.splice(index, 0,    layer,  layer);
        this.subLayerList.splice(index, 0, false,  true);

        var count = this.layerList.length;
        this._updateOpaqueOrder(index, count - 1);
        this._updateTransparentOrder(index, count - 1);
        this.subLayerEnabled.splice(index, 0, true,  true);
        this._dirty = true;
        this._dirtyLights = true;
        this._dirtyCameras = true;
        this.fire("add", layer);
    }

    /**
     * @function
     * @name LayerComposition#remove
     * @description Removes a layer (both opaque and semi-transparent parts) from {@link Layer#layerList}.
     * @param {Layer} layer - A {@link Layer} to remove.
     */
    remove(layer) {
        // remove all occurrences of a layer
        var id = this.layerList.indexOf(layer);

        delete this._opaqueOrder[id];
        delete this._transparentOrder[id];

        while (id >= 0) {
            this.layerList.splice(id, 1);
            this.subLayerList.splice(id, 1);
            this.subLayerEnabled.splice(id, 1);
            id = this.layerList.indexOf(layer);
            this._dirty = true;
            this._dirtyLights = true;
            this._dirtyCameras = true;
            this.fire("remove", layer);
        }

        // update both orders
        var count = this.layerList.length;
        this._updateOpaqueOrder(0, count - 1);
        this._updateTransparentOrder(0, count - 1);
    }

    // Sublayer API

    /**
     * @function
     * @name LayerComposition#pushOpaque
     * @description Adds part of the layer with opaque (non semi-transparent) objects to the end of the {@link Layer#layerList}.
     * @param {Layer} layer - A {@link Layer} to add.
     */
    pushOpaque(layer) {
        // add opaque to the end of the array
        if (this._isSublayerAdded(layer, false)) return;
        this.layerList.push(layer);
        this._opaqueOrder[layer.id] = this.subLayerList.push(false) - 1;
        this.subLayerEnabled.push(true);
        this._dirty = true;
        this._dirtyLights = true;
        this._dirtyCameras = true;
        this.fire("add", layer);
    }

    /**
     * @function
     * @name LayerComposition#insertOpaque
     * @description Inserts an opaque part of the layer (non semi-transparent mesh instances) at the chosen index in the {@link Layer#layerList}.
     * @param {Layer} layer - A {@link Layer} to add.
     * @param {number} index - Insertion position.
     */
    insertOpaque(layer, index) {
        // insert opaque at index
        if (this._isSublayerAdded(layer, false)) return;
        this.layerList.splice(index, 0,    layer);
        this.subLayerList.splice(index, 0, false);

        var count = this.subLayerList.length;
        this._updateOpaqueOrder(index, count - 1);

        this.subLayerEnabled.splice(index, 0, true);
        this._dirty = true;
        this._dirtyLights = true;
        this._dirtyCameras = true;
        this.fire("add", layer);
    }

    /**
     * @function
     * @name LayerComposition#removeOpaque
     * @description Removes an opaque part of the layer (non semi-transparent mesh instances) from {@link Layer#layerList}.
     * @param {Layer} layer - A {@link Layer} to remove.
     */
    removeOpaque(layer) {
        // remove opaque occurrences of a layer
        for (var i = 0, len = this.layerList.length; i < len; i++) {
            if (this.layerList[i] === layer && !this.subLayerList[i]) {
                this.layerList.splice(i, 1);
                this.subLayerList.splice(i, 1);

                len--;
                this._updateOpaqueOrder(i, len - 1);

                this.subLayerEnabled.splice(i, 1);
                this._dirty = true;
                this._dirtyLights = true;
                this._dirtyCameras = true;
                if (this.layerList.indexOf(layer) < 0) {
                    this.fire("remove", layer); // no sublayers left
                }
                return;
            }
        }
    }

    /**
     * @function
     * @name LayerComposition#pushTransparent
     * @description Adds part of the layer with semi-transparent objects to the end of the {@link Layer#layerList}.
     * @param {Layer} layer - A {@link Layer} to add.
     */
    pushTransparent(layer) {
        // add transparent to the end of the array
        if (this._isSublayerAdded(layer, true)) return;
        this.layerList.push(layer);
        this._transparentOrder[layer.id] = this.subLayerList.push(true) - 1;
        this.subLayerEnabled.push(true);
        this._dirty = true;
        this._dirtyLights = true;
        this._dirtyCameras = true;
        this.fire("add", layer);
    }

    /**
     * @function
     * @name LayerComposition#insertTransparent
     * @description Inserts a semi-transparent part of the layer at the chosen index in the {@link Layer#layerList}.
     * @param {Layer} layer - A {@link Layer} to add.
     * @param {number} index - Insertion position.
     */
    insertTransparent(layer, index) {
        // insert transparent at index
        if (this._isSublayerAdded(layer, true)) return;
        this.layerList.splice(index, 0,    layer);
        this.subLayerList.splice(index, 0, true);

        var count = this.subLayerList.length;
        this._updateTransparentOrder(index, count - 1);

        this.subLayerEnabled.splice(index, 0, true);
        this._dirty = true;
        this._dirtyLights = true;
        this._dirtyCameras = true;
        this.fire("add", layer);
    }

    /**
     * @function
     * @name LayerComposition#removeTransparent
     * @description Removes a transparent part of the layer from {@link Layer#layerList}.
     * @param {Layer} layer - A {@link Layer} to remove.
     */
    removeTransparent(layer) {
        // remove transparent occurrences of a layer
        for (var i = 0, len = this.layerList.length; i < len; i++) {
            if (this.layerList[i] === layer && this.subLayerList[i]) {
                this.layerList.splice(i, 1);
                this.subLayerList.splice(i, 1);

                len--;
                this._updateTransparentOrder(i, len - 1);

                this.subLayerEnabled.splice(i, 1);
                this._dirty = true;
                this._dirtyLights = true;
                this._dirtyCameras = true;
                if (this.layerList.indexOf(layer) < 0) {
                    this.fire("remove", layer); // no sublayers left
                }
                return;
            }
        }
    }

    _getSublayerIndex(layer, transparent) {
        // find sublayer index in the composition array
        var id = this.layerList.indexOf(layer);
        if (id < 0) return -1;

        if (this.subLayerList[id] !== transparent) {
            id = this.layerList.indexOf(layer, id + 1);
            if (id < 0) return -1;
            if (this.subLayerList[id] !== transparent) {
                return -1;
            }
        }
        return id;
    }

    /**
     * @function
     * @name LayerComposition#getOpaqueIndex
     * @description Gets index of the opaque part of the supplied layer in the {@link Layer#layerList}.
     * @param {Layer} layer - A {@link Layer} to find index of.
     * @returns {number} The index of the opaque part of the specified layer.
     */
    getOpaqueIndex(layer) {
        return this._getSublayerIndex(layer, false);
    }

    /**
     * @function
     * @name LayerComposition#getTransparentIndex
     * @description Gets index of the semi-transparent part of the supplied layer in the {@link Layer#layerList}.
     * @param {Layer} layer - A {@link Layer} to find index of.
     * @returns {number} The index of the semi-transparent part of the specified layer.
     */
    getTransparentIndex(layer) {
        return this._getSublayerIndex(layer, true);
    }

    /**
     * @function
     * @name LayerComposition#getLayerById
     * @description Finds a layer inside this composition by its ID. Null is returned, if nothing is found.
     * @param {number} id - An ID of the layer to find.
     * @returns {Layer} The layer corresponding to the specified ID. Returns null if layer is not found.
     */
    getLayerById(id) {
        for (var i = 0; i < this.layerList.length; i++) {
            if (this.layerList[i].id === id) return this.layerList[i];
        }
        return null;
    }

    /**
     * @function
     * @name LayerComposition#getLayerByName
     * @description Finds a layer inside this composition by its name. Null is returned, if nothing is found.
     * @param {string} name - The name of the layer to find.
     * @returns {Layer} The layer corresponding to the specified name. Returns null if layer is not found.
     */
    getLayerByName(name) {
        for (var i = 0; i < this.layerList.length; i++) {
            if (this.layerList[i].name === name) return this.layerList[i];
        }
        return null;
    }

    _updateOpaqueOrder(startIndex, endIndex) {
        for (var i = startIndex; i <= endIndex; i++) {
            if (this.subLayerList[i] === false) {
                this._opaqueOrder[this.layerList[i].id] = i;
            }
        }
    }

    _updateTransparentOrder(startIndex, endIndex) {
        for (var i = startIndex; i <= endIndex; i++) {
            if (this.subLayerList[i] === true) {
                this._transparentOrder[this.layerList[i].id] = i;
            }
        }
    }

    // Used to determine which array of layers has any sublayer that is
    // on top of all the sublayers in the other array. The order is a dictionary
    // of <layerId, index>.
    _sortLayersDescending(layersA, layersB, order) {
        var i = 0;
        var len = 0;
        var id = 0;
        var topLayerA = -1;
        var topLayerB = -1;

        // search for which layer is on top in layersA
        for (i = 0, len = layersA.length; i < len; i++) {
            id = layersA[i];
            if (order.hasOwnProperty(id)) {
                topLayerA = Math.max(topLayerA, order[id]);
            }
        }

        // search for which layer is on top in layersB
        for (i = 0, len = layersB.length; i < len; i++) {
            id = layersB[i];
            if (order.hasOwnProperty(id)) {
                topLayerB = Math.max(topLayerB, order[id]);
            }
        }

        // if the layers of layersA or layersB do not exist at all
        // in the composition then return early with the other.
        if (topLayerA === -1 && topLayerB !== -1) {
            return 1;
        } else if (topLayerB === -1 && topLayerA !== -1) {
            return -1;
        }

        // sort in descending order since we want
        // the higher order to be first
        return topLayerB - topLayerA;
    }

    /**
     * @private
     * @function
     * @name LayerComposition#sortTransparentLayers
     * @description Used to determine which array of layers has any transparent sublayer that is on top of all the transparent sublayers in the other array.
     * @param {number[]} layersA - IDs of layers.
     * @param {number[]} layersB - IDs of layers.
     * @returns {number} Returns a negative number if any of the transparent sublayers in layersA is on top of all the transparent sublayers in layersB,
     * or a positive number if any of the transparent sublayers in layersB is on top of all the transparent sublayers in layersA, or 0 otherwise.
     */
    sortTransparentLayers(layersA, layersB) {
        return this._sortLayersDescending(layersA, layersB, this._transparentOrder);
    }

    /**
     * @private
     * @function
     * @name LayerComposition#sortOpaqueLayers
     * @description Used to determine which array of layers has any opaque sublayer that is on top of all the opaque sublayers in the other array.
     * @param {number[]} layersA - IDs of layers.
     * @param {number[]} layersB - IDs of layers.
     * @returns {number} Returns a negative number if any of the opaque sublayers in layersA is on top of all the opaque sublayers in layersB,
     * or a positive number if any of the opaque sublayers in layersB is on top of all the opaque sublayers in layersA, or 0 otherwise.
     */
    sortOpaqueLayers(layersA, layersB) {
        return this._sortLayersDescending(layersA, layersB, this._opaqueOrder);
    }
}

export { LayerComposition };
