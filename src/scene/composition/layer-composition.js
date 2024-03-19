import { TRACEID_RENDER_ACTION } from '../../core/constants.js';
import { Debug } from '../../core/debug.js';
import { Tracing } from '../../core/tracing.js';
import { EventHandler } from '../../core/event-handler.js';
import { sortPriority } from '../../core/sort.js';
import { LAYERID_DEPTH } from '../constants.js';
import { RenderAction } from './render-action.js';

/**
 * Layer Composition is a collection of {@link Layer} that is fed to {@link Scene#layers} to define
 * rendering order.
 *
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
     * A mapping of {@link Layer} to its opaque index in {@link LayerComposition#layerList}.
     *
     * @type {Map<import('../layer.js').Layer, number>}
     * @ignore
     */
    layerOpaqueIndexMap = new Map();

    /**
     * A mapping of {@link Layer} to its transparent index in {@link LayerComposition#layerList}.
     *
     * @type {Map<import('../layer.js').Layer, number>}
     * @ignore
     */
    layerTransparentIndexMap = new Map();

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
     * A mapping of {@link CameraComponent} to its index in {@link LayerComposition#cameras}.
     *
     * @type {Map<import('../../framework/components/camera/component.js').CameraComponent, number>}
     * @ignore
     */
    camerasMap = new Map();

    /**
     * The actual rendering sequence, generated based on layers and cameras
     *
     * @type {RenderAction[]}
     * @ignore
     */
    _renderActions = [];

    /**
     * True if the composition needs to be updated before rendering.
     *
     * @ignore
     */
    _dirty = false;

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
    }

    destroy() {
        this.destroyRenderActions();
    }

    destroyRenderActions() {
        this._renderActions.forEach(ra => ra.destroy());
        this._renderActions.length = 0;
    }

    _update() {
        const len = this.layerList.length;

        // if composition dirty flag is not set, test if layers are marked dirty
        if (!this._dirty) {
            for (let i = 0; i < len; i++) {
                if (this.layerList[i]._dirtyComposition) {
                    this._dirty = true;
                    break;
                }
            }
        }

        if (this._dirty) {

            this._dirty = false;

            // walk the layers and build an array of unique cameras from all layers
            this.cameras.length = 0;
            for (let i = 0; i < len; i++) {
                const layer = this.layerList[i];
                layer._dirtyComposition = false;

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

            // update camera map
            this.camerasMap.clear();
            for (let i = 0; i < this.cameras.length; i++) {
                this.camerasMap.set(this.cameras[i], i);
            }

            // collect a list of layers this camera renders
            const cameraLayers = [];

            // render in order of cameras sorted by priority
            let renderActionCount = 0;
            this.destroyRenderActions();

            for (let i = 0; i < this.cameras.length; i++) {
                const camera = this.cameras[i];
                cameraLayers.length = 0;

                // if the camera uses custom render passes, only add a dummy render action to mark
                // the place where to add them during building of the frame graph
                if (camera.camera.renderPasses.length > 0) {
                    this.addDummyRenderAction(renderActionCount, camera);
                    renderActionCount++;
                    continue;
                }

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
                    const isLayerEnabled = layer.enabled && this.subLayerEnabled[j];
                    if (isLayerEnabled) {

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

                                // add render action to describe rendering step
                                const isTransparent = this.subLayerList[j];
                                lastRenderAction = this.addRenderAction(renderActionCount, layer, isTransparent, camera,
                                                                        cameraFirstRenderAction, postProcessMarked);
                                renderActionCount++;
                                cameraFirstRenderAction = false;
                            }
                        }
                    }
                }

                // if the camera renders any layers.
                if (cameraFirstRenderActionIndex < renderActionCount) {

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

            this._logRenderActions();
        }
    }

    getNextRenderAction(renderActionIndex) {
        Debug.assert(this._renderActions.length === renderActionIndex);
        const renderAction = new RenderAction();
        this._renderActions.push(renderAction);
        return renderAction;
    }

    addDummyRenderAction(renderActionIndex, camera) {
        const renderAction = this.getNextRenderAction(renderActionIndex);
        renderAction.camera = camera;
        renderAction.useCameraPasses = true;
    }

    // function adds new render action to a list, while trying to limit allocation and reuse already allocated objects
    addRenderAction(renderActionIndex, layer, isTransparent, camera, cameraFirstRenderAction, postProcessMarked) {

        // render target from the camera takes precedence over the render target from the layer
        let rt = layer.renderTarget;
        if (camera && camera.renderTarget) {
            if (layer.id !== LAYERID_DEPTH) {   // ignore depth layer
                rt = camera.renderTarget;
            }
        }

        // was camera and render target combo used already
        let used = false;
        const renderActions = this._renderActions;
        for (let i = renderActionIndex - 1; i >= 0; i--) {
            if (renderActions[i].camera === camera && renderActions[i].renderTarget === rt) {
                used = true;
                break;
            }
        }

        // for cameras with post processing enabled, on layers after post processing has been applied already (so UI and similar),
        // don't render them to render target anymore
        if (postProcessMarked && camera.postEffectsEnabled) {
            rt = null;
        }

        // store the properties
        const renderAction = this.getNextRenderAction(renderActionIndex);
        renderAction.triggerPostprocess = false;
        renderAction.layer = layer;
        renderAction.transparent = isTransparent;
        renderAction.camera = camera;
        renderAction.renderTarget = rt;
        renderAction.firstCameraUse = cameraFirstRenderAction;
        renderAction.lastCameraUse = false;

        // clear flags - use camera clear flags in the first render action for each camera,
        // or when render target (from layer) was not yet cleared by this camera
        const needsCameraClear = cameraFirstRenderAction || !used;
        const needsLayerClear = layer.clearColorBuffer || layer.clearDepthBuffer || layer.clearStencilBuffer;
        if (needsCameraClear || needsLayerClear) {
            renderAction.setupClears(needsCameraClear ? camera : undefined, layer);
        }

        return renderAction;
    }

    // executes when post-processing camera's render actions were created to propagate rendering to
    // render targets to previous camera as needed
    propagateRenderTarget(startIndex, fromCamera) {

        for (let a = startIndex; a >= 0; a--) {

            const ra = this._renderActions[a];
            const layer = ra.layer;

            // if we hit render action with a render target (other than depth layer), that marks the end of camera stack
            // TODO: refactor this as part of depth layer refactoring
            if (ra.renderTarget && layer.id !== LAYERID_DEPTH) {
                break;
            }

            // skip over depth layer
            if (layer.id === LAYERID_DEPTH) {
                continue;
            }

            // end of stacking if camera with custom render passes
            if (ra.useCameraPasses) {
                break;
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
                const camera = ra.camera;
                if (ra.useCameraPasses) {
                    Debug.trace(TRACEID_RENDER_ACTION, i +
                        ('CustomPasses Cam: ' + (camera ? camera.entity.name : '-')));
                } else {
                    const layer = ra.layer;
                    const enabled = layer.enabled && this.isEnabled(layer, ra.transparent);
                    const clear = (ra.clearColor ? 'Color ' : '..... ') + (ra.clearDepth ? 'Depth ' : '..... ') + (ra.clearStencil ? 'Stencil' : '.......');

                    Debug.trace(TRACEID_RENDER_ACTION, i +
                        (' Cam: ' + (camera ? camera.entity.name : '-')).padEnd(22, ' ') +
                        (' Lay: ' + layer.name).padEnd(22, ' ') +
                        (ra.transparent ? ' TRANSP' : ' OPAQUE') +
                        (enabled ? ' ENABLED ' : ' DISABLED') +
                        (' RT: ' + (ra.renderTarget ? ra.renderTarget.name : '-')).padEnd(30, ' ') +
                        ' Clear: ' + clear +
                        (ra.firstCameraUse ? ' CAM-FIRST' : '') +
                        (ra.lastCameraUse ? ' CAM-LAST' : '') +
                        (ra.triggerPostprocess ? ' POSTPROCESS' : '')
                    );
                }
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
        const map = transparent ? this.layerTransparentIndexMap : this.layerOpaqueIndexMap;
        if (map.get(layer) !== undefined) {
            Debug.error(`Sublayer ${layer.name}, transparent: ${transparent} is already added.`);
            return true;
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
        this._dirty = true;
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
        this._dirty = true;
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
            this._dirty = true;
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
        this._dirty = true;
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
        this._dirty = true;
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
                this._dirty = true;
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
        this._dirty = true;
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
        this._dirty = true;
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
                this._dirty = true;
                if (this.layerList.indexOf(layer) < 0) {
                    this.fire('remove', layer); // no sublayers left
                }
                break;
            }
        }
        this._updateLayerMaps();
    }

    /**
     * Gets index of the opaque part of the supplied layer in the {@link LayerComposition#layerList}.
     *
     * @param {import('../layer.js').Layer} layer - A {@link Layer} to find index of.
     * @returns {number} The index of the opaque part of the specified layer, or -1 if it is not
     * part of the composition.
     */
    getOpaqueIndex(layer) {
        return this.layerOpaqueIndexMap.get(layer) ?? -1;
    }

    /**
     * Gets index of the semi-transparent part of the supplied layer in the {@link LayerComposition#layerList}.
     *
     * @param {import('../layer.js').Layer} layer - A {@link Layer} to find index of.
     * @returns {number} The index of the semi-transparent part of the specified layer, or -1 if it
     * is not part of the composition.
     */
    getTransparentIndex(layer) {
        return this.layerTransparentIndexMap.get(layer) ?? -1;
    }

    isEnabled(layer, transparent) {
        const index = transparent ? this.getTransparentIndex(layer) : this.getOpaqueIndex(layer);
        Debug.assert(index >= 0, `${transparent ? 'Transparent' : 'Opaque'} layer ${layer.name} is not part of the composition.`);
        return this.subLayerEnabled[index];
    }

    /**
     * Update maps of layer IDs and names to match the layer list.
     *
     * @private
     */
    _updateLayerMaps() {
        this.layerIdMap.clear();
        this.layerNameMap.clear();
        this.layerOpaqueIndexMap.clear();
        this.layerTransparentIndexMap.clear();

        for (let i = 0; i < this.layerList.length; i++) {
            const layer = this.layerList[i];
            this.layerIdMap.set(layer.id, layer);
            this.layerNameMap.set(layer.name, layer);

            const subLayerIndexMap = this.subLayerList[i] ? this.layerTransparentIndexMap : this.layerOpaqueIndexMap;
            subLayerIndexMap.set(layer, i);
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
