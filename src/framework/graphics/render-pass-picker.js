import { DebugGraphics } from '../../platform/graphics/debug-graphics.js';
import { BlendState } from '../../platform/graphics/blend-state.js';
import { RenderPass } from '../../platform/graphics/render-pass.js';
import { UNIFORMTYPE_MAT4 } from '../../platform/graphics/constants.js';
import { UniformBufferFormat, UniformFormat } from '../../platform/graphics/uniform-buffer-format.js';
import { SHADER_PICK, SHADER_DEPTH_PICK } from '../../scene/constants.js';

/**
 * @import { CameraComponent } from '../components/camera/component.js'
 * @import { Scene } from '../../scene/scene.js'
 * @import { Layer } from '../../scene/layer.js'
 * @import { MeshInstance } from '../../scene/mesh-instance.js'
 * @import { GSplatComponent } from '../components/gsplat/component.js'
 */

const tempMeshInstances = [];
const lights = [[], [], []];

/**
 * A render pass implementing rendering of mesh instances into a pick buffer.
 *
 * @ignore
 */
class RenderPassPicker extends RenderPass {
    /** @type {BlendState} */
    blendState = BlendState.NOBLEND;

    /** @type {CameraComponent} */
    camera;

    /** @type {Scene} */
    scene;

    /** @type {Layer[]} */
    layers;

    /** @type {Map<number, MeshInstance | GSplatComponent>} */
    mapping;

    /** @type {boolean} */
    depth;

    /** @type {number[]} */
    _qualifiedLayerIndices = [];

    /** @type {Map<number, MeshInstance|null>} */
    _pickMeshInstances = new Map();

    /**
     * Minimal view uniform format used by the picker. The pick shaders only need the view
     * projection (and the view matrix for depth picking); any other view uniform a shader happens
     * to reference falls back to the per-mesh uniform buffer automatically. This avoids pulling in
     * the full forward view format (and its lighting / shadow uniforms) which the picker does not
     * need.
     *
     * @type {UniformBufferFormat|null}
     */
    _viewUniformFormat = null;

    constructor(device, renderer) {
        super(device);
        this.renderer = renderer;
    }

    getViewUniformFormat() {
        if (!this._viewUniformFormat) {
            this._viewUniformFormat = new UniformBufferFormat(this.device, [
                new UniformFormat('matrix_viewProjection', UNIFORMTYPE_MAT4),
                new UniformFormat('matrix_view', UNIFORMTYPE_MAT4)
            ]);
        }
        return this._viewUniformFormat;
    }

    /**
     * @param {CameraComponent} camera - The camera component used for picking.
     * @param {Scene} scene - The scene to pick from.
     * @param {Layer[]} layers - The layers to pick from.
     * @param {Map<number, MeshInstance | GSplatComponent>} mapping - Map to store ID to object mappings.
     * @param {boolean} depth - Whether to render depth information.
     */
    update(camera, scene, layers, mapping, depth) {
        this.camera = camera;
        this.scene = scene;
        this.layers = layers;
        this.mapping = mapping;
        this.depth = depth;

        if (scene.clusteredLightingEnabled) {
            this.emptyWorldClusters = this.renderer.worldClustersAllocator.empty;
        }
    }

    // Filter qualifying layers and prepare gsplat pick mesh instances for the compute-based
    // renderer. The execute() loop iterates the pre-built list instead of re-filtering.
    before() {
        this._qualifiedLayerIndices.length = 0;
        this._pickMeshInstances.clear();

        const { camera, scene, layers } = this;
        const srcLayers = scene.layers.layerList;
        const subLayerEnabled = scene.layers.subLayerEnabled;

        const gsplatDirector = this.renderer.gsplatDirector;
        const pickerWidth = this.renderTarget?.width ?? 1;
        const pickerHeight = this.renderTarget?.height ?? 1;

        for (let i = 0; i < srcLayers.length; i++) {
            const srcLayer = srcLayers[i];
            if (layers && layers.indexOf(srcLayer) < 0) continue;
            if (!srcLayer.enabled || !subLayerEnabled[i]) continue;
            if (!srcLayer.camerasSet.has(camera.camera)) continue;

            // store the index of the layers we need to render
            this._qualifiedLayerIndices.push(i);

            // kick off a compute tiled renderer for the gsplat manager on this layer, and store the mesh instance
            // which copies the results to the pick buffer
            if (gsplatDirector) {
                const pickMI = gsplatDirector.prepareForPicking(camera.camera, pickerWidth, pickerHeight, srcLayer);
                if (pickMI) {
                    this._pickMeshInstances.set(i, pickMI);
                }
            }
        }
    }

    execute() {
        const device = this.device;

        const { renderer, camera, scene, mapping, renderTarget } = this;
        const srcLayers = scene.layers.layerList;
        const isTransparent = scene.layers.subLayerList;

        for (const i of this._qualifiedLayerIndices) {
            const srcLayer = srcLayers[i];
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

            // Inject gsplat pick mesh instance for this layer (compute-based renderer only)
            const pickMI = this._pickMeshInstances.get(i);
            if (pickMI) {
                tempMeshInstances.push(pickMI);
            }

            // Process gsplat placements when ID is enabled
            // The gsplat unified mesh instance is already handled above (added to layer.meshInstances)
            // Here we just need to add the placement ID -> component mapping
            if (scene.gsplat.enableIds) {
                const placements = srcLayer.gsplatPlacements;
                for (let j = 0; j < placements.length; j++) {
                    const placement = placements[j];
                    const component = placement.node?.gsplat;
                    if (component) {
                        mapping.set(placement.id, component);
                    }
                }
            }

            if (tempMeshInstances.length > 0) {

                // render the mesh instances through the standard forward layer path, using the
                // picker's own minimal view uniform format; it sets up the camera and view uniforms,
                // and the callback forces the picker blend state per mesh
                const shaderPass = this.depth ? SHADER_DEPTH_PICK : SHADER_PICK;
                renderer.renderForwardLayer(camera.camera, renderTarget, null, undefined, shaderPass, {
                    meshInstances: tempMeshInstances,
                    splitLights: lights,
                    lightClusters: this.emptyWorldClusters,
                    viewUniformFormat: device.supportsUniformBuffers ? this.getViewUniformFormat() : undefined,
                    drawCallback: () => device.setBlendState(this.blendState)
                });

                tempMeshInstances.length = 0;
            }

            DebugGraphics.popGpuMarker(device);
        }
    }
}

export { RenderPassPicker };
