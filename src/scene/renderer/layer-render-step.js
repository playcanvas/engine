/**
 * @import { CameraComponent } from '../../framework/components/camera/component.js'
 * @import { Layer } from '../layer.js'
 * @import { RenderTarget } from '../../platform/graphics/render-target.js'
 * @import { WorldClusters } from '../lighting/world-clusters.js'
 */

/**
 * Represents a single layer rendered by a {@link RenderPassForward}: one layer (its opaque or
 * transparent sublayer) rendered with one camera to one render target.
 *
 * @ignore
 */
class LayerRenderStep {
    /** @type {CameraComponent|null} */
    cameraComponent;

    /** @type {Layer|null} */
    layer;

    /** True if this uses the transparent sublayer, opaque otherwise. */
    transparent;

    /** @type {RenderTarget|null} */
    renderTarget;

    /**
     * The world clusters to use for clustered lighting. Assigned later by the
     * {@link WorldClustersAllocator}, so it always starts as null.
     *
     * @type {WorldClusters|null}
     */
    lightClusters = null;

    // clear flags
    clearColor = false;

    clearDepth = false;

    clearStencil = false;

    // true if this is the first render step using its camera
    firstCameraUse = false;

    // true if this is the last render step using its camera
    lastCameraUse = false;

    /**
     * @param {CameraComponent} cameraComponent - The camera component used to render the layer.
     * @param {Layer} layer - The layer to render.
     * @param {boolean} transparent - True to render the transparent sublayer, opaque otherwise.
     * @param {RenderTarget|null} renderTarget - The render target to render to.
     */
    constructor(cameraComponent, layer, transparent, renderTarget) {
        this.cameraComponent = cameraComponent;
        this.layer = layer;
        this.transparent = transparent;
        this.renderTarget = renderTarget;
    }

    setupClears(cameraComponent, layer) {
        this.clearColor = cameraComponent?.clearColorBuffer || layer.clearColorBuffer;
        this.clearDepth = cameraComponent?.clearDepthBuffer || layer.clearDepthBuffer;
        this.clearStencil = cameraComponent?.clearStencilBuffer || layer.clearStencilBuffer;
    }
}

export { LayerRenderStep };
