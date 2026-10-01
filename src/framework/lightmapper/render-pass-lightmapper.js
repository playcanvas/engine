import { DebugGraphics } from '../../platform/graphics/debug-graphics.js';
import { RenderPass } from '../../platform/graphics/render-pass.js';
import { SHADER_FORWARD } from '../../scene/constants.js';

/**
 * A render pass implementing rendering of mesh instance receivers for light-mapper.
 */
class RenderPassLightmapper extends RenderPass {
    constructor(device, renderer, camera, worldClusters, receivers, lightList) {
        super(device);
        this.renderer = renderer;
        this.camera = camera;
        this.worldClusters = worldClusters;
        this.receivers = receivers;
        this.lightList = lightList;
    }

    execute() {
        const device = this.device;
        DebugGraphics.pushGpuMarker(device, 'Lightmapper');

        const { renderer, camera, receivers, renderTarget, worldClusters, lightList } = this;

        renderer.renderForwardLayer(camera, renderTarget, null, undefined, SHADER_FORWARD, {
            meshInstances: receivers,
            lightList: lightList,
            lightClusters: worldClusters
        });

        DebugGraphics.popGpuMarker(device);
    }
}

export { RenderPassLightmapper };
