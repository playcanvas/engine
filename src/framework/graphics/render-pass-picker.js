import { DebugGraphics } from '../../platform/graphics/debug-graphics.js';
import { BlendState } from '../../platform/graphics/blend-state.js';
import { RenderPass } from '../../platform/graphics/render-pass.js';

import { SHADER_PICK } from '../../scene/constants.js';

const tempMeshInstances = [];

/**
 * A render pass implementing rendering of mesh instances into a pick buffer.
 *
 * @ignore
 */
class RenderPassPicker extends RenderPass {
    // uniform for the mesh index encoded into rgba
    pickColor = new Float32Array(4);

    constructor(device, renderer) {
        super(device);
        this.renderer = renderer;
    }

    setup(camera, scene, layers, mapping) {
        this.camera = camera;
        this.scene = scene;
        this.layers = layers;
        this.mapping = mapping;
    }

    execute() {
        const device = this.device;
        DebugGraphics.pushGpuMarker(device, 'PICKER');

        const { renderer, camera, scene, layers, mapping } = this;
        const srcLayers = scene.layers.layerList;
        const subLayerEnabled = scene.layers.subLayerEnabled;
        const isTransparent = scene.layers.subLayerList;

        const pickColorId = device.scope.resolve('uColor');
        const pickColor = this.pickColor;

        for (let i = 0; i < srcLayers.length; i++) {
            const srcLayer = srcLayers[i];

            // skip the layer if it does not match the provided ones
            if (layers && layers.indexOf(srcLayer) < 0) {
                continue;
            }

            if (srcLayer.enabled && subLayerEnabled[i]) {

                // if the layer is rendered by the camera
                const layerCamId = srcLayer.cameras.indexOf(camera);
                if (layerCamId >= 0) {

                    // if the layer clears the depth
                    if (srcLayer._clearDepthBuffer) {
                        renderer.clear(camera.camera, false, true, false);
                    }

                    const culledInstances = srcLayer.getCulledInstances(camera.camera);
                    const meshInstances = isTransparent[i] ? culledInstances.transparent : culledInstances.opaque;

                    // only need mesh instances with a pick flag
                    for (let j = 0; j < meshInstances.length; j++) {
                        const meshInstance = meshInstances[j];
                        if (meshInstance.pick) {
                            tempMeshInstances.push(meshInstance);

                            // keep the index -> meshInstance index mapping
                            mapping.set(meshInstance.id, meshInstance);
                        }
                    }

                    const lights = [[], [], []];
                    renderer.renderForward(camera.camera, tempMeshInstances, lights, SHADER_PICK, (meshInstance) => {
                        const miId = meshInstance.id;
                        pickColor[0] = ((miId >> 16) & 0xff) / 255;
                        pickColor[1] = ((miId >> 8) & 0xff) / 255;
                        pickColor[2] = (miId & 0xff) / 255;
                        pickColor[3] = ((miId >> 24) & 0xff) / 255;
                        pickColorId.setValue(pickColor);
                        device.setBlendState(BlendState.NOBLEND);
                    });

                    tempMeshInstances.length = 0;
                }
            }
        }

        DebugGraphics.popGpuMarker(device);
    }
}

export { RenderPassPicker };
