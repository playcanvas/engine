import { FramePass } from '../../platform/graphics/frame-pass.js';

/**
 * @import { GSplatComputeGlobalRenderer } from './gsplat-compute-global-renderer.js'
 */

/**
 * A frame pass for the global tiled compute renderer. Registered as a camera beforePass so
 * it runs before the main render pass. On each frame it resizes the offscreen output texture
 * to match the camera's render target, then dispatches the full 7-pass compute pipeline
 * (count/prefix-sum/expand/sort/ranges/rasterize). The rasterized result is later composited
 * into the render target via a full-screen quad with premultiplied blending.
 *
 * @ignore
 */
class FramePassGSplatComputeGlobal extends FramePass {
    /** @type {GSplatComputeGlobalRenderer} */
    renderer;

    /**
     * @param {GSplatComputeGlobalRenderer} renderer - The compute renderer that owns this pass.
     */
    constructor(renderer) {
        super(renderer.device);
        this.renderer = renderer;
        this.name = 'FramePassGSplatComputeGlobal';
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

export { FramePassGSplatComputeGlobal };
