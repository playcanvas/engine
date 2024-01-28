import { DebugGraphics } from '../../platform/graphics/debug-graphics.js';
import { RenderPass } from '../../platform/graphics/render-pass.js';
import { SHADER_FORWARDHDR } from '../../scene/constants.js';

/**
 * A render pass implementing rendering of mesh instance receivers for light-mapper.
 *
 * @ignore
 */
class RenderPassLightmapper extends RenderPass {
    /** @type {import('../../platform/graphics/bind-group.js').BindGroup[]} */
    viewBindGroups = [];

    constructor(device, renderer, camera, worldClusters, receivers, lightArray) {
        super(device);
        this.renderer = renderer;
        this.camera = camera;
        this.worldClusters = worldClusters;
        this.receivers = receivers;
        this.lightArray = lightArray;
    }

    destroy() {
        this.viewBindGroups.forEach((bg) => {
            bg.defaultUniformBuffer.destroy();
            bg.destroy();
        });
        this.viewBindGroups.length = 0;
    }

    execute() {
        const device = this.device;
        DebugGraphics.pushGpuMarker(device, 'Lightmapper');

        const { renderer, camera, receivers, renderTarget, worldClusters, lightArray } = this;

        // prepare clustered lighting
        if (worldClusters) {
            worldClusters.activate();
        }

        renderer.setCameraUniforms(camera, renderTarget);
        if (device.supportsUniformBuffers) {
            renderer.setupViewUniformBuffers(this.viewBindGroups, renderer.viewUniformFormat, renderer.viewBindGroupFormat, 1);
        }

        renderer._forwardTime = 0;
        renderer._shadowMapTime = 0;
        renderer.renderForward(camera, receivers, lightArray, SHADER_FORWARDHDR);

        DebugGraphics.popGpuMarker(device);
    }
}

export { RenderPassLightmapper };
