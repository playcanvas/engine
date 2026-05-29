import { FramePass } from '../../platform/graphics/frame-pass.js';

/**
 * @import { GSplatComputeLocalRenderer } from './gsplat-compute-local-renderer.js'
 */

/**
 * A frame pass for the local tiled compute renderer. Registered as a camera beforePass so
 * it runs before the main render pass. On each frame it resizes the offscreen output texture
 * to match the camera's render target, then dispatches the single-pass local rasterizer.
 * The rasterized result is later composited into the render target via a full-screen quad
 * with premultiplied blending.
 *
 * @ignore
 */
class FramePassGSplatComputeLocal extends FramePass {
    /** @type {GSplatComputeLocalRenderer} */
    renderer;

    /**
     * @param {GSplatComputeLocalRenderer} renderer - The compute renderer that owns this pass.
     */
    constructor(renderer) {
        super(renderer.device);
        this.renderer = renderer;
        this.name = 'FramePassGSplatComputeLocal';
    }

    frameUpdate() {
        const renderer = this.renderer;
        const camera = renderer.cameraNode.camera;
        const rt = camera.renderTarget;
        const rtWidth = rt ? rt.width : this.device.width;
        const rtHeight = rt ? rt.height : this.device.height;
        const rect = camera.rect;
        const width = Math.floor(rtWidth * rect.z);
        const height = Math.floor(rtHeight * rect.w);
        renderer.resizeOutputTexture(width, height);
    }

    execute() {
        this.renderer.dispatch();
    }
}

export { FramePassGSplatComputeLocal };
