import { GSplatManager } from './gsplat-manager.js';
import { SetUtils } from '../../core/set-utils.js';
import { GSPLAT_FORWARD, GSPLAT_SHADOW } from '../constants.js';

/**
 * @import { LayerComposition } from '../composition/layer-composition.js'
 * @import { Camera } from '../camera.js'
 * @import { Layer } from '../layer.js'
 * @import { GraphicsDevice } from '../../platform/graphics/graphics-device.js'
 * @import { GraphNode } from '../graph-node.js'
 * @import { Scene } from '../scene.js'
 * @import { Renderer } from '../renderer/renderer.js'
 * @import { EventHandler } from '../../core/event-handler.js'
 */

const tempLayersToRemove = [];

/**
 * Per layer data the director keeps track of.
 *
 * @ignore
 */
class GSplatLayerData {
    /**
     * @type {GSplatManager|null}
     */
    gsplatManager = null;

    /**
     * @type {GSplatManager|null}
     */
    gsplatManagerShadow = null;

    /**
     * @param {GraphicsDevice} device - The graphics device.
     * @param {GSplatDirector} director - The director.
     * @param {Layer} layer - The layer.
     * @param {Camera} camera - The camera.
     */
    constructor(device, director, layer, camera) {
        this.updateConfiguration(device, director, layer, camera);
    }

    /**
     * Creates a new GSplatManager, sets its render mode, and fires the material:created event.
     *
     * @param {GraphicsDevice} device - The graphics device.
     * @param {GSplatDirector} director - The director.
     * @param {Layer} layer - The layer.
     * @param {GraphNode} cameraNode - The camera node.
     * @param {Camera} camera - The camera.
     * @param {number} renderMode - The render mode flags.
     * @returns {GSplatManager} The created manager.
     * @private
     */
    createManager(device, director, layer, cameraNode, camera, renderMode) {
        const manager = new GSplatManager(device, director, layer, cameraNode);
        manager.setRenderMode(renderMode);

        // Fire material:created event
        if (director.eventHandler) {
            director.eventHandler.fire('material:created', manager.material, camera, layer);
        }

        return manager;
    }

    /**
     * Updates the manager configuration based on current layer placements.
     *
     * @param {GraphicsDevice} device - The graphics device.
     * @param {GSplatDirector} director - The director.
     * @param {Layer} layer - The layer.
     * @param {Camera} camera - The camera.
     */
    updateConfiguration(device, director, layer, camera) {
        const cameraNode = camera.node;
        const hasNormalPlacements = layer.gsplatPlacements.length > 0;
        const hasShadowCasters = layer.gsplatShadowCasters.length > 0;

        // Determine desired configuration
        const setsEqual = SetUtils.equals(layer.gsplatPlacementsSet, layer.gsplatShadowCastersSet);
        const useSharedManager = setsEqual && hasNormalPlacements;

        // Desired render modes for each manager (0 = should not exist)
        const desiredMainMode = useSharedManager ?
            (GSPLAT_FORWARD | GSPLAT_SHADOW) :
            (hasNormalPlacements ? GSPLAT_FORWARD : 0);
        const desiredShadowMode = useSharedManager ?
            0 :
            (hasShadowCasters ? GSPLAT_SHADOW : 0);

        // Update or create/destroy main manager
        if (desiredMainMode) {
            if (this.gsplatManager) {
                this.gsplatManager.setRenderMode(desiredMainMode);
            } else {
                this.gsplatManager = this.createManager(device, director, layer, cameraNode, camera, desiredMainMode);
            }
        } else if (this.gsplatManager) {
            this.gsplatManager.destroy();
            this.gsplatManager = null;
        }

        // Update or create/destroy shadow manager
        if (desiredShadowMode) {
            if (this.gsplatManagerShadow) {
                this.gsplatManagerShadow.setRenderMode(desiredShadowMode);
            } else {
                this.gsplatManagerShadow = this.createManager(device, director, layer, cameraNode, camera, desiredShadowMode);
            }
        } else if (this.gsplatManagerShadow) {
            this.gsplatManagerShadow.destroy();
            this.gsplatManagerShadow = null;
        }
    }

    destroy() {
        this.gsplatManager?.destroy();
        this.gsplatManager = null;

        this.gsplatManagerShadow?.destroy();
        this.gsplatManagerShadow = null;
    }
}

/**
 * Per camera data the director keeps track of.
 *
 * @ignore
 */
class GSplatCameraData {
    /**
     * @type {Map<Layer, GSplatLayerData>}
     */
    layersMap = new Map();

    destroy() {
        this.layersMap.forEach(layerData => layerData.destroy());
        this.layersMap.clear();
    }

    removeLayerData(layer) {
        const layerData = this.layersMap.get(layer);
        if (layerData) {
            layerData.destroy();
            this.layersMap.delete(layer);
        }
    }

    getLayerData(device, director, layer, camera) {
        let layerData = this.layersMap.get(layer);
        if (!layerData) {
            layerData = new GSplatLayerData(device, director, layer, camera);
            this.layersMap.set(layer, layerData);
        }
        return layerData;
    }
}

/**
 * Class responsible for managing {@link GSplatManager} instances for Cameras and their Layers.
 *
 * @ignore
 */
class GSplatDirector {
    /**
     * @type {GraphicsDevice}
     */
    device;

    /**
     * Per camera data.
     *
     * @type {Map<Camera, GSplatCameraData>}
     */
    camerasMap = new Map();

    /**
     * @type {Scene}
     */
    scene;

    /**
     * @type {EventHandler}
     */
    eventHandler;

    /**
     * @param {GraphicsDevice} device - The graphics device.
     * @param {Renderer} renderer - The renderer.
     * @param {Scene} scene - The scene.
     * @param {EventHandler} eventHandler - Event handler for firing events.
     */
    constructor(device, renderer, scene, eventHandler) {
        this.device = device;
        this.renderer = renderer;
        this.scene = scene;
        this.eventHandler = eventHandler;
    }

    destroy() {

        // destroy all gsplat managers
        this.camerasMap.forEach(cameraData => cameraData.destroy());
        this.camerasMap.clear();
    }

    getCameraData(camera) {
        let cameraData = this.camerasMap.get(camera);
        if (!cameraData) {
            cameraData = new GSplatCameraData();
            this.camerasMap.set(camera, cameraData);
        }
        return cameraData;
    }

    /**
     * Updates the director for the given layer composition cameras and layers.
     *
     * @param {LayerComposition} comp - The layer composition.
     */
    update(comp) {

        // remove camera / layer entires for cameras / layers no longer in the composition
        this.camerasMap.forEach((cameraData, camera) => {

            // camera is no longer in the composition
            if (!comp.camerasSet.has(camera)) {
                cameraData.destroy();
                this.camerasMap.delete(camera);

            } else { // camera still exists

                // remove all layerdata for removed / disabled layers of this camera
                // Collect layers to remove (don't modify map during iteration)
                cameraData.layersMap.forEach((layerData, layer) => {
                    if (!camera.layersSet.has(layer.id) || !layer.enabled) {
                        tempLayersToRemove.push(layer);
                    }
                });

                // Now safely remove them
                for (let i = 0; i < tempLayersToRemove.length; i++) {
                    const layer = tempLayersToRemove[i];
                    const layerData = cameraData.layersMap.get(layer);
                    if (layerData) {
                        layerData.destroy();
                        cameraData.layersMap.delete(layer);
                    }
                }

                // Clear to avoid dangling references
                tempLayersToRemove.length = 0;
            }
        });

        let gsplatCount = 0;

        // for all cameras in the composition
        const camerasComponents = comp.cameras;
        for (let i = 0; i < camerasComponents.length; i++) {
            const camera = camerasComponents[i].camera;
            let cameraData = this.camerasMap.get(camera);

            // for all of its layers
            const layerIds = camera.layers;
            for (let j = 0; j < layerIds.length; j++) {

                const layer = comp.getLayerById(layerIds[j]);
                if (layer?.enabled) {

                    // if layer's splat placements were modified, or new camera
                    if (layer.gsplatPlacementsDirty || !cameraData) {

                        // check if there are any placements
                        const hasNormalPlacements = layer.gsplatPlacements.length > 0;
                        const hasShadowCasters = layer.gsplatShadowCasters.length > 0;

                        if (!hasNormalPlacements && !hasShadowCasters) {
                            // no splats on layer - remove gsplat managers if they exist
                            if (cameraData) {
                                cameraData.removeLayerData(layer);
                            }
                        } else {
                            // update gsplat managers with modified placements
                            cameraData ??= this.getCameraData(camera);
                            const layerData = cameraData.getLayerData(this.device, this, layer, camera);

                            // Update configuration (creates/destroys/reconfigures managers as needed)
                            layerData.updateConfiguration(this.device, this, layer, camera);

                            // Reconcile the managers with their respective placements
                            if (layerData.gsplatManager) {
                                layerData.gsplatManager.reconcile(layer.gsplatPlacements);
                            }
                            if (layerData.gsplatManagerShadow) {
                                layerData.gsplatManagerShadow.reconcile(layer.gsplatShadowCasters);
                            }
                        }
                    }
                }
            }

            // update gsplat managers
            if (cameraData) {
                for (const layerData of cameraData.layersMap.values()) {
                    if (layerData.gsplatManager) {
                        gsplatCount += layerData.gsplatManager.update();
                    }
                    if (layerData.gsplatManagerShadow) {
                        gsplatCount += layerData.gsplatManagerShadow.update();
                    }
                }
            }
        }

        // update stats
        this.renderer._gsplatCount = gsplatCount;

        // clear dirty flags
        this.scene.gsplat.frameEnd();

        // clear dirty flags on all layers of the composition
        for (let i = 0; i < comp.layerList.length; i++) {
            comp.layerList[i].gsplatPlacementsDirty = false;
        }
    }
}

export { GSplatDirector };
