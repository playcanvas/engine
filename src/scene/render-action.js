import {
    LIGHTTYPE_DIRECTIONAL
} from './constants.js';

// class representing an entry in the final order of rendering of cameras and layers in the engine
// this is populated at runtime based on LayerComposition
class RenderAction {
    constructor() {

        // index into a layer stored in LayerComposition.layerList
        this.layerIndex = 0;

        // index into a camera array of the layer, stored in Layer.cameras
        this.cameraIndex = 0;

        // camera of type CameraComponent
        this.camera = null;

        // render target this render action renders to (taken from either camera or layer)
        this.renderTarget = null;

        // light clusters (type WorldClusters)
        this.lightClusters = null;

        // clear flags
        this.clearColor = false;
        this.clearDepth = false;
        this.clearStencil = false;

        // true if this render action should trigger postprocessing callback for the camera
        this.triggerPostprocess = false;

        // true if this is first render action using this camera
        this.firstCameraUse = false;

        // directional lights that needs to update their shadows for this render action, stored as a set
        this.directionalLightsSet = new Set();

        // and also store them as an array
        this.directionalLights = [];

        // and also the same directional lights, stored as indicies into LayerComposition._lights
        this.directionalLightsIndices = [];
    }

    // prepares render action for re-use
    reset() {
        this.lightClusters = null;
        this.directionalLightsSet.clear();
        this.directionalLights.length = 0;
        this.directionalLightsIndices.length = 0;
    }

    // store directional lights that are needed for this camera based on layers it renders
    collectDirectionalLights(cameraLayers, dirLights, allLights) {

        this.directionalLightsSet.clear();
        this.directionalLights.length = 0;
        this.directionalLightsIndices.length = 0;

        for (let i = 0; i < dirLights.length; i++) {
            const light = dirLights[i];

            // only shadow casting lights
            if (light.castShadows) {
                for (let l = 0; l < cameraLayers.length; l++) {

                    // if layer has the light
                    if (cameraLayers[l]._splitLights[LIGHTTYPE_DIRECTIONAL].indexOf(light) >= 0) {
                        if (!this.directionalLightsSet.has(light)) {
                            this.directionalLightsSet.add(light);

                            this.directionalLights.push(light);

                            // store index into all lights
                            const lightIndex = allLights.indexOf(light);
                            this.directionalLightsIndices.push(lightIndex);
                        }
                    }
                }
            }
        }
    }
}

export { RenderAction };
