import { Debug } from '../../core/debug.js';
import { SEMANTIC_POSITION, CULLFACE_NONE, SHADERLANGUAGE_WGSL } from '../../platform/graphics/constants.js';
import { BLEND_NONE, BLEND_PREMULTIPLIED, GSPLAT_FORWARD, PROJECTION_PERSPECTIVE } from '../constants.js';
import { GSplatResourceBase } from '../gsplat/gsplat-resource-base.js';
import { Mesh } from '../mesh.js';
import { MeshInstance } from '../mesh-instance.js';
import { ShaderMaterial } from '../materials/shader-material.js';
import { GSplatHybridRenderer } from './gsplat-hybrid-renderer.js';
import { GSplatSteadyPass } from './gsplat-steady-pass.js';
import commonSource from '../shader-lib/wgsl/chunks/gsplat/gsplat-steady-common.js';
import sampleVS from '../shader-lib/wgsl/chunks/gsplat/vert/gsplatSteady.js';
import samplePS from '../shader-lib/wgsl/chunks/gsplat/frag/gsplatSteady.js';
import resolveVS from '../shader-lib/wgsl/chunks/gsplat/vert/gsplatSteadyResolve.js';
import resolvePS from '../shader-lib/wgsl/chunks/gsplat/frag/gsplatSteadyResolve.js';

// Projection modifiers run in the shared projector; output modifiers run before resampling.
const supportedChunks = new Set([
    'gsplatModifyVS', 'gsplatOutputVS', 'decodePS', 'gammaPS', 'fogPS', 'fogMathPS', 'tonemappingPS'
]);

/**
 * @import { GraphicsDevice } from '../../platform/graphics/graphics-device.js'
 * @import { GraphNode } from '../graph-node.js'
 * @import { Layer } from '../layer.js'
 * @import { GSplatWorkBuffer } from './gsplat-work-buffer.js'
 * @import { GSplatHybridRendererScratch } from './gsplat-hybrid-renderer-scratch.js'
 * @import { GSplatWorld } from './gsplat-world.js'
 * @import { GSplatWorldState } from './gsplat-world-state.js'
 * @import { GSplatRenderViewParams } from './gsplat-renderer.js'
 * @import { ForwardRenderer } from '../renderer/forward-renderer.js'
 */

/**
 * SteadySplats inference using the hybrid renderer's culling, projection cache, picking and
 * stable work-buffer IDs. A depth-tested stochastic draw replaces the radix sort; per-camera
 * passes reconstruct a premultiplied image for the normal forward layer.
 *
 * @ignore
 */
class GSplatSteadyRenderer extends GSplatHybridRenderer {
    /** @type {ShaderMaterial} */
    sampleMaterial;

    /** @type {ShaderMaterial} */
    resolveMaterial;

    /** @type {MeshInstance} */
    _sampleMesh;

    /** @type {MeshInstance} */
    _resolveMesh;

    /** @type {GSplatSteadyPass|null} */
    steadyPass = null;

    /** @type {ForwardRenderer} */
    _forwardRenderer;

    /** @type {GSplatRenderViewParams} */
    _viewParams = /** @type {GSplatRenderViewParams} */ ({});

    /** @type {GSplatSteadyPass[]} */
    _passes = [];

    _steadyActive = false;

    _worldVersion = -1;

    /** @type {Set<string>} */
    _sampleUserDefines = new Set();

    _sampleChunksKey = '';

    _coverageChunksKey;

    _coverageSupported = true;

    /**
     * @param {GraphicsDevice} device - Graphics device.
     * @param {GraphNode} node - Splat world node.
     * @param {GraphNode} cameraNode - View camera node.
     * @param {Layer} layer - Forward layer.
     * @param {GSplatWorkBuffer} workBuffer - Shared splat data.
     * @param {GSplatHybridRendererScratch|null} scratch - Shared culling scratch.
     * @param {ForwardRenderer} forwardRenderer - Engine forward renderer.
     */
    constructor(device, node, cameraNode, layer, workBuffer, scratch, forwardRenderer) {
        super(device, node, cameraNode, layer, workBuffer, scratch);
        this._forwardRenderer = forwardRenderer;
        this._sampleMesh = this.meshInstance;
        this.sampleMaterial = new ShaderMaterial({
            uniqueName: 'GSplatSteadySample',
            vertexWGSL: commonSource + sampleVS,
            fragmentWGSL: commonSource + samplePS,
            fragmentOutputTypes: ['vec4', 'uvec4'],
            attributes: { vertex_position: SEMANTIC_POSITION }
        });
        this.sampleMaterial.setDefine('{GSPLAT_INSTANCE_SIZE}', GSplatResourceBase.instanceSize);
        this.sampleMaterial.cull = CULLFACE_NONE;
        this.sampleMaterial.blendType = BLEND_NONE;
        this.sampleMaterial.depthWrite = true;
        this.sampleMaterial.update();
        this.resolveMaterial = new ShaderMaterial({
            uniqueName: 'GSplatSteadyResolve',
            vertexWGSL: resolveVS,
            fragmentWGSL: resolvePS,
            attributes: { vertex_position: SEMANTIC_POSITION }
        });
        this.resolveMaterial.cull = CULLFACE_NONE;
        this.resolveMaterial.blendType = BLEND_PREMULTIPLIED;
        this.resolveMaterial.depthWrite = false;
        this.resolveMaterial.update();
        const mesh = new Mesh(device);
        mesh.setPositions([-1, -1, 0, 1, -1, 0, -1, 1, 0, 1, 1, 0]);
        mesh.setIndices([0, 1, 2, 2, 1, 3]);
        mesh.update();
        this._resolveMesh = new MeshInstance(mesh, this.resolveMaterial, node);
        this._resolveMesh.cull = false;
        this._resolveMesh.pick = false;
        this._resolveMesh.isVisibleFunc = this._sampleMesh.isVisibleFunc;
    }

    get material() {
        return this._steadyActive ? this.resolveMaterial : this._material;
    }

    get renderPasses() {
        return this._steadyActive && (this.renderMode & GSPLAT_FORWARD) && this._sampleMesh.visible ? this._passes : null;
    }

    /**
     * Views whose projection or fragment coverage cannot be evaluated by the resampling PDF
     * retain the existing sorted path. In particular, custom alpha must never use a Gaussian PDF.
     *
     * @param {GSplatRenderViewParams} params - View parameters.
     * @returns {boolean} True when the view supports importance resampling.
     */
    supportsView(params) {
        const camera = params.cameraNode.camera.camera;
        const rect = camera.rect;
        const chunks = params.material.hasShaderChunks ? params.material.getShaderChunks(SHADERLANGUAGE_WGSL) : null;
        const chunksKey = chunks?.key;
        if (chunksKey !== this._coverageChunksKey) {
            this._coverageChunksKey = chunksKey;
            this._coverageSupported = true;
            if (chunks) {
                for (const name of chunks.keys()) {
                    if (!supportedChunks.has(name)) {
                        this._coverageSupported = false;
                        break;
                    }
                }
            }
        }
        return this._coverageSupported && (!params.material.hasShaderChunks || params.material.shaderChunks.useWGSL) &&
            !camera.xrActive && camera.projection === PROJECTION_PERSPECTIVE && !params.fisheye &&
            rect.x === 0 && rect.y === 0 && rect.z === 1 && rect.w === 1 &&
            !params.varyings.words && !this._material.getDefine('GSPLAT_OVERDRAW') &&
            !camera.clippingPlanes?.length && !this._hasDepthGeometry(camera);
    }

    /**
     * The minimal PDF contains splat occluders only. An opaque mesh would change the target
     * acceptance probability, so retain sorted rendering until scene-depth proposals are supported.
     * Visibility callbacks exclude the other cameras' GSplat meshes on the same layer.
     *
     * @param {import('../camera.js').Camera} camera - The view camera.
     * @returns {boolean} True when non-splat geometry can write this camera's depth.
     * @private
     */
    _hasDepthGeometry(camera) {
        const composition = this._forwardRenderer.scene.layers;
        for (let i = 0; i < camera.layers.length; i++) {
            const layer = composition.getLayerById(camera.layers[i]);
            if (layer?.enabled) {
                const meshes = layer.meshInstances;
                for (let j = 0; j < meshes.length; j++) {
                    const mesh = meshes[j];
                    if (mesh !== this._sampleMesh && mesh !== this._resolveMesh && mesh.visible &&
                        mesh.material.depthWrite &&
                        (!mesh.isVisibleFunc || mesh.isVisibleFunc(camera))) {
                        return true;
                    }
                }
            }
        }
        return false;
    }

    /** @private */
    _setSteadyActive(active) {
        if (active === this._steadyActive) return;
        const forward = !!(this.renderMode & GSPLAT_FORWARD);
        if (forward) this.layer.removeMeshInstances([this.meshInstance], true);
        this._steadyActive = active;
        this.meshInstance = active ? this._resolveMesh : this._sampleMesh;
        this._sampleMesh.material = active ? this.sampleMaterial : this._material;
        if (forward) this.layer.addMeshInstances([this.meshInstance], true);
        this.steadyPass?.resetHistory();
    }

    /**
     * @param {GSplatWorld} world - Current work-buffer owner.
     * @param {GSplatWorldState} worldState - Render-ready world state.
     * @param {GSplatRenderViewParams} params - Current scene and view settings.
     * @returns {boolean} True when projection ran.
     */
    prepareRenderView(world, worldState, params) {
        const supported = this.supportsView(params);
        this._setSteadyActive(supported);
        Object.assign(this._viewParams, params);
        this._viewParams.stochastic = supported;
        if (!supported) {
            Debug.warnOnce('GSplat SteadySplats: this view uses GPU sorting. Resampling requires a full-viewport, mono perspective camera, standard fragment coverage and no opaque mesh occluders.');
            return super.prepareRenderView(world, worldState, this._viewParams);
        }
        if (!worldState.totalActiveSplats) {
            this.meshInstance.visible = false;
            this._sampleMesh.visible = false;
            this.steadyPass?.resetHistory();
            return false;
        }
        const camera = this.cameraNode.camera;
        const target = camera.renderTarget;
        const width = target ? target.width : this.device.width;
        const height = target ? target.height : this.device.height;
        const indices = this.sortAndProjectForCamera(world, worldState, this.cameraNode, width, height,
            Math.max(1 / 255, params.alphaClipForward), false, false, this._viewParams);
        this.sampleMaterial.setParameter('projCache', this.projector.projCache);
        this.sampleMaterial.setParameter('sortedIndices', indices);
        this.sampleMaterial.setParameter('numSplatsStorage', this.intervalCompaction.numSplatsBuffer);
        this._computeClipToViewZ(this.cameraNode, this._clipToViewZ);
        this.sampleMaterial.setParameter('clipToViewZ', this._clipToViewZ);
        this._sampleMesh.setIndirect(null, this.indirectDrawSlot, 1);
        this._sampleMesh.instancingCount = 1;
        this._sampleMesh.visible = true;
        this.meshInstance.visible = true;
        if (!this.steadyPass) {
            this.steadyPass = new GSplatSteadyPass(this.device, this, this._forwardRenderer, this._sampleMesh);
            this._passes.push(this.steadyPass);
        }
        this.steadyPass.resize(width, height);
        this._worldVersion = worldState.version;
        if (world.bufferCopyUploaded > 0) this.steadyPass.resetHistory();
        return true;
    }

    update(count, textureSize) {
        super.update(count, textureSize);
        this.steadyPass?.resetHistory();
    }

    frameUpdate(params) {
        super.frameUpdate(params);
        if (this._steadyActive) {
            this._viewParams.alphaClipForward = params.alphaClipForward;
            this._viewParams.steadyHistoryWeight = params.steadyHistoryWeight;
            this._viewParams.historyVersion = params.historyVersion;
            this._viewParams.material = params.material;
            this.resolveMaterial.sceneTexturesWrite = params.sceneDepthWrite;
            const noFog = !params.useFog;
            const noTonemap = !params.useTonemap;
            if (this.sampleMaterial.getDefine('GSPLAT_NO_FOG') !== noFog ||
                this.sampleMaterial.getDefine('GSPLAT_NO_TONEMAP') !== noTonemap) {
                this.sampleMaterial.setDefine('GSPLAT_NO_FOG', noFog);
                this.sampleMaterial.setDefine('GSPLAT_NO_TONEMAP', noTonemap);
                this.sampleMaterial.update();
            }
            this.steadyPass?.update(this._viewParams, this._worldVersion);
        }
    }

    copyMaterialSettings(sourceMaterial) {
        super.copyMaterialSettings(sourceMaterial);
        const material = this.sampleMaterial;
        for (const key of this._sampleUserDefines) {
            if (!sourceMaterial.defines.has(key)) material.setDefine(key, undefined);
        }
        this._sampleUserDefines.clear();
        sourceMaterial.defines.forEach((value, key) => {
            material.setDefine(key, value);
            this._sampleUserDefines.add(key);
        });
        const parameters = sourceMaterial.parameters;
        for (const name in parameters) {
            if (Object.hasOwn(parameters, name)) material.setParameter(name, parameters[name].data);
        }
        if (sourceMaterial.hasShaderChunks && this._sampleChunksKey !== sourceMaterial.shaderChunks.key) {
            material.shaderChunks.copy(sourceMaterial.shaderChunks);
            this._sampleChunksKey = sourceMaterial.shaderChunks.key;
        }
        material.update();
    }

    destroy() {
        this.steadyPass?.destroy();
        this.steadyPass = null;
        this._passes.length = 0;
        const inactiveMesh = this._steadyActive ? this._sampleMesh : this._resolveMesh;
        inactiveMesh.destroy();
        super.destroy();
        this.sampleMaterial.destroy();
        this.resolveMaterial.destroy();
    }
}

export { GSplatSteadyRenderer };
