import { CULLFACE_NONE } from "../../platform/graphics/constants.js";
import { DebugGraphics } from "../../platform/graphics/debug-graphics.js";
import { DepthState } from "../../platform/graphics/depth-state.js";
import { RenderPass } from "../../platform/graphics/render-pass.js";

/**
 * A render pass implementing rendering of a QuadRender.
 *
 * @ignore
 */
class RenderPassQuad extends RenderPass {
    constructor(device, quad, rect, scissorRect) {
        super(device);

        this.quad = quad;
        this.rect = rect;
        this.scissorRect = scissorRect;
    }

    execute() {
        const { device } = this;
        DebugGraphics.pushGpuMarker(device, "drawQuadWithShader");

        device.setCullMode(CULLFACE_NONE);
        device.setDepthState(DepthState.NODEPTH);
        device.setStencilState(null, null);

        this.quad.render(this.rect, this.scissorRect);
        DebugGraphics.popGpuMarker(device);
    }
}

export { RenderPassQuad };
