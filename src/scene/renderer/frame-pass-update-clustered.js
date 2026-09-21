import { now } from '../../core/time.js';
import { FramePass } from '../../platform/graphics/frame-pass.js';
import { RenderPassCookieRenderer } from './render-pass-cookie-renderer.js';
import { RenderPassShadowLocalClustered } from './render-pass-shadow-local-clustered.js';

/**
 * A render pass used to update clustered lighting data - shadows, cookies, world clusters.
 *
 * @ignore
 */
class FramePassUpdateClustered extends FramePass {
    constructor(device, renderer, shadowRenderer, shadowRendererLocal, lightTextureAtlas) {
        super(device);
        this.renderer = renderer;

        // Create the shared empty (no-lights) world cluster now. This constructor runs once, only in
        // clustered mode, and outside any render pass - so render-time consumers (layers with no
        // clustered lights, via the forward renderer's `?? empty` fallback, and the picker) get a
        // cached instance. Creating it lazily during rendering would upload its texture inside a
        // render pass, which WebGPU disallows.
        renderer.worldClustersAllocator.createEmpty();

        // render cookies for all local visible lights
        this.cookiesRenderPass = RenderPassCookieRenderer.create(lightTextureAtlas.cookieRenderTarget, lightTextureAtlas.cubeSlotsOffsets);
        this.beforePasses.push(this.cookiesRenderPass);

        // local shadows - these are shared by all cameras (not entirely correctly)
        this.shadowRenderPass = new RenderPassShadowLocalClustered(device, shadowRenderer, shadowRendererLocal);
        this.beforePasses.push(this.shadowRenderPass);
    }

    update(shadowsEnabled, cookiesEnabled, lights, localLights) {

        // discard the previous frame's cluster requests before the render passes re-request them
        // during frame graph build; the requests are resolved and uploaded in execute()
        this.renderer.worldClustersAllocator.reset();

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
        renderer.worldClustersAllocator.upload(renderer.scene.lighting);

        // #if _PROFILER
        renderer._lightClustersTime += now() - startTime;
        renderer._lightClusters = renderer.worldClustersAllocator.count;
        // #endif
    }
}

export { FramePassUpdateClustered };
