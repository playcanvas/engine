import { Debug } from "../../../core/debug.js";

/**
 * A WebGPU helper class implementing a viewport clear operation. When rendering to a texture,
 * the whole surface can be cleared using loadOp, but if only a viewport needs to be cleared, or if
 * it needs to be cleared later during the rendering, this need to be archieved by rendering a quad.
 *
 * @ignore
 */
class WebgpuClearRenderer {
    clear(device, renderTarget, options) {

        // this needs to handle (by rendering a quad):
        // - clearing of a viewport
        // - clearing of full render target in the middle of the render pass
        Debug.logOnce("WebgpuGraphicsDevice.clear not implemented.");
    }
}

export { WebgpuClearRenderer };
