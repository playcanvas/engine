import {
    FILTER_NEAREST,
    ADDRESS_CLAMP_TO_EDGE,
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
    linearDepthClearValue;

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

        const linearDepthFormat = device.textureFloatRenderable ? PIXELFORMAT_R32F : PIXELFORMAT_RGBA8;
        this.linearDepthTexture = new Texture(device, {
            name: 'SceneLinearDepthTexture',
            width: 1,
            height: 1,
            format: linearDepthFormat,
            mipmaps: false,
            minFilter: FILTER_NEAREST,
            magFilter: FILTER_NEAREST,
            addressU: ADDRESS_CLAMP_TO_EDGE,
            addressV: ADDRESS_CLAMP_TO_EDGE
        });

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

        // clear color for the linear depth texture
        this.linearDepthClearValue = new Color(linearDepthFormat === PIXELFORMAT_R32F ?
            [1, 1, 1, 1] :          // only R is used
            [0.5, 0.0, 0.0, 0.0]    // represents linear value of -1 encoded into RGBA8
        );
    }

    after() {
        // Assign the lienar depth texture to the uniform
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

        // depth clear value (1 or no clear) set up each frame
        const { camera } = this;
        this.setClearDepth(camera.clearDepthBuffer ? 1 : undefined);
        this.setClearColor(camera.clearDepthBuffer ? this.linearDepthClearValue : undefined);
    }
}

export { RenderPassPrepass };
