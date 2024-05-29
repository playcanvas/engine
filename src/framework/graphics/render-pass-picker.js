import { DebugGraphics } from '../../platform/graphics/debug-graphics.js';
import { BlendState } from '../../platform/graphics/blend-state.js';
import { RenderPass } from '../../platform/graphics/render-pass.js';

import { SHADER_PICK } from '../../scene/constants.js';

const tempMeshInstances = [];
const lights = [[], [], []];

/**
 * A render pass implementing rendering of mesh instances into a pick buffer.
 *
 * @ignore
 */
class RenderPassPicker extends RenderPass {
    /** @type {import('../../platform/graphics/bind-group.js').BindGroup[]} */
    viewBindGroups = [];

    constructor(device, renderer) {
        super(device);
        this.renderer = renderer;
    }

    destroy() {
        this.viewBindGroups.forEach((bg) => {
            bg.defaultUniformBuffer.destroy();
            bg.destroy();
        });
        this.viewBindGroups.length = 0;
    }

    update(camera, scene, layers, mapping) {
        this.camera = camera;
        this.scene = scene;
        this.layers = layers;
        this.mapping = mapping;
    }

    execute() {
        const device = this.device;

        const { renderer, camera, scene, layers, mapping, renderTarget } = this;
        const srcLayers = scene.layers.layerList;
        const subLayerEnabled = scene.layers.subLayerEnabled;
        const isTransparent = scene.layers.subLayerList;

        for (let i = 0; i < srcLayers.length; i++) {
            const srcLayer = srcLayers[i];

            // skip the layer if it does not match the provided ones
            if (layers && layers.indexOf(srcLayer) < 0) {
                continue;
            }

            if (srcLayer.enabled && subLayerEnabled[i]) {

                // if the layer is rendered by the camera
                if (srcLayer.camerasSet.has(camera.camera)) {

                    const transparent = isTransparent[i];
                    DebugGraphics.pushGpuMarker(device, `${srcLayer.name}(${transparent ? 'TRANSP' : 'OPAQUE'})`);

                    // if the layer clears the depth
                    if (srcLayer._clearDepthBuffer) {
                        renderer.clear(camera.camera, false, true, false);
                    }

                    // Use mesh instances from the layer. Ideally we'd just pick culled instances for the camera,
                    // but we have no way of knowing if culling has been performed since changes to the layer.
                    // Disadvantage here is that we render all mesh instances, even those not visible by the camera.
                    const meshInstances = srcLayer.meshInstances;

                    // only need mesh instances with a pick flag
                    for (let j = 0; j < meshInstances.length; j++) {
                        const meshInstance = meshInstances[j];
                        if (meshInstance.pick && meshInstance.transparent === transparent) {
                            tempMeshInstances.push(meshInstance);

                            // keep the index -> meshInstance index mapping
                            mapping.set(meshInstance.id, meshInstance);
                        }
                    }

                    if (tempMeshInstances.length > 0) {

                        // upload clustered lights uniforms
                        const clusteredLightingEnabled = scene.clusteredLightingEnabled;
                        if (clusteredLightingEnabled) {
                            const lightClusters = renderer.worldClustersAllocator.empty;
                            lightClusters.activate();
                        }

                        renderer.setCameraUniforms(camera.camera, renderTarget);
                        if (device.supportsUniformBuffers) {
                            renderer.setupViewUniformBuffers(this.viewBindGroups, renderer.viewUniformFormat, renderer.viewBindGroupFormat, 1);
                        }

                        renderer.renderForward(camera.camera, tempMeshInstances, lights, SHADER_PICK, (meshInstance) => {
                            device.setBlendState(BlendState.NOBLEND);
                        });

                        tempMeshInstances.length = 0;
                    }

                    DebugGraphics.popGpuMarker(device);
                }
            }
        }
    }
}

export { RenderPassPicker };
