import { DebugHelper } from "../../core/debug.js";
import { RenderPass } from "../../platform/graphics/render-pass.js";

/**
 * A render pass used to render local non-clustered shadows. It represents rendering to a single
 * face of shadow map, as each face is a separate render target.
 *
 * @ignore
 */
class RenderPassShadowLocalNonClustered extends RenderPass {
    constructor(device, shadowRenderer, light, face, applyVsm) {
        super(device);
        DebugHelper.setName(this, `${this.name}-${light._node.name}`);

        this.requiresCubemaps = false;

        this.shadowRenderer = shadowRenderer;
        this.light = light;
        this.face = face;
        this.applyVsm = applyVsm;
        this.shadowCamera = shadowRenderer.prepareFace(light, null, face);

        // clear the render target as well, as it contains a single shadow map
        shadowRenderer.setupRenderPass(this, this.shadowCamera, true);
    }

    execute() {
        this.shadowRenderer.renderFace(this.light, null, this.face, false);
    }

    after() {
        if (this.applyVsm) {
            this.shadowRenderer.renderVsm(this.light, this.shadowCamera);
        }
    }
}

export { RenderPassShadowLocalNonClustered };
