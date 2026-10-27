import { Debug } from '../../core/debug.js';
import { Mat4 } from '../../core/math/mat4.js';
import { SEMANTIC_POSITION, CULLFACE_NONE, SHADERLANGUAGE_WGSL } from '../../platform/graphics/constants.js';
import { BLEND_NONE, BLEND_PREMULTIPLIED, GSPLAT_FORWARD } from '../constants.js';
import { GSplatResourceBase } from '../gsplat/gsplat-resource-base.js';
import { Mesh } from '../mesh.js';
import { MeshInstance } from '../mesh-instance.js';
import { ShaderMaterial } from '../materials/shader-material.js';
import { getSTBNTexture } from '../graphics/noise-textures.js';
import { GSplatHybridRenderer } from './gsplat-hybrid-renderer.js';
import { GSplatProjector } from './gsplat-projector.js';
import { GSplatSteadyCompaction } from './gsplat-steady-compaction.js';
import { GSplatSteadyPass } from './gsplat-steady-pass.js';
import { GSplatSteadyView } from './gsplat-steady-view.js';
import commonSource from '../shader-lib/wgsl/chunks/gsplat/gsplat-steady-common.js';
import noiseSource from '../shader-lib/wgsl/chunks/gsplat/gsplat-steady-noise.js';
import sampleVS from '../shader-lib/wgsl/chunks/gsplat/vert/gsplatSteady.js';
import samplePS from '../shader-lib/wgsl/chunks/gsplat/frag/gsplatSteady.js';
import resolveVS from '../shader-lib/wgsl/chunks/gsplat/vert/gsplatSteadyResolve.js';
import resolvePS from '../shader-lib/wgsl/chunks/gsplat/frag/gsplatSteadyResolve.js';

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

const noSortIndirectInfo = new Uint32Array(4);

/**
 * SteadySplats inference using the hybrid renderer's culling, projection cache, picking and
 * stable work-buffer IDs. A depth-tested stochastic draw replaces the radix sort; per-camera
 * passes reconstruct a premultiplied image for the normal forward layer.
 *
 * @see https://arxiv.org/abs/2610.05576 SteadySplats, Windisch et al. (2026).
 * @see https://github.com/MrNeRF/LichtFeld-Studio/pull/3728 Related native viewport implementation.
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

    /** @type {GSplatSteadyView} */
    _steadyView;

    /** @type {GSplatRenderViewParams} */
    _viewParams = /** @type {GSplatRenderViewParams} */ ({});

    /** @type {GSplatSteadyPass[]} */
    _passes = [];

    _steadyActive = false;

    _contentVersion = -1;

    _projectionValid = false;

    _projectionView = new Mat4();

    _projectionMatrix = new Mat4();

    /** @type {GSplatRenderViewParams} */
    _projectionParams = /** @type {GSplatRenderViewParams} */ ({});

    _projectionMaterialVersion = -1;

    _projectionWorldVersion = -1;

    _projectionContentVersion = -1;

    _projectionWidth = 0;

    _projectionHeight = 0;

    /** @type {GSplatSteadyCompaction|null} */
    _steadyCompaction = null;

    /** @type {Parameters<GSplatProjector['dispatch']>[0]} */
    _projectorParams = /** @type {Parameters<GSplatProjector['dispatch']>[0]} */ ({
        stochastic: true,
        radialSort: false,
        numBits: 0,
        minDist: 0,
        maxDist: 1
    });

    /** @type {Set<string>} */
    _sampleUserDefines = new Set();

    _sampleChunksKey = '';

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
            vertexWGSL: commonSource + noiseSource + sampleVS,
            fragmentWGSL: commonSource + noiseSource + samplePS,
            fragmentOutputTypes: ['vec4', 'uvec4'],
            attributes: { vertex_position: SEMANTIC_POSITION }
        });
        this.sampleMaterial.setDefine('{GSPLAT_INSTANCE_SIZE}', GSplatResourceBase.instanceSize);
        this.sampleMaterial.setParameter('steadyNoise', getSTBNTexture(device));
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
        this._steadyView = new GSplatSteadyView(SHADERLANGUAGE_WGSL, forwardRenderer, [this._sampleMesh, this._resolveMesh]);
    }

    get material() {
        return this._steadyActive ? this.resolveMaterial : this._material;
    }

    get renderPasses() {
        return this._steadyActive && (this.renderMode & GSPLAT_FORWARD) && this._sampleMesh.visible &&
            this.steadyPass?.needsRender ? this._passes : null;
    }

    get needsRender() {
        return !!(this._steadyActive && (this.renderMode & GSPLAT_FORWARD) && this._sampleMesh.visible &&
            this.cameraNode.enabled && this.cameraNode.camera.enabled && this.layer.enabled &&
            this.steadyPass?.lastRenderVersion === this.device.renderVersion &&
            this.steadyPass?.requiresRender(this._viewParams));
    }

    get deferForwardPreparation() {
        return this._steadyActive;
    }

    /**
     * @param {GSplatRenderViewParams} params - Current view settings.
     */
    prepareFrame(params) {
        this._setSteadyActive(this.supportsView(params));
        Object.assign(this._viewParams, params);
    }

    /**
     * Views whose projection or fragment coverage cannot be evaluated by the resampling PDF
     * retain the existing sorted path. In particular, custom alpha must never use a Gaussian PDF.
     *
     * @param {GSplatRenderViewParams} params - View parameters.
     * @returns {boolean} True when the view supports importance resampling.
     */
    supportsView(params) {
        return this._steadyView.supports(params);
    }

    /**
     * @param {boolean} active - Whether to composite a reconstructed image in the forward layer.
     * @private
     */
    _setSteadyActive(active) {
        if (active === this._steadyActive) return;
        const forward = !!(this.renderMode & GSPLAT_FORWARD);
        if (forward) this.layer.removeMeshInstances([this.meshInstance], true);
        this._steadyActive = active;
        this._projectionValid = false;
        this.meshInstance = active ? this._resolveMesh : this._sampleMesh;
        this._sampleMesh.material = active ? this.sampleMaterial : this._material;
        if (forward) this.layer.addMeshInstances([this.meshInstance], true);
        this.steadyPass?.resetHistory();
    }

    /**
     * @param {GSplatWorld} world - Current work-buffer owner.
     * @param {GSplatWorldState} worldState - Render-ready world state.
     * @param {GSplatRenderViewParams} params - Current scene and view settings.
     * @returns {boolean} True when the view contains active splats.
     */
    prepareRenderView(world, worldState, params) {
        const supported = this.supportsView(params);
        this._setSteadyActive(supported);
        Object.assign(this._viewParams, params);
        this._viewParams.stochastic = supported;
        if (!supported) {
            Debug.warnOnce('GSplat SteadySplats: this view uses GPU sorting. Resampling requires a full-viewport, mono camera with standard perspective depth, standard fragment coverage and no opaque mesh occluders.');
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
        const width = params.width ?? (target ? target.width : this.device.width);
        const height = params.height ?? (target ? target.height : this.device.height);
        if (!this.steadyPass) {
            this.steadyPass = new GSplatSteadyPass(this.device, this, this._forwardRenderer, this._sampleMesh);
            this._passes.push(this.steadyPass);
        }
        const steady = this.steadyPass;
        steady.resize(width, height);
        if (steady.samplePass.setColorOptions(params.gammaCorrection, params.toneMapping) ||
            this._contentVersion !== world.contentVersion) steady.resetHistory();
        this._contentVersion = world.contentVersion;
        steady.updateState(params, worldState.version);
        if (!steady.needsRender) return true;

        const previous = this._projectionParams;
        const sceneCamera = camera.camera;
        const reuse = this._projectionValid && steady.valid &&
            this._projectionWidth === width && this._projectionHeight === height &&
            this._projectionWorldVersion === worldState.version && this._projectionContentVersion === world.contentVersion &&
            this._projectionMatrix.equals(sceneCamera.projectionMatrix) && this._projectionView.equals(sceneCamera.viewMatrix) &&
            previous.material === params.material && this._projectionMaterialVersion === params.material.updateVersion &&
            previous.alphaClipForward === params.alphaClipForward && previous.antiAlias === params.antiAlias &&
            previous.minPixelSize === params.minPixelSize && previous.minContribution === params.minContribution &&
            previous.foveationStrength === params.foveationStrength && previous.foveationCenter === params.foveationCenter;
        if (reuse) {
            // Device indirect slots are transient. Only the private projector data survives frames;
            // regenerate the small draw record without rerunning culling, compaction or projection.
            this.indirectDrawSlot = this.device.getIndirectDrawSlot(1);
            this.projector.writeIndirectArgs(this.indirectDrawSlot, 0, this._steadyCompaction.numSplatsBuffer,
                this._steadyCompaction.sortElementCountBuffer, noSortIndirectInfo);
        } else {
            this._project(world, worldState, params, width, height);
        }
        this._sampleMesh.setIndirect(null, this.indirectDrawSlot, 1);
        this._sampleMesh.instancingCount = 1;
        this._sampleMesh.visible = true;
        this.meshInstance.visible = true;
        steady.update(params);
        return true;
    }

    /**
     * @param {GSplatWorld} world - Current work-buffer owner.
     * @param {GSplatWorldState} worldState - Render-ready state.
     * @param {GSplatRenderViewParams} params - Projection settings.
     * @param {number} width - Render width.
     * @param {number} height - Render height.
     * @private
     */
    _project(world, worldState, params, width, height) {
        this._steadyCompaction ??= new GSplatSteadyCompaction(this.device, this._scratch);
        this.projector ??= new GSplatProjector(this.device);
        const compaction = this._steadyCompaction;
        const projector = this.projector;
        compaction.uploadIntervals(worldState);

        if (world.hasBounds) {
            const state = world.getState(world.currentVersion);
            if (state) this._runFrustumCulling(world, state, this.cameraNode, params);
        }
        compaction.dispatchCompact(world.workBuffer.frustumCuller, compaction.numIntervals,
            worldState.totalActiveSplats, false);

        this.indirectDrawSlot = this.device.getIndirectDrawSlot(1);
        this.indirectDispatchSlot = this.device.getIndirectDispatchSlot(1);
        compaction.writeIndirectArgs(this.indirectDrawSlot, this.indirectDispatchSlot,
            compaction.numIntervals, noSortIndirectInfo);

        // The projector is shared with native picking. SteadySplats supplies its own compacted
        // candidates and consumes stable IDs directly, without entering the sort pipeline.
        const projection = this._projectorParams;
        projection.workBuffer = world.workBuffer;
        projection.cameraNode = this.cameraNode;
        projection.compactedSplatIds = compaction.compactedSplatIds;
        projection.sortElementCountBuffer = compaction.sortElementCountBuffer;
        projection.totalCapacity = worldState.totalActiveSplats;
        projection.alphaClip = Math.max(1 / 255, params.alphaClipForward);
        projection.minPixelSize = params.minPixelSize * 0.5;
        projection.minContribution = params.minContribution;
        projection.foveationStrength = params.foveationStrength;
        projection.foveationCenter = params.foveationCenter;
        projection.viewportWidth = width;
        projection.viewportHeight = height;
        projection.antiAlias = params.antiAlias;
        projection.material = params.material;
        projection.userCacheWords = params.varyings.words;
        projector.dispatch(projection);
        projector.writeIndirectArgs(this.indirectDrawSlot, this.indirectDispatchSlot + 1,
            compaction.numSplatsBuffer, compaction.sortElementCountBuffer, noSortIndirectInfo);
        this.sampleMaterial.setParameter('projCache', this.projector.projCache);
        this.sampleMaterial.setParameter('sortedIndices', projector.sortKeys);
        this.sampleMaterial.setParameter('numSplatsStorage', compaction.numSplatsBuffer);
        this._computeClipToViewZ(this.cameraNode, this._clipToViewZ);
        this.sampleMaterial.setParameter('clipToViewZ', this._clipToViewZ);
        const camera = this.cameraNode.camera.camera;
        this._projectionView.copy(camera.viewMatrix);
        this._projectionMatrix.copy(camera.projectionMatrix);
        Object.assign(this._projectionParams, params);
        this._projectionMaterialVersion = params.material.updateVersion;
        this._projectionWorldVersion = worldState.version;
        this._projectionContentVersion = world.contentVersion;
        this._projectionWidth = width;
        this._projectionHeight = height;
        this._projectionValid = true;
    }

    /**
     * @param {GSplatWorld} world - Work-buffer owner.
     * @param {GSplatWorldState} worldState - Render-ready state.
     * @param {GSplatRenderViewParams} params - Picking view settings.
     * @returns {MeshInstance|null} Native picking mesh.
     */
    preparePickingView(world, worldState, params) {
        // Native picking overwrites the forward projector's private cache.
        this._projectionValid = false;
        return super.preparePickingView(world, worldState, params);
    }

    invalidateCullUpload() {
        super.invalidateCullUpload();
        this._steadyCompaction?.invalidateUpload();
        this._projectionValid = false;
    }

    update(count, textureSize) {
        super.update(count, textureSize);
        this._projectionValid = false;
        this.steadyPass?.resetHistory();
    }

    frameUpdate(params) {
        super.frameUpdate(params);
        if (this._steadyActive) {
            this._viewParams.alphaClipForward = params.alphaClipForward;
            this._viewParams.steadyHistoryWeight = params.steadyHistoryWeight;
            this._viewParams.steadyConvergence = params.steadyConvergence;
            this._viewParams.steadyConvergenceFrames = params.steadyConvergenceFrames;
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
        }
    }

    /**
     * @param {ShaderMaterial} sourceMaterial - Scene material template.
     */
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
        this._steadyCompaction?.destroy();
        this._steadyCompaction = null;
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
