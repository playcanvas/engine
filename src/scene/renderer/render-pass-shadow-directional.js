import { DebugHelper } from '../../core/debug.js';
import { RenderPass } from '../../platform/graphics/render-pass.js';
import { SHADOWUPDATE_NONE, SHADOWUPDATE_THISFRAME } from '../constants.js';

/**
 * A render pass used to render directional shadows.
 *
 * @ignore
 */
class RenderPassShadowDirectional extends RenderPass {
    // the shadow map does not depend on the XR view, so it is rendered once for all of them
    perView = false;

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

        const { light, cascadeMask, allCascadesRendering } = this;

        this.renderCascades();

        // consume the one-shot overrides of the rendered cascades. Use the scheduled cascades even
        // if an earlier camera consumed their one-shot overrides
        const shadowUpdateOverrides = light.shadowUpdateOverrides;
        if (shadowUpdateOverrides) {
            for (let face = 0; face < light.numShadowFaces; face++) {
                if ((cascadeMask & (1 << face)) && shadowUpdateOverrides[face] === SHADOWUPDATE_THISFRAME) {
                    shadowUpdateOverrides[face] = SHADOWUPDATE_NONE;
                }
            }
        }

        if (allCascadesRendering) {
            light._shadowCascadesInvalidated = false;
        }
    }

    precompile() {

        // render as when the pass executes, into a precompile pass of the device, without
        // consuming the one-shot state of the light
        this.device.startPrecompilePass(this.renderTarget);
        this.renderCascades();
        this.device.endPrecompilePass();
        this.shadowRenderer.renderVsm(this.light, this.camera, this.cascadeMask, true);
    }

    /**
     * Renders the scheduled cascades of the shadow map.
     *
     * @private
     */
    renderCascades() {
        const { light, camera, shadowRenderer, allCascadesRendering, cascadeMask } = this;

        // the shadow map is shared by the cameras, which are all culled before any of them renders,
        // so the split distances this camera's cascades are fitted to are set as the map renders.
        // A light with shadow bounds has no camera and no split distances
        if (camera) {
            light._shadowCascadeDistances.set(light.getRenderData(camera, 0).shadowCascadeDistances);
        }

        for (let face = 0; face < light.numShadowFaces; face++) {
            if (cascadeMask & (1 << face)) {
                shadowRenderer.renderFace(light, camera, face, !allCascadesRendering);
            }
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
