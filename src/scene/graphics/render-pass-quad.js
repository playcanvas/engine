import { DebugGraphics } from '../../platform/graphics/debug-graphics.js';
import { RenderPass } from '../../platform/graphics/render-pass.js';

/**
 * A render pass implementing rendering of a QuadRender.
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
        DebugGraphics.pushGpuMarker(device, `${this.name}:${this.quad.shader.name}`);

        device.setDrawStates();

        this.quad.render(this.rect, this.scissorRect);
        DebugGraphics.popGpuMarker(device);
    }
}

export { RenderPassQuad };
