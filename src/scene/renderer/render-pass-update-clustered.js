import { now } from "../../core/time.js";
import { RenderPass } from "../../platform/graphics/render-pass.js";

/**
 * A render pass used to update clustered lighting data - shadows, cookies, world clusters.
 *
 * @ignore
 */
class RenderPassUpdateClustered extends RenderPass {
    constructor(device, frameGraph, renderer) {
        super(device);
        this.frameGraph = frameGraph;
        this.renderer = renderer;
    }

    execute() {

        // #if _PROFILER
        const startTime = now();
        // #endif

        const { renderer } = this;
        const { scene } = renderer;
        renderer.worldClustersAllocator.update(this.frameGraph.renderPasses, scene.gammaCorrection, scene.lighting);

        // #if _PROFILER
        renderer._lightClustersTime += now() - startTime;
        renderer._lightClusters = renderer.worldClustersAllocator.count;
        // #endif
    }
}

export { RenderPassUpdateClustered };
