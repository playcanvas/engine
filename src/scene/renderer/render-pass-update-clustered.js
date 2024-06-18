import { now } from "../../core/time.js";
import { RenderPass } from "../../platform/graphics/render-pass.js";
import { RenderPassCookieRenderer } from "./render-pass-cookie-renderer.js";
import { RenderPassShadowLocalClustered } from "./render-pass-shadow-local-clustered.js";

/**
 * A render pass used to update clustered lighting data - shadows, cookies, world clusters.
 *
 * @ignore
 */
class RenderPassUpdateClustered extends RenderPass {
    constructor(device, renderer, shadowRenderer, shadowRendererLocal, lightTextureAtlas) {
        super(device);
        this.renderer = renderer;
        this.frameGraph = null;

        // render cookies for all local visible lights
        this.cookiesRenderPass = RenderPassCookieRenderer.create(lightTextureAtlas.cookieRenderTarget, lightTextureAtlas.cubeSlotsOffsets);
        this.beforePasses.push(this.cookiesRenderPass);

        // local shadows - these are shared by all cameras (not entirely correctly)
        this.shadowRenderPass = new RenderPassShadowLocalClustered(device, shadowRenderer, shadowRendererLocal);
        this.beforePasses.push(this.shadowRenderPass);
    }

    update(frameGraph, shadowsEnabled, cookiesEnabled, lights, localLights) {

        this.frameGraph = frameGraph;

        this.cookiesRenderPass.enabled = cookiesEnabled;
        if (cookiesEnabled) {
            this.cookiesRenderPass.update(lights);
        }

        this.shadowRenderPass.enabled = shadowsEnabled;
        if (shadowsEnabled) {
            this.shadowRenderPass.update(localLights);
        }
    }

    destroy() {
        this.cookiesRenderPass.destroy();
        this.cookiesRenderPass = null;
    }

    execute() {

        // #if _PROFILER
        const startTime = now();
        // #endif

        const { renderer } = this;
        const { scene } = renderer;
        renderer.worldClustersAllocator.update(this.frameGraph.renderPasses, scene.lighting);

        // #if _PROFILER
        renderer._lightClustersTime += now() - startTime;
        renderer._lightClusters = renderer.worldClustersAllocator.count;
        // #endif
    }
}

export { RenderPassUpdateClustered };
