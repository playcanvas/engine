/**
 * Class representing an entry in the final order of rendering of cameras and layers in the engine
 * this is populated at runtime based on LayerComposition
 *
 * @ignore
 */
class RenderAction {
    constructor() {

        // the layer
        /** @type {import('../layer.js').Layer|null} */
        this.layer = null;

        // true if this uses transparent sublayer, opaque otherwise
        this.transparent = false;

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

        // an array of view bind groups (the number of these corresponds to the number of views when XR is used)
        /** @type {import('../../platform/graphics/bind-group.js').BindGroup[]} */
        this.viewBindGroups = [];

        // true if the camera should render using render passes it specifies
        this.useCameraPasses = false;
    }

    // releases GPU resources
    destroy() {
        this.viewBindGroups.forEach((bg) => {
            bg.defaultUniformBuffer.destroy();
            bg.destroy();
        });
        this.viewBindGroups.length = 0;
    }

    setupClears(camera, layer) {
        this.clearColor = camera?.clearColorBuffer || layer.clearColorBuffer;
        this.clearDepth = camera?.clearDepthBuffer || layer.clearDepthBuffer;
        this.clearStencil = camera?.clearStencilBuffer || layer.clearStencilBuffer;
    }
}

export { RenderAction };
