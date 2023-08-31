/**
 * Class representing an entry in the final order of rendering of cameras and layers in the engine
 * this is populated at runtime based on LayerComposition
 *
 * @ignore
 */
class RenderAction {
    constructor() {

        // index into a layer stored in LayerComposition.layerList
        this.layerIndex = 0;

        // the layer
        this.layer = null;

        // index into a camera array of the layer, stored in Layer.cameras
        this.cameraIndex = 0;

        // camera of type CameraComponent
        this.camera = null;

        /**
         * render target this render action renders to (taken from either camera or layer)
         *
         * @type {import('../../platform/graphics/render-target.js').RenderTarget|null}
         */
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

        // true if this is the last render action using this camera
        this.lastCameraUse = false;

        // directional lights that needs to update their shadows for this render action. The array is
        // filled in during light culling each frame.
        this.directionalLights = [];

        // an array of view bind groups (the number of these corresponds to the number of views when XR is used)
        /** @type {import('../../platform/graphics/bind-group.js').BindGroup[]} */
        this.viewBindGroups = [];
    }

    // releases GPU resources
    destroy() {
        this.viewBindGroups.forEach((bg) => {
            bg.defaultUniformBuffer.destroy();
            bg.destroy();
        });
        this.viewBindGroups.length = 0;
    }

    get hasDirectionalShadowLights() {
        return this.directionalLights.length > 0;
    }

    /**
     * @param {import('./layer-composition.js').LayerComposition} layerComposition - The layer
     * composition.
     * @returns {boolean} - True if the layer / sublayer referenced by the render action is enabled
     */
    isLayerEnabled(layerComposition) {
        const layer = layerComposition.layerList[this.layerIndex];
        return layer.enabled && layerComposition.subLayerEnabled[this.layerIndex];
    }
}

export { RenderAction };
