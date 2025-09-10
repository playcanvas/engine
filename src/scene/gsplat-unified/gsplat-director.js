import { GSplatManager } from './gsplat-manager.js';

/**
 * @import { LayerComposition } from '../composition/layer-composition.js'
 * @import { Camera } from '../camera.js'
 * @import { Layer } from '../layer.js'
 * @import { GraphicsDevice } from '../../platform/graphics/graphics-device.js'
 * @import { GraphNode } from '../graph-node.js'
 * @import { GSplatAssetLoaderBase } from './gsplat-asset-loader-base.js'
 * @import { Scene } from '../scene.js'
 */

/**
 * Per layer data the director keeps track of.
 *
 * @ignore
 */
class GSplatLayerData {
    /**
     * @type {GSplatManager}
     */
    gsplatManager;

    /**
     * @param {GraphicsDevice} device - The graphics device.
     * @param {GSplatDirector} director - The director.
     * @param {Layer} layer - The layer.
     * @param {GraphNode} cameraNode - The camera node.
     */
    constructor(device, director, layer, cameraNode) {
        this.gsplatManager = new GSplatManager(device, director, layer, cameraNode);
    }

    destroy() {
        this.gsplatManager.destroy();
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

    getLayerData(device, director, layer, cameraNode) {
        let layerData = this.layersMap.get(layer);
        if (!layerData) {
            layerData = new GSplatLayerData(device, director, layer, cameraNode);
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
     * @type {GSplatAssetLoaderBase}
     */
    assetLoader;

    /**
     * @type {Scene}
     */
    scene;

    /**
     * @param {GraphicsDevice} device - The graphics device.
     * @param {Scene} scene - The scene.
     * @param {GSplatAssetLoaderBase} assetLoader - The asset loader.
     */
    constructor(device, scene, assetLoader) {
        this.device = device;
        this.assetLoader = assetLoader;
        this.scene = scene;
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
                cameraData.layersMap.forEach((layerData, layer) => {
                    if (!camera.layersSet.has(layer.id) || !layer.enabled) {
                        layerData.destroy();
                        cameraData.layersMap.delete(layer);
                    }
                });
            }
        });

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

                        // no splats on layer
                        const placements = layer.gsplatPlacements;
                        if (placements.length === 0) {

                            // remove gsplat manager if it exists
                            if (cameraData) {
                                cameraData.removeLayerData(layer);
                            }

                        } else {

                            // update gsplat manager with modified placements
                            cameraData ??= this.getCameraData(camera);
                            const layerData = cameraData.getLayerData(this.device, this, layer, camera.node);
                            layerData.gsplatManager.reconcile(placements);
                        }
                    }
                }
            }

            // update gsplat managers
            cameraData?.layersMap.forEach((layerData) => {
                layerData.gsplatManager.update();
            });
        }

        // clear global gsplat params dirty flag after all updates for this camera
        this.scene.gsplat.dirty = false;

        // clear dirty flags on all layers of the composition
        for (let i = 0; i < comp.layerList.length; i++) {
            comp.layerList[i].gsplatPlacementsDirty = false;
        }
    }
}

export { GSplatDirector };
