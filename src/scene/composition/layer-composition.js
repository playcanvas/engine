import { TRACEID_RENDER_ACTION } from '../../core/constants.js';
import { Debug } from '../../core/debug.js';
import { Tracing } from '../../core/tracing.js';
import { EventHandler } from '../../core/event-handler.js';
import { set } from '../../core/set-utils.js';
import { sortPriority } from '../../core/sort.js';

import {
    LAYERID_DEPTH,
    COMPUPDATED_CAMERAS, COMPUPDATED_LIGHTS,
    LIGHTTYPE_DIRECTIONAL, LIGHTTYPE_OMNI, LIGHTTYPE_SPOT
} from '../constants.js';

import { RenderAction } from './render-action.js';
import { WorldClusters } from '../lighting/world-clusters.js';

const tempSet = new Set();
const tempClusterArray = [];

/**
 * Layer Composition is a collection of {@link Layer} that is fed to {@link Scene#layers} to define
 * rendering order.
 *
 * @augments EventHandler
 * @category Graphics
 */
class LayerComposition extends EventHandler {
    // Composition can hold only 2 sublayers of each layer

    /**
     * A read-only array of {@link Layer} sorted in the order they will be rendered.
     *
     * @type {import('../layer.js').Layer[]}
     */
    layerList = [];

    /**
     * A mapping of {@link Layer#id} to {@link Layer}.
     *
     * @type {Map<number, import('../layer.js').Layer>}
     * @ignore
     */
    layerIdMap = new Map();

    /**
     * A mapping of {@link Layer#name} to {@link Layer}.
     *
     * @type {Map<string, import('../layer.js').Layer>}
     * @ignore
     */
    layerNameMap = new Map();

    /**
     * A read-only array of boolean values, matching {@link LayerComposition#layerList}. True means only
     * semi-transparent objects are rendered, and false means opaque.
     *
     * @type {boolean[]}
     * @ignore
     */
    subLayerList = [];

    /**
     * A read-only array of boolean values, matching {@link LayerComposition#layerList}. True means the
     * layer is rendered, false means it's skipped.
     *
     * @type {boolean[]}
     */
    subLayerEnabled = []; // more granular control on top of layer.enabled (ANDed)

    /**
     * A read-only array of {@link CameraComponent} that can be used during rendering. e.g.
     * Inside {@link Layer#onPreCull}, {@link Layer#onPostCull}, {@link Layer#onPreRender},
     * {@link Layer#onPostRender}.
     *
     * @type {import('../../framework/components/camera/component.js').CameraComponent[]}
     */
    cameras = [];

    /**
     * The actual rendering sequence, generated based on layers and cameras
     *
     * @type {RenderAction[]}
     * @ignore
     */
    _renderActions = [];

    /**
     * Create a new layer composition.
     *
     * @param {string} [name] - Optional non-unique name of the layer composition. Defaults to
     * "Untitled" if not specified.
     */
    constructor(name = 'Untitled') {
        super();

        this.name = name;

        this._opaqueOrder = {};
        this._transparentOrder = {};

        this._dirtyLights = false;
        this._dirtyCameras = false;

        // an array of all unique lights from all layers
        this._lights = [];

        // a map of Light to index in _lights for fast lookup
        this._lightsMap = new Map();

        // _lights split into arrays per type of light, indexed by LIGHTTYPE_*** constants
        this._splitLights = [[], [], []];

        // all currently created light clusters, that need to be updated before rendering
        this._worldClusters = [];

        // empty cluster with no lights
        this._emptyWorldClusters = null;
    }

    destroy() {
        // empty light cluster
        if (this._emptyWorldClusters) {
            this._emptyWorldClusters.destroy();
            this._emptyWorldClusters = null;
        }

        // all other clusters
        this._worldClusters.forEach((cluster) => {
            cluster.destroy();
        });
        this._worldClusters = null;

        // render actions
        this._renderActions.forEach(ra => ra.destroy());
        this._renderActions = null;
    }

    // returns an empty light cluster object to be used when no lights are used
    getEmptyWorldClusters(device) {
        if (!this._emptyWorldClusters) {

            // create cluster structure with no lights
            this._emptyWorldClusters = new WorldClusters(device);
            this._emptyWorldClusters.name = 'ClusterEmpty';

            // update it once to avoid doing it each frame
            this._emptyWorldClusters.update([], false, null);
        }

        return this._emptyWorldClusters;
    }

    // function which splits list of lights on a a target object into separate lists of lights based on light type
    _splitLightsArray(target) {

        const splitLights = target._splitLights;
        splitLights[LIGHTTYPE_DIRECTIONAL].length = 0;
        splitLights[LIGHTTYPE_OMNI].length = 0;
        splitLights[LIGHTTYPE_SPOT].length = 0;

        const lights = target._lights;
        for (let i = 0; i < lights.length; i++) {
            const light = lights[i];
            if (light.enabled) {
                splitLights[light._type].push(light);
            }
        }

        // sort the lights by their key, as the order of lights is used to generate shader generation key,
        // and this avoids new shaders being generated when lights are reordered
        splitLights[LIGHTTYPE_DIRECTIONAL].sort((a, b) => a.key - b.key);
        splitLights[LIGHTTYPE_OMNI].sort((a, b) => a.key - b.key);
        splitLights[LIGHTTYPE_SPOT].sort((a, b) => a.key - b.key);
    }

    _update(device, clusteredLightingEnabled = false) {
        const len = this.layerList.length;
        let result = 0;

        // if composition dirty flags are not set, test if layers are marked dirty
        if (!this._dirtyLights || !this._dirtyCameras) {
            for (let i = 0; i < len; i++) {
                const layer = this.layerList[i];
                if (layer._dirtyLights) {
                    this._dirtyLights = true;
                }
                if (layer._dirtyCameras) {
                    this._dirtyCameras = true;
                }
            }
        }

        if (this._dirtyLights) {
            result |= COMPUPDATED_LIGHTS;
            this._dirtyLights = false;

            this.updateLights();
        }

        if (this._dirtyCameras || (result & COMPUPDATED_LIGHTS)) {

            this._dirtyCameras = false;
            result |= COMPUPDATED_CAMERAS;

            // walk the layers and build an array of unique cameras from all layers
            this.cameras.length = 0;
            for (let i = 0; i < len; i++) {
                const layer = this.layerList[i];
                layer._dirtyCameras = false;

                // for all cameras in the layer
                for (let j = 0; j < layer.cameras.length; j++) {
                    const camera = layer.cameras[j];
                    const index = this.cameras.indexOf(camera);
                    if (index < 0) {
                        this.cameras.push(camera);
                    }
                }
            }

            // sort cameras by priority
            if (this.cameras.length > 1) {
                sortPriority(this.cameras);
            }

            // collect a list of layers this camera renders
            const cameraLayers = [];

            // render in order of cameras sorted by priority
            let renderActionCount = 0;
            for (let i = 0; i < this.cameras.length; i++) {
                const camera = this.cameras[i];
                cameraLayers.length = 0;

                // first render action for this camera
                let cameraFirstRenderAction = true;
                const cameraFirstRenderActionIndex = renderActionCount;

                // last render action for the camera
                let lastRenderAction = null;

                // true if post processing stop layer was found for the camera
                let postProcessMarked = false;

                // walk all global sorted list of layers (sublayers) to check if camera renders it
                // this adds both opaque and transparent sublayers if camera renders the layer
                for (let j = 0; j < len; j++) {

                    const layer = this.layerList[j];
                    const isLayerEnabled = this.subLayerEnabled[j];
                    if (layer && isLayerEnabled) {

                        // if layer needs to be rendered
                        if (layer.cameras.length > 0) {

                            // if the camera renders this layer
                            if (camera.layers.indexOf(layer.id) >= 0) {

                                cameraLayers.push(layer);

                                // if this layer is the stop layer for postprocessing
                                if (!postProcessMarked && layer.id === camera.disablePostEffectsLayer) {
                                    postProcessMarked = true;

                                    // the previously added render action is the last post-processed layer
                                    if (lastRenderAction) {

                                        // mark it to trigger postprocessing callback
                                        lastRenderAction.triggerPostprocess = true;
                                    }
                                }

                                // camera index in the layer array
                                const cameraIndex = layer.cameras.indexOf(camera);
                                if (cameraIndex >= 0) {

                                    // add render action to describe rendering step
                                    lastRenderAction = this.addRenderAction(this._renderActions, renderActionCount, layer, j, cameraIndex,
                                                                            cameraFirstRenderAction, postProcessMarked);
                                    renderActionCount++;
                                    cameraFirstRenderAction = false;
                                }
                            }
                        }
                    }
                }

                // if the camera renders any layers.
                if (cameraFirstRenderActionIndex < renderActionCount) {
                    // based on all layers this camera renders, prepare a list of directional lights the camera needs to render shadow for
                    // and set these up on the first render action for the camera.
                    this._renderActions[cameraFirstRenderActionIndex].collectDirectionalLights(cameraLayers, this._splitLights[LIGHTTYPE_DIRECTIONAL], this._lights);

                    // mark the last render action as last one using the camera
                    lastRenderAction.lastCameraUse = true;
                }

                // if no render action for this camera was marked for end of postprocessing, mark last one
                if (!postProcessMarked && lastRenderAction) {
                    lastRenderAction.triggerPostprocess = true;
                }

                // handle camera stacking if this render action has postprocessing enabled
                if (camera.renderTarget && camera.postEffectsEnabled) {
                    // process previous render actions starting with previous camera
                    this.propagateRenderTarget(cameraFirstRenderActionIndex - 1, camera);
                }
            }

            // destroy unused render actions
            for (let i = renderActionCount; i < this._renderActions.length; i++) {
                this._renderActions[i].destroy();
            }
            this._renderActions.length = renderActionCount;
        }

        // allocate light clusters if lights or meshes or cameras are modified
        if (result & (COMPUPDATED_CAMERAS | COMPUPDATED_LIGHTS)) {

            // prepare clustered lighting for render actions
            if (clusteredLightingEnabled) {
                this.allocateLightClusters(device);
            }
        }

        if (result & (COMPUPDATED_LIGHTS | COMPUPDATED_LIGHTS)) {
            this._logRenderActions();
        }

        return result;
    }

    updateLights() {

        // build a list and map of all unique lights from all layers
        this._lights.length = 0;
        this._lightsMap.clear();

        const count = this.layerList.length;
        for (let i = 0; i < count; i++) {
            const layer = this.layerList[i];

            // layer can be in the list two times (opaque, transp), process it only one time
            if (!tempSet.has(layer)) {
                tempSet.add(layer);

                const lights = layer._lights;
                for (let j = 0; j < lights.length; j++) {
                    const light = lights[j];

                    // add new light
                    let lightIndex = this._lightsMap.get(light);
                    if (lightIndex === undefined) {
                        lightIndex = this._lights.length;
                        this._lightsMap.set(light, lightIndex);
                        this._lights.push(light);
                    }
                }
            }

            // split layer lights lists by type
            this._splitLightsArray(layer);
            layer._dirtyLights = false;
        }

        tempSet.clear();

        // split light list by type
        this._splitLightsArray(this);
    }

    // find existing light cluster that is compatible with specified layer
    findCompatibleCluster(layer, renderActionCount, emptyWorldClusters) {

        // check already set up render actions
        for (let i = 0; i < renderActionCount; i++) {
            const ra = this._renderActions[i];
            const raLayer = this.layerList[ra.layerIndex];

            // only reuse clusters if not empty
            if (ra.lightClusters !== emptyWorldClusters) {

                // if layer is the same (but different sublayer), cluster can be used directly as lights are the same
                if (layer === raLayer) {
                    return ra.lightClusters;
                }

                if (ra.lightClusters) {
                    // if the layer has exactly the same set of lights, use the same cluster
                    if (set.equals(layer._clusteredLightsSet, raLayer._clusteredLightsSet)) {
                        return ra.lightClusters;
                    }
                }
            }
        }

        // no match
        return null;
    }

    // assign light clusters to render actions that need it
    allocateLightClusters(device) {

        // reuse previously allocated clusters
        tempClusterArray.push(...this._worldClusters);

        // the cluster with no lights
        const emptyWorldClusters = this.getEmptyWorldClusters(device);

        // start with no clusters
        this._worldClusters.length = 0;

        // process all render actions
        const count = this._renderActions.length;
        for (let i = 0; i < count; i++) {
            const ra = this._renderActions[i];
            const layer = this.layerList[ra.layerIndex];

            ra.lightClusters = null;

            // if the layer has lights used by clusters
            if (layer.hasClusteredLights) {

                // and if the layer has meshes
                if (layer.meshInstances.length) {

                    // reuse cluster that was already set up and is compatible
                    let clusters = this.findCompatibleCluster(layer, i, emptyWorldClusters);
                    if (!clusters) {

                        // use already allocated cluster from before
                        if (tempClusterArray.length) {
                            clusters = tempClusterArray.pop();
                        }

                        // create new cluster
                        if (!clusters) {
                            clusters = new WorldClusters(device);
                        }

                        clusters.name = 'Cluster-' + this._worldClusters.length;
                        this._worldClusters.push(clusters);
                    }

                    ra.lightClusters = clusters;
                }
            }

            // no clustered lights, use the cluster with no lights
            if (!ra.lightClusters) {
                ra.lightClusters = emptyWorldClusters;
            }
        }

        // delete leftovers
        tempClusterArray.forEach((item) => {
            item.destroy();
        });
        tempClusterArray.length = 0;
    }

    // function adds new render action to a list, while trying to limit allocation and reuse already allocated objects
    addRenderAction(renderActions, renderActionIndex, layer, layerIndex, cameraIndex, cameraFirstRenderAction, postProcessMarked) {

        // try and reuse object, otherwise allocate new
        /** @type {RenderAction} */
        let renderAction = renderActions[renderActionIndex];
        if (!renderAction) {
            renderAction = renderActions[renderActionIndex] = new RenderAction();
        }

        // render target from the camera takes precedence over the render target from the layer
        let rt = layer.renderTarget;
        /** @type {import('../../framework/components/camera/component.js').CameraComponent} */
        const camera = layer.cameras[cameraIndex];
        if (camera && camera.renderTarget) {
            if (layer.id !== LAYERID_DEPTH) {   // ignore depth layer
                rt = camera.renderTarget;
            }
        }

        // was camera and render target combo used already
        let used = false;
        for (let i = renderActionIndex - 1; i >= 0; i--) {
            if (renderActions[i].camera === camera && renderActions[i].renderTarget === rt) {
                used = true;
                break;
            }
        }

        // clear flags - use camera clear flags in the first render action for each camera,
        // or when render target (from layer) was not yet cleared by this camera
        const needsClear = cameraFirstRenderAction || !used;
        let clearColor = needsClear ? camera.clearColorBuffer : false;
        let clearDepth = needsClear ? camera.clearDepthBuffer : false;
        let clearStencil = needsClear ? camera.clearStencilBuffer : false;

        // clear buffers if requested by the layer
        clearColor ||= layer.clearColorBuffer;
        clearDepth ||= layer.clearDepthBuffer;
        clearStencil ||= layer.clearStencilBuffer;

        // for cameras with post processing enabled, on layers after post processing has been applied already (so UI and similar),
        // don't render them to render target anymore
        if (postProcessMarked && camera.postEffectsEnabled) {
            rt = null;
        }

        // store the properties - write all as we reuse previously allocated class instances
        renderAction.reset();
        renderAction.triggerPostprocess = false;
        renderAction.layerIndex = layerIndex;
        renderAction.cameraIndex = cameraIndex;
        renderAction.camera = camera;
        renderAction.renderTarget = rt;
        renderAction.clearColor = clearColor;
        renderAction.clearDepth = clearDepth;
        renderAction.clearStencil = clearStencil;
        renderAction.firstCameraUse = cameraFirstRenderAction;
        renderAction.lastCameraUse = false;

        return renderAction;
    }

    // executes when post-processing camera's render actions were created to propagate rendering to
    // render targets to previous camera as needed
    propagateRenderTarget(startIndex, fromCamera) {

        for (let a = startIndex; a >= 0; a--) {

            const ra = this._renderActions[a];
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

            // camera stack ends when viewport or scissor of the camera changes
            const thisCamera = ra?.camera.camera;
            if (thisCamera) {
                if (!fromCamera.camera.rect.equals(thisCamera.rect) || !fromCamera.camera.scissorRect.equals(thisCamera.scissorRect)) {
                    break;
                }
            }

            // render it to render target
            ra.renderTarget = fromCamera.renderTarget;
        }
    }

    // logs render action and their properties
    _logRenderActions() {

        // #if _DEBUG
        if (Tracing.get(TRACEID_RENDER_ACTION)) {
            Debug.trace(TRACEID_RENDER_ACTION, 'Render Actions for composition: ' + this.name);
            for (let i = 0; i < this._renderActions.length; i++) {
                const ra = this._renderActions[i];
                const layerIndex = ra.layerIndex;
                const layer = this.layerList[layerIndex];
                const enabled = layer.enabled && this.subLayerEnabled[layerIndex];
                const transparent = this.subLayerList[layerIndex];
                const camera = layer.cameras[ra.cameraIndex];
                const dirLightCount = ra.directionalLights.length;
                const clear = (ra.clearColor ? 'Color ' : '..... ') + (ra.clearDepth ? 'Depth ' : '..... ') + (ra.clearStencil ? 'Stencil' : '.......');

                Debug.trace(TRACEID_RENDER_ACTION, i +
                    (' Cam: ' + (camera ? camera.entity.name : '-')).padEnd(22, ' ') +
                    (' Lay: ' + layer.name).padEnd(22, ' ') +
                    (transparent ? ' TRANSP' : ' OPAQUE') +
                    (enabled ? ' ENABLED ' : ' DISABLED') +
                    ' Meshes: ', ('?' + layer.meshInstances.length).padStart(5) +
                    (' RT: ' + (ra.renderTarget ? ra.renderTarget.name : '-')).padEnd(30, ' ') +
                    ' Clear: ' + clear +
                    ' Lights: (' + layer._clusteredLightsSet.size + '/' + layer._lightsSet.size + ')' +
                    ' ' + (ra.lightClusters !== this._emptyWorldClusters ? (ra.lightClusters.name) : '').padEnd(10, ' ') +
                    (ra.firstCameraUse ? ' CAM-FIRST' : '') +
                    (ra.lastCameraUse ? ' CAM-LAST' : '') +
                    (ra.triggerPostprocess ? ' POSTPROCESS' : '') +
                    (dirLightCount ? (' DirLights: ' + dirLightCount) : '')
                );
            }
        }
        // #endif
    }

    _isLayerAdded(layer) {
        const found = this.layerIdMap.get(layer.id) === layer;
        Debug.assert(!found, `Layer is already added: ${layer.name}`);
        return found;
    }

    _isSublayerAdded(layer, transparent) {
        for (let i = 0; i < this.layerList.length; i++) {
            if (this.layerList[i] === layer && this.subLayerList[i] === transparent) {
                Debug.error(`Sublayer ${layer.name}, transparent: ${transparent} is already added.`);
                return true;
            }
        }
        return false;
    }

    // Whole layer API

    /**
     * Adds a layer (both opaque and semi-transparent parts) to the end of the {@link LayerComposition#layerList}.
     *
     * @param {import('../layer.js').Layer} layer - A {@link Layer} to add.
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

        this._updateLayerMaps();
        this._dirtyLights = true;
        this._dirtyCameras = true;
        this.fire('add', layer);
    }

    /**
     * Inserts a layer (both opaque and semi-transparent parts) at the chosen index in the
     * {@link LayerComposition#layerList}.
     *
     * @param {import('../layer.js').Layer} layer - A {@link Layer} to add.
     * @param {number} index - Insertion position.
     */
    insert(layer, index) {
        // insert both opaque and transparent at the index
        if (this._isLayerAdded(layer)) return;
        this.layerList.splice(index, 0, layer, layer);
        this.subLayerList.splice(index, 0, false, true);

        const count = this.layerList.length;
        this._updateOpaqueOrder(index, count - 1);
        this._updateTransparentOrder(index, count - 1);
        this.subLayerEnabled.splice(index, 0, true, true);

        this._updateLayerMaps();
        this._dirtyLights = true;
        this._dirtyCameras = true;
        this.fire('add', layer);
    }

    /**
     * Removes a layer (both opaque and semi-transparent parts) from {@link LayerComposition#layerList}.
     *
     * @param {import('../layer.js').Layer} layer - A {@link Layer} to remove.
     */
    remove(layer) {
        // remove all occurrences of a layer
        let id = this.layerList.indexOf(layer);

        delete this._opaqueOrder[id];
        delete this._transparentOrder[id];

        while (id >= 0) {
            this.layerList.splice(id, 1);
            this.subLayerList.splice(id, 1);
            this.subLayerEnabled.splice(id, 1);
            id = this.layerList.indexOf(layer);
            this._dirtyLights = true;
            this._dirtyCameras = true;
            this.fire('remove', layer);
        }

        // update both orders
        const count = this.layerList.length;
        this._updateOpaqueOrder(0, count - 1);
        this._updateTransparentOrder(0, count - 1);
        this._updateLayerMaps();
    }

    // Sublayer API

    /**
     * Adds part of the layer with opaque (non semi-transparent) objects to the end of the
     * {@link LayerComposition#layerList}.
     *
     * @param {import('../layer.js').Layer} layer - A {@link Layer} to add.
     */
    pushOpaque(layer) {
        // add opaque to the end of the array
        if (this._isSublayerAdded(layer, false)) return;
        this.layerList.push(layer);
        this._opaqueOrder[layer.id] = this.subLayerList.push(false) - 1;
        this.subLayerEnabled.push(true);

        this._updateLayerMaps();
        this._dirtyLights = true;
        this._dirtyCameras = true;
        this.fire('add', layer);
    }

    /**
     * Inserts an opaque part of the layer (non semi-transparent mesh instances) at the chosen
     * index in the {@link LayerComposition#layerList}.
     *
     * @param {import('../layer.js').Layer} layer - A {@link Layer} to add.
     * @param {number} index - Insertion position.
     */
    insertOpaque(layer, index) {
        // insert opaque at index
        if (this._isSublayerAdded(layer, false)) return;
        this.layerList.splice(index, 0, layer);
        this.subLayerList.splice(index, 0, false);

        const count = this.subLayerList.length;
        this._updateOpaqueOrder(index, count - 1);

        this.subLayerEnabled.splice(index, 0, true);

        this._updateLayerMaps();
        this._dirtyLights = true;
        this._dirtyCameras = true;
        this.fire('add', layer);
    }

    /**
     * Removes an opaque part of the layer (non semi-transparent mesh instances) from
     * {@link LayerComposition#layerList}.
     *
     * @param {import('../layer.js').Layer} layer - A {@link Layer} to remove.
     */
    removeOpaque(layer) {
        // remove opaque occurrences of a layer
        for (let i = 0, len = this.layerList.length; i < len; i++) {
            if (this.layerList[i] === layer && !this.subLayerList[i]) {
                this.layerList.splice(i, 1);
                this.subLayerList.splice(i, 1);

                len--;
                this._updateOpaqueOrder(i, len - 1);

                this.subLayerEnabled.splice(i, 1);
                this._dirtyLights = true;
                this._dirtyCameras = true;
                if (this.layerList.indexOf(layer) < 0) {
                    this.fire('remove', layer); // no sublayers left
                }
                break;
            }
        }
        this._updateLayerMaps();
    }

    /**
     * Adds part of the layer with semi-transparent objects to the end of the {@link LayerComposition#layerList}.
     *
     * @param {import('../layer.js').Layer} layer - A {@link Layer} to add.
     */
    pushTransparent(layer) {
        // add transparent to the end of the array
        if (this._isSublayerAdded(layer, true)) return;
        this.layerList.push(layer);
        this._transparentOrder[layer.id] = this.subLayerList.push(true) - 1;
        this.subLayerEnabled.push(true);

        this._updateLayerMaps();
        this._dirtyLights = true;
        this._dirtyCameras = true;
        this.fire('add', layer);
    }

    /**
     * Inserts a semi-transparent part of the layer at the chosen index in the {@link LayerComposition#layerList}.
     *
     * @param {import('../layer.js').Layer} layer - A {@link Layer} to add.
     * @param {number} index - Insertion position.
     */
    insertTransparent(layer, index) {
        // insert transparent at index
        if (this._isSublayerAdded(layer, true)) return;
        this.layerList.splice(index, 0, layer);
        this.subLayerList.splice(index, 0, true);

        const count = this.subLayerList.length;
        this._updateTransparentOrder(index, count - 1);

        this.subLayerEnabled.splice(index, 0, true);

        this._updateLayerMaps();
        this._dirtyLights = true;
        this._dirtyCameras = true;
        this.fire('add', layer);
    }

    /**
     * Removes a transparent part of the layer from {@link LayerComposition#layerList}.
     *
     * @param {import('../layer.js').Layer} layer - A {@link Layer} to remove.
     */
    removeTransparent(layer) {
        // remove transparent occurrences of a layer
        for (let i = 0, len = this.layerList.length; i < len; i++) {
            if (this.layerList[i] === layer && this.subLayerList[i]) {
                this.layerList.splice(i, 1);
                this.subLayerList.splice(i, 1);

                len--;
                this._updateTransparentOrder(i, len - 1);

                this.subLayerEnabled.splice(i, 1);
                this._dirtyLights = true;
                this._dirtyCameras = true;
                if (this.layerList.indexOf(layer) < 0) {
                    this.fire('remove', layer); // no sublayers left
                }
                break;
            }
        }
        this._updateLayerMaps();
    }

    _getSublayerIndex(layer, transparent) {
        // find sublayer index in the composition array
        let id = this.layerList.indexOf(layer);
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
     * Gets index of the opaque part of the supplied layer in the {@link LayerComposition#layerList}.
     *
     * @param {import('../layer.js').Layer} layer - A {@link Layer} to find index of.
     * @returns {number} The index of the opaque part of the specified layer.
     */
    getOpaqueIndex(layer) {
        return this._getSublayerIndex(layer, false);
    }

    /**
     * Gets index of the semi-transparent part of the supplied layer in the {@link LayerComposition#layerList}.
     *
     * @param {import('../layer.js').Layer} layer - A {@link Layer} to find index of.
     * @returns {number} The index of the semi-transparent part of the specified layer.
     */
    getTransparentIndex(layer) {
        return this._getSublayerIndex(layer, true);
    }

    /**
     * Update maps of layer IDs and names to match the layer list.
     *
     * @private
     */
    _updateLayerMaps() {
        this.layerIdMap.clear();
        this.layerNameMap.clear();
        for (let i = 0; i < this.layerList.length; i++) {
            const layer = this.layerList[i];
            this.layerIdMap.set(layer.id, layer);
            this.layerNameMap.set(layer.name, layer);
        }
    }

    /**
     * Finds a layer inside this composition by its ID. Null is returned, if nothing is found.
     *
     * @param {number} id - An ID of the layer to find.
     * @returns {import('../layer.js').Layer|null} The layer corresponding to the specified ID.
     * Returns null if layer is not found.
     */
    getLayerById(id) {
        return this.layerIdMap.get(id) ?? null;
    }

    /**
     * Finds a layer inside this composition by its name. Null is returned, if nothing is found.
     *
     * @param {string} name - The name of the layer to find.
     * @returns {import('../layer.js').Layer|null} The layer corresponding to the specified name.
     * Returns null if layer is not found.
     */
    getLayerByName(name) {
        return this.layerNameMap.get(name) ?? null;
    }

    _updateOpaqueOrder(startIndex, endIndex) {
        for (let i = startIndex; i <= endIndex; i++) {
            if (this.subLayerList[i] === false) {
                this._opaqueOrder[this.layerList[i].id] = i;
            }
        }
    }

    _updateTransparentOrder(startIndex, endIndex) {
        for (let i = startIndex; i <= endIndex; i++) {
            if (this.subLayerList[i] === true) {
                this._transparentOrder[this.layerList[i].id] = i;
            }
        }
    }

    // Used to determine which array of layers has any sublayer that is
    // on top of all the sublayers in the other array. The order is a dictionary
    // of <layerId, index>.
    _sortLayersDescending(layersA, layersB, order) {
        let topLayerA = -1;
        let topLayerB = -1;

        // search for which layer is on top in layersA
        for (let i = 0, len = layersA.length; i < len; i++) {
            const id = layersA[i];
            if (order.hasOwnProperty(id)) {
                topLayerA = Math.max(topLayerA, order[id]);
            }
        }

        // search for which layer is on top in layersB
        for (let i = 0, len = layersB.length; i < len; i++) {
            const id = layersB[i];
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
     * Used to determine which array of layers has any transparent sublayer that is on top of all
     * the transparent sublayers in the other array.
     *
     * @param {number[]} layersA - IDs of layers.
     * @param {number[]} layersB - IDs of layers.
     * @returns {number} Returns a negative number if any of the transparent sublayers in layersA
     * is on top of all the transparent sublayers in layersB, or a positive number if any of the
     * transparent sublayers in layersB is on top of all the transparent sublayers in layersA, or 0
     * otherwise.
     * @private
     */
    sortTransparentLayers(layersA, layersB) {
        return this._sortLayersDescending(layersA, layersB, this._transparentOrder);
    }

    /**
     * Used to determine which array of layers has any opaque sublayer that is on top of all the
     * opaque sublayers in the other array.
     *
     * @param {number[]} layersA - IDs of layers.
     * @param {number[]} layersB - IDs of layers.
     * @returns {number} Returns a negative number if any of the opaque sublayers in layersA is on
     * top of all the opaque sublayers in layersB, or a positive number if any of the opaque
     * sublayers in layersB is on top of all the opaque sublayers in layersA, or 0 otherwise.
     * @private
     */
    sortOpaqueLayers(layersA, layersB) {
        return this._sortLayersDescending(layersA, layersB, this._opaqueOrder);
    }
}

export { LayerComposition };
