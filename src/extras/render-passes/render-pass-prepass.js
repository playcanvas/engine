import {
    PIXELFORMAT_R32F,
    PIXELFORMAT_RGBA8
} from '../../platform/graphics/constants.js';
import { Texture } from '../../platform/graphics/texture.js';
import { RenderPass } from '../../platform/graphics/render-pass.js';
import { RenderTarget } from '../../platform/graphics/render-target.js';

import {
    LAYERID_DEPTH,
    SHADER_PREPASS
} from '../../scene/constants.js';
import { Color } from '../../core/math/color.js';
import { FloatPacking } from '../../core/math/float-packing.js';

/**
 * @import { BindGroup } from '../../platform/graphics/bind-group.js'
 */

const tempMeshInstances = [];

// uniform name of the depth texture
const DEPTH_UNIFORM_NAME = 'uSceneDepthMap';

/**
 * A render pass which typically executes before the rendering of the main scene, and renders data
 * that is required for the main rendering pass (and also in following passes) into separate render
 * targets. This can include depth, normals, velocity, etc, used by TAA, motion blur, SSAO, etc.
 *
 * @category Graphics
 * @ignore
 */
class RenderPassPrepass extends RenderPass {
    /** @type {BindGroup[]} */
    viewBindGroups = [];

    /** @type {Texture} */
    linearDepthTexture;

    /** @type {Color} */
    linearDepthClearValue = new Color(0, 0, 0, 0);

    constructor(device, scene, renderer, camera, options) {
        super(device);
        this.scene = scene;
        this.renderer = renderer;
        this.camera = camera;

        this.setupRenderTarget(options);
    }

    destroy() {
        super.destroy();
        this.renderTarget?.destroy();
        this.renderTarget = null;
        this.linearDepthTexture?.destroy();
        this.linearDepthTexture = null;

        this.viewBindGroups.forEach((bg) => {
            bg.defaultUniformBuffer.destroy();
            bg.destroy();
        });
        this.viewBindGroups.length = 0;
    }

    setupRenderTarget(options) {

        const { device } = this;

        this.linearDepthFormat = device.textureFloatRenderable ? PIXELFORMAT_R32F : PIXELFORMAT_RGBA8;
        this.linearDepthTexture = Texture.createDataTexture2D(device, 'SceneLinearDepthTexture', 1, 1, this.linearDepthFormat);

        const renderTarget = new RenderTarget({
            name: 'PrepassRT',
            colorBuffer: this.linearDepthTexture,

            // use depth buffer, but this can be discarded after the prepass as the depth is stored in the linearDepthTexture
            depth: true,

            // always single sampled
            samples: 1
        });

        // scene depth will be linear
        this.camera.shaderParams.sceneDepthMapLinear = true;

        this.init(renderTarget, options);
    }

    after() {
        // Assign the linear depth texture to the uniform
        this.device.scope.resolve(DEPTH_UNIFORM_NAME).setValue(this.linearDepthTexture);
    }

    execute() {

        const { renderer, scene, renderTarget } = this;
        const camera = this.camera.camera;
        const layers = scene.layers.layerList;
        const subLayerEnabled = scene.layers.subLayerEnabled;
        const isTransparent = scene.layers.subLayerList;

        for (let i = 0; i < layers.length; i++) {
            const layer = layers[i];

            // only render the layers before the depth layer
            if (layer.id === LAYERID_DEPTH) {
                break;
            }

            if (layer.enabled && subLayerEnabled[i]) {

                // if the layer is rendered by the camera
                if (layer.camerasSet.has(camera)) {

                    const culledInstances = layer.getCulledInstances(camera);
                    const meshInstances = isTransparent[i] ? culledInstances.transparent : culledInstances.opaque;

                    for (let j = 0; j < meshInstances.length; j++) {
                        const meshInstance = meshInstances[j];

                        // only collect meshes that update the depth
                        if (meshInstance.material?.depthWrite) {
                            tempMeshInstances.push(meshInstance);
                        }
                    }

                    renderer.renderForwardLayer(camera, renderTarget, null, undefined, SHADER_PREPASS, this.viewBindGroups, {
                        meshInstances: tempMeshInstances
                    });

                    tempMeshInstances.length = 0;
                }
            }
        }
    }

    frameUpdate() {

        super.frameUpdate();

        // depth clear value set up each frame
        const { camera } = this;
        this.setClearDepth(camera.clearDepthBuffer ? 1 : undefined);

        // linear depth clear value set up each frame, or undefined to disable clearing
        let clearValue;
        if (camera.clearDepthBuffer) {
            const farClip = camera.farClip - Number.MIN_VALUE;
            clearValue = this.linearDepthClearValue;
            if (this.linearDepthFormat === PIXELFORMAT_R32F) {
                clearValue.r = farClip;  // only R is used
            } else {
                FloatPacking.float2RGBA8(farClip, clearValue);
            }
        }
        this.setClearColor(clearValue);
    }
}

export { RenderPassPrepass };
