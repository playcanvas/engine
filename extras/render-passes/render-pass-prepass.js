import {
    LAYERID_DEPTH,
    SHADER_DEPTH,
    RenderPass,
    RenderTarget
} from "playcanvas";

const tempMeshInstances = [];

// uniform name of the depth texture
const DEPTH_UNIFORM_NAME = 'uSceneDepthMap';

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

    constructor(device, scene, renderer, camera, depthBuffer, options) {
        super(device);
        this.scene = scene;
        this.renderer = renderer;
        this.camera = camera;

        this.setupRenderTarget(depthBuffer, options);
    }

    destroy() {
        super.destroy();
        this.releaseRenderTarget(this.renderTarget);

        this.viewBindGroups.forEach((bg) => {
            bg.defaultUniformBuffer.destroy();
            bg.destroy();
        });
        this.viewBindGroups.length = 0;
    }

    setupRenderTarget(depthBuffer, options) {

        const renderTarget = new RenderTarget({
            name: 'PrepassRT',
            depthBuffer: depthBuffer
        });

        this.init(renderTarget, options);
        this.depthStencilOps.storeDepth = true;
    }

    before() {

        // Assign the depth to the uniform. Note that the depth buffer is still used as a render
        // target in the following scene passes, and cannot be used as a texture inside those passes.
        this.device.scope.resolve(DEPTH_UNIFORM_NAME).setValue(this.renderTarget.depthBuffer);
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

                    renderer.renderForwardLayer(camera, renderTarget, null, undefined, SHADER_DEPTH, this.viewBindGroups, {
                        meshInstances: tempMeshInstances
                    });

                    tempMeshInstances.length = 0;
                }
            }
        }
    }

    frameUpdate() {
        // depth clear value (1 or no clear) set up each frame
        const { camera } = this;
        this.setClearDepth(camera.clearDepthBuffer ? 1 : undefined);
    }
}

export { RenderPassPrepass };
