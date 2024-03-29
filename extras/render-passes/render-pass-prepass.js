import {
    LAYERID_DEPTH,
    SHADER_PREPASS_VELOCITY,
    FILTER_NEAREST,
    PIXELFORMAT_RGBA32F,
    PIXELFORMAT_RGBA16F,
    ADDRESS_CLAMP_TO_EDGE,
    Texture,
    RenderPass,
    RenderTarget
} from "playcanvas";

const tempMeshInstances = [];

// uniform name of the depth texture
const DEPTH_UNIFORM_NAME = 'uSceneDepthMap';

// uniform name of the velocity texture
const VELOCITY_UNIFORM_NAME = 'uSceneVelocityMap';

/**
 * A render pass which typically executes before the rendering of the main scene, and renders data
 * that is required for the main rendering pass (and also in following passes) into separate render
 * targets. This can include depth, normals, velocity, etc, used by TAA, motion blur, SSAO, etc.
 *
 * @ignore
 */
class RenderPassPrepass extends RenderPass {
    /** @type {import("playcanvas").BindGroup[]} */
    viewBindGroups = [];

    /** @type {Texture} */
    velocityTexture;

    constructor(device, scene, renderer, camera, depthBuffer, options) {
        super(device);
        this.scene = scene;
        this.renderer = renderer;
        this.camera = camera;

        this.setupRenderTarget(depthBuffer, options);
    }

    destroy() {
        super.destroy();
        this.renderTarget?.destroy();
        this.renderTarget = null;
        this.velocityTexture?.destroy();
        this.velocityTexture = null;

        this.viewBindGroups.forEach((bg) => {
            bg.defaultUniformBuffer.destroy();
            bg.destroy();
        });
        this.viewBindGroups.length = 0;
    }

    setupRenderTarget(depthBuffer, options) {

        const { device } = this;

        // TODO: only two channel texture is needed here, but that is not supported by WebGL
        const velocityFormat = device.getRenderableHdrFormat([PIXELFORMAT_RGBA32F, PIXELFORMAT_RGBA16F]);
        this.velocityTexture = new Texture(device, {
            name: 'VelocityTexture',
            width: 4,
            height: 4,
            format: velocityFormat,
            mipmaps: false,
            minFilter: FILTER_NEAREST,
            magFilter: FILTER_NEAREST,
            addressU: ADDRESS_CLAMP_TO_EDGE,
            addressV: ADDRESS_CLAMP_TO_EDGE
        });

        const renderTarget = new RenderTarget({
            name: 'PrepassRT',
            // colorBuffer: this.velocityTexture,
            depthBuffer: depthBuffer
        });

        this.init(renderTarget, options);
        this.depthStencilOps.storeDepth = true;
    }

    after() {

        // Assign the depth to the uniform. Note that the depth buffer is still used as a render
        // target in the following scene passes, and cannot be used as a texture inside those passes.
        this.device.scope.resolve(DEPTH_UNIFORM_NAME).setValue(this.renderTarget.depthBuffer);
        this.device.scope.resolve(VELOCITY_UNIFORM_NAME).setValue(this.velocityTexture);
    }

    execute() {

        const { renderer, scene, renderTarget } = this;
        const camera = this.camera.camera;
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

                    renderer.renderForwardLayer(camera, renderTarget, null, undefined, SHADER_PREPASS_VELOCITY, this.viewBindGroups, {
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
    }
}

export { RenderPassPrepass };
