import { DebugHelper } from '../../core/debug.js';
import { RenderPass } from '../../platform/graphics/render-pass.js';
import { SHADOWUPDATE_NONE, SHADOWUPDATE_THISFRAME } from '../constants.js';

/**
 * A render pass used to render directional shadows.
 *
 * @ignore
 */
class RenderPassShadowDirectional extends RenderPass {
    constructor(device, shadowRenderer, light, camera, cascadeMask) {
        super(device);
        DebugHelper.setName(this, `RenderPassShadowDir-${light._node.name}`);

        this.shadowRenderer = shadowRenderer;
        this.light = light;
        this.camera = camera;
        this.cascadeMask = cascadeMask;
        this.allCascadesRendering = cascadeMask === (1 << light.numShadowFaces) - 1;
    }

    frameUpdate() {
        super.frameUpdate();
        if (this.enabled && this.executeEnabled) {
            this.shadowRenderer.renderer.culler.requestDirectionalShadowCull(this.light, this.camera, this.cascadeMask);
        }
    }

    execute() {

        const { light, camera, shadowRenderer, allCascadesRendering, cascadeMask } = this;
        const faceCount = light.numShadowFaces;
        const shadowUpdateOverrides = light.shadowUpdateOverrides;

        // Use the scheduled cascades even if an earlier camera consumed their one-shot overrides.
        for (let face = 0; face < faceCount; face++) {
            if (cascadeMask & (1 << face)) {
                shadowRenderer.renderFace(light, camera, face, !allCascadesRendering);

                if (shadowUpdateOverrides?.[face] === SHADOWUPDATE_THISFRAME) {
                    shadowUpdateOverrides[face] = SHADOWUPDATE_NONE;
                }
            }
        }

        if (allCascadesRendering) {
            light._shadowCascadesInvalidated = false;
        }
    }

    after() {
        // apply VSM blur if needed
        if (this.executeEnabled) {
            this.shadowRenderer.renderVsm(this.light, this.camera, this.cascadeMask);
        }
    }
}

export { RenderPassShadowDirectional };
