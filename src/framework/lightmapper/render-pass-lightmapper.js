import { DebugGraphics } from '../../platform/graphics/debug-graphics.js';
import { RenderPass } from '../../platform/graphics/render-pass.js';
import { SHADER_FORWARD } from '../../scene/constants.js';

/**
 * @import { BindGroup } from '../../platform/graphics/bind-group.js'
 */

/**
 * A render pass implementing rendering of mesh instance receivers for light-mapper.
 */
class RenderPassLightmapper extends RenderPass {
    /** @type {BindGroup[]} */
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

        // Initialize view bind group format if not already done
        if (device.supportsUniformBuffers && !renderer.viewUniformFormat) {
            renderer.initViewBindGroupFormat(renderer.scene.clusteredLightingEnabled);
        }

        renderer.renderForwardLayer(camera, renderTarget, null, undefined, SHADER_FORWARD, this.viewBindGroups, {
            meshInstances: receivers,
            splitLights: lightArray,
            lightClusters: worldClusters
        });

        DebugGraphics.popGpuMarker(device);
    }
}

export { RenderPassLightmapper };
