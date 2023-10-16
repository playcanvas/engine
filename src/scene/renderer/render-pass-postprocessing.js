import { Debug } from "../../core/debug.js";
import { RenderPass } from "../../platform/graphics/render-pass.js";

/**
 * A render pass used to render post-effects.
 *
 * @ignore
 */
class RenderPassPostprocessing extends RenderPass {
    constructor(device, renderer, renderAction) {
        super(device);
        this.renderer = renderer;
        this.renderAction = renderAction;

        this.requiresCubemaps = false;
    }

    execute() {

        const renderAction = this.renderAction;
        const camera = renderAction.camera;
        Debug.assert(renderAction.triggerPostprocess && camera.onPostprocessing);

        // trigger postprocessing for camera
        camera.onPostprocessing();
    }
}

export { RenderPassPostprocessing };
