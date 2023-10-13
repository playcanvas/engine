import { RenderPass } from "../../platform/graphics/render-pass.js";

/**
 * A render pass used to render local clustered shadows. This is done inside a single render pass,
 * as all shadows are part of a single render target atlas.
 *
 * @ignore
 */
class RenderPassShadowLocalClustered extends RenderPass {
    constructor(device, shadowRenderer, shadowRendererLocal) {
        super(device);

        this.requiresCubemaps = false;

        this.shadowRenderer = shadowRenderer;
        this.shadowRendererLocal = shadowRendererLocal;
    }

    update(localLights) {

        // prepare render targets / shadow cameras for rendering
        const shadowLights = this.shadowRendererLocal.shadowLights;
        const shadowCamera = this.shadowRendererLocal.prepareLights(shadowLights, localLights);

        // if any shadows need to be rendered
        const count = shadowLights.length;
        this.enabled = count > 0;

        if (count) {

            // setup render pass using any of the cameras, they all have the same pass related properties
            // Note that the render pass is set up to not clear the render target, as individual shadow maps clear it
            this.shadowRenderer.setupRenderPass(this, shadowCamera, false);
        }
    }

    execute() {

        const shadowLights = this.shadowRendererLocal.shadowLights;
        const count = shadowLights.length;
        for (let i = 0; i < count; i++) {
            const light = shadowLights[i];
            for (let face = 0; face < light.numShadowFaces; face++) {
                this.shadowRenderer.renderFace(light, null, face, true);
            }
        }

        shadowLights.length = 0;
    }
}

export { RenderPassShadowLocalClustered };
