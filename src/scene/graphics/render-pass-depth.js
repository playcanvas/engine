import { Color } from "../../core/math/color.js";
import { ADDRESS_CLAMP_TO_EDGE, FILTER_NEAREST, PIXELFORMAT_RGBA8 } from "../../platform/graphics/constants.js";
import { Texture } from "../../platform/graphics/texture.js";
import { RenderPass } from "../../platform/graphics/render-pass.js";
import { BlendState } from "../../platform/graphics/blend-state.js";
import { RenderTarget } from "../../platform/graphics/render-target.js";
import { LAYERID_DEPTH, SHADER_DEPTH } from "../constants.js";

const webgl1DepthClearColor = new Color(254.0 / 255, 254.0 / 255, 254.0 / 255, 254.0 / 255);
const tempMeshInstances = [];
const lights = [[], [], []];

// uniform names (first is current name, second one is deprecated name for compatibility)
const _depthUniformNames = ['uSceneDepthMap', 'uDepthMap'];

/**
 * A render pass implementing rendering of depth. In current implementation, the depth is encoded in
 * RGBA8 texture, and is used on WebGL1 devices as a fallback for missing depth grab functionality.
 *
 * @ignore
 */
class RenderPassDepth extends RenderPass {
    constructor(device, renderer, camera) {
        super(device);
        this.renderer = renderer;
        this.camera = camera;

        this.setupRenderTarget();
    }

    destroy() {
        super.destroy();
        this.releaseRenderTarget(this.renderTarget);
    }

    update(scene) {
        this.scene = scene;
    }

    setupRenderTarget() {

        const texture = new Texture(this.device, {
            name: _depthUniformNames[0],
            format: PIXELFORMAT_RGBA8,
            width: 4,
            height: 4,
            mipmaps: false,
            minFilter: FILTER_NEAREST,
            magFilter: FILTER_NEAREST,
            addressU: ADDRESS_CLAMP_TO_EDGE,
            addressV: ADDRESS_CLAMP_TO_EDGE
        });

        const renderTarget = new RenderTarget({
            name: `${_depthUniformNames[0]}RT}`,
            colorBuffer: texture,
            depth: true,
            stencil: false
        });

        this.init(renderTarget, {});

        // webgl1 depth rendering clear values
        this.setClearColor(webgl1DepthClearColor);
        this.setClearDepth(1.0);
    }

    before() {

        // assign uniform
        const device = this.device;
        const colorBuffer = this.renderTarget.colorBuffer;
        _depthUniformNames.forEach(name => device.scope.resolve(name).setValue(colorBuffer));
    }

    execute() {

        const { device, renderer, camera, scene, renderTarget } = this;
        const layers = scene.layers.layerList;
        const subLayerEnabled = scene.layers.subLayerEnabled;
        const isTransparent = scene.layers.subLayerList;

        for (let i = 0; i < layers.length; i++) {
            const layer = layers[i];

            if (layer.enabled && subLayerEnabled[i]) {

                // if the layer is rendered by the camera
                if (layer.camerasSet.has(camera)) {

                    // only render the layers before the depth layer
                    if (layer.id === LAYERID_DEPTH)
                        break;

                    const culledInstances = layer.getCulledInstances(camera);
                    const meshInstances = isTransparent[i] ? culledInstances.transparent : culledInstances.opaque;

                    for (let j = 0; j < meshInstances.length; j++) {
                        const meshInstance = meshInstances[j];

                        // only collect meshes that update the depth
                        if (meshInstance.material?.depthWrite) {
                            tempMeshInstances.push(meshInstance);
                        }
                    }

                    renderer.setCameraUniforms(camera, renderTarget);
                    renderer.renderForward(camera, tempMeshInstances, lights, SHADER_DEPTH, (meshInstance) => {
                        // writing depth to color render target, force no blending and writing to all channels
                        device.setBlendState(BlendState.NOBLEND);
                    }, layer);

                    tempMeshInstances.length = 0;
                }
            }
        }
    }
}

export { RenderPassDepth };
