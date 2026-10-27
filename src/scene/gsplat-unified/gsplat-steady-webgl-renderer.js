import { Debug } from '../../core/debug.js';
import { CULLFACE_NONE, SEMANTIC_POSITION, SHADERLANGUAGE_GLSL } from '../../platform/graphics/constants.js';
import { BLEND_NONE, BLEND_PREMULTIPLIED, GSPLAT_FORWARD } from '../constants.js';
import { getSTBNTexture } from '../graphics/noise-textures.js';
import { ShaderMaterial } from '../materials/shader-material.js';
import { Mesh } from '../mesh.js';
import { MeshInstance } from '../mesh-instance.js';
import { GSplatQuadRenderer } from './gsplat-quad-renderer.js';
import { GSplatSteadyWebglPass } from './gsplat-steady-webgl-pass.js';
import { GSplatSteadyView } from './gsplat-steady-view.js';
import sampleVS from '../shader-lib/glsl/chunks/gsplat/vert/gsplatSteady.js';
import noiseSource from '../shader-lib/glsl/chunks/gsplat/gsplat-steady-noise.js';
import samplePS from '../shader-lib/glsl/chunks/gsplat/frag/gsplatSteady.js';
import resolveVS from '../shader-lib/glsl/chunks/gsplat/vert/gsplatSteadyResolve.js';
import resolvePS from '../shader-lib/glsl/chunks/gsplat/frag/gsplatSteadyComposite.js';

/**
 * @import { GSplatRenderViewParams } from './gsplat-renderer.js'
 * @import { GSplatWorld } from './gsplat-world.js'
 * @import { GSplatWorldState } from './gsplat-world-state.js'
 * @import { GraphicsDevice } from '../../platform/graphics/graphics-device.js'
 * @import { GraphNode } from '../graph-node.js'
 * @import { Layer } from '../layer.js'
 * @import { ForwardRenderer } from '../renderer/forward-renderer.js'
 * @import { GSplatWorkBuffer } from './gsplat-work-buffer.js'
 */

/**
 * WebGL2 SteadySplats using native work-buffer texture reads, stochastic rasterization and
 * texture-based history. Supported views draw active allocation IDs without depth sorting.
 * The standard quad material remains available for picking, shadows and unsupported views.
 *
 * @see https://arxiv.org/abs/2610.05576 SteadySplats, Windisch et al. (2026).
 * @see https://github.com/MrNeRF/LichtFeld-Studio/pull/3728 Related native viewport implementation.
 *
 * @ignore
 */
class GSplatSteadyWebglRenderer extends GSplatQuadRenderer {
    /** @type {ShaderMaterial} */
    sampleMaterial;

    /** @type {ShaderMaterial} */
    resolveMaterial;

    /** @type {MeshInstance} */
    _sampleMesh;

    /** @type {MeshInstance} */
    _resolveMesh;

    /** @type {ForwardRenderer} */
    _forwardRenderer;

    /** @type {GSplatSteadyView} */
    _steadyView;

    /** @type {GSplatSteadyWebglPass|null} */
    steadyPass = null;

    /** @type {GSplatRenderViewParams} */
    _viewParams = /** @type {GSplatRenderViewParams} */ ({});

    /** @type {GSplatSteadyWebglPass[]} */
    _passes = [];

    _steadyActive = true;

    _nativeMaterialVersion = -1;

    _orderVersion = -1;

    _orderTextureSize = 0;

    _contentVersion = -1;

    _order = new Uint32Array(0);

    /** @type {Set<string>} */
    _sampleDefines = new Set();

    /**
     * @param {GraphicsDevice} device - Graphics device.
     * @param {GraphNode} node - Work-buffer node.
     * @param {GraphNode} cameraNode - Camera node.
     * @param {Layer} layer - Forward layer.
     * @param {GSplatWorkBuffer} workBuffer - Shared splat textures.
     * @param {ForwardRenderer} forwardRenderer - Forward renderer.
     */
    constructor(device, node, cameraNode, layer, workBuffer, forwardRenderer) {
        super(device, node, cameraNode, layer, workBuffer);
        this._forwardRenderer = forwardRenderer;
        this.sampleMaterial = new ShaderMaterial({
            uniqueName: 'GSplatSteadyGLSample',
            vertexGLSL: noiseSource + sampleVS,
            fragmentGLSL: noiseSource + samplePS,
            fragmentOutputTypes: ['vec4', 'uvec4', 'vec4'],
            attributes: { vertex_position: SEMANTIC_POSITION }
        });
        this.sampleMaterial.setParameter('steadyNoise', getSTBNTexture(device));
        this.sampleMaterial.cull = CULLFACE_NONE;
        this.sampleMaterial.blendType = BLEND_NONE;
        this.sampleMaterial.depthWrite = true;
        this._sampleMesh = new MeshInstance(this._quadMeshInstance.mesh, this.sampleMaterial, node);
        this._sampleMesh.setInstancing(true, true);
        this._sampleMesh.isVisibleFunc = this._quadMeshInstance.isVisibleFunc;
        this.resolveMaterial = new ShaderMaterial({
            uniqueName: 'GSplatSteadyGLComposite',
            vertexGLSL: resolveVS,
            fragmentGLSL: resolvePS,
            attributes: { vertex_position: SEMANTIC_POSITION }
        });
        this.resolveMaterial.cull = CULLFACE_NONE;
        this.resolveMaterial.blendType = BLEND_PREMULTIPLIED;
        this.resolveMaterial.depthWrite = false;
        const mesh = new Mesh(device);
        mesh.setPositions([-1, -1, 0, 1, -1, 0, -1, 1, 0, 1, 1, 0]);
        mesh.setIndices([0, 1, 2, 2, 1, 3]);
        mesh.update();
        this._resolveMesh = new MeshInstance(mesh, this.resolveMaterial, node);
        this._resolveMesh.cull = false;
        this._resolveMesh.pick = false;
        this._resolveMesh.isVisibleFunc = this._quadMeshInstance.isVisibleFunc;
        this.meshInstance = this._resolveMesh;
        this._steadyView = new GSplatSteadyView(SHADERLANGUAGE_GLSL, forwardRenderer,
            [this._quadMeshInstance, this._sampleMesh, this._resolveMesh]);
    }

    get requiresCpuSort() {
        return !this._steadyActive;
    }

    get deferForwardPreparation() {
        return this._steadyActive;
    }

    get material() {
        return this._steadyActive ? this.resolveMaterial : this._material;
    }

    get renderPasses() {
        return this._steadyActive && (this.renderMode & GSPLAT_FORWARD) && this.meshInstance.visible &&
            this.steadyPass?.needsRender ? this._passes : null;
    }

    get needsRender() {
        return !!(this._steadyActive && (this.renderMode & GSPLAT_FORWARD) && this.meshInstance.visible &&
            this.cameraNode.enabled && this.cameraNode.camera.enabled && this.layer.enabled &&
            this.steadyPass?.lastRenderVersion === this.device.renderVersion &&
            this.steadyPass?.requiresRender(this._viewParams));
    }

    /**
     * @param {GSplatRenderViewParams} params - View parameters.
     * @returns {boolean} Whether this view has a splat-only Gaussian coverage model.
     */
    supportsView(params) {
        return this._steadyView.supports(params);
    }

    /**
     * @param {GSplatRenderViewParams} params - Current view settings.
     */
    prepareFrame(params) {
        Object.assign(this._viewParams, params);
        // A shadow-only manager has no forward pass to populate the unsorted order texture.
        // Keep it on the native quad path, including its manager-owned sorter.
        const active = !!(this.renderMode & GSPLAT_FORWARD) && this.supportsView(params);
        if (active === this._steadyActive) return;
        if (this.renderMode & GSPLAT_FORWARD) this.layer.removeMeshInstances([this.meshInstance], true);
        this._steadyActive = active;
        this.meshInstance = active ? this._resolveMesh : this._quadMeshInstance;
        if (this.renderMode & GSPLAT_FORWARD) this.layer.addMeshInstances([this.meshInstance], true);
        this._orderVersion = -1;
        this.steadyPass?.resetHistory();
        if (!active && (this.renderMode & GSPLAT_FORWARD)) {
            Debug.warnOnce('GSplat SteadySplats: this WebGL2 view uses CPU sorting. Resampling requires a full-viewport, mono perspective camera, standard fragment coverage and no opaque mesh occluders.');
        }
    }

    /**
     * @param {GSplatWorld} world - Work-buffer owner.
     * @param {GSplatWorldState} worldState - Render-ready state.
     * @param {GSplatRenderViewParams} params - View parameters.
     * @returns {boolean} Whether this view has stochastic samples to render.
     */
    prepareRenderView(world, worldState, params) {
        Object.assign(this._viewParams, params);
        if (!worldState.totalActiveSplats) {
            this.meshInstance.visible = false;
            this.steadyPass?.resetHistory();
            return false;
        }
        const size = worldState.textureSize;
        if (this._orderVersion !== worldState.version || this._orderTextureSize !== size) {
            if (this._order.length !== size * size) this._order = new Uint32Array(size * size);
            let cursor = 0;
            const splats = worldState.splats;
            for (let i = 0; i < splats.length; i++) {
                const splat = splats[i];
                const intervals = splat.intervals;
                for (let j = 0; j < splat.intervalOffsets.length; j++) {
                    const offset = splat.intervalOffsets[j];
                    const count = intervals.length ? intervals[j * 2 + 1] - intervals[j * 2] : splat.activeSplats;
                    for (let k = 0; k < count; k++) this._order[cursor++] = offset + k;
                }
            }
            world.workBuffer.setOrderData(this._order);
            this._orderVersion = worldState.version;
            this._orderTextureSize = size;
        }
        const camera = this.cameraNode.camera;
        const target = camera.renderTarget;
        const width = params.width ?? (target ? target.width : this.device.width);
        const height = params.height ?? (target ? target.height : this.device.height);
        if (!this.steadyPass) {
            this.steadyPass = new GSplatSteadyWebglPass(this.device, this, this._forwardRenderer, this._sampleMesh);
            this._passes.push(this.steadyPass);
        }
        this.steadyPass.resize(width, height);
        if (this.steadyPass.samplePass.setColorOptions(params.gammaCorrection, params.toneMapping) ||
            this._contentVersion !== world.contentVersion) this.steadyPass.resetHistory();
        this._contentVersion = world.contentVersion;
        this.steadyPass.updateState(params, worldState.version);
        if (this.steadyPass.needsRender) this.steadyPass.update(params);
        return true;
    }

    update(count, textureSize) {
        super.update(count, textureSize);
        this._sampleMesh.instancingCount = this._quadMeshInstance.instancingCount;
        this._sampleMesh.visible = count > 0;
        this._resolveMesh.visible = count > 0;
        this.steadyPass?.resetHistory();
    }

    preparePickingView() {
        return this._quadMeshInstance;
    }

    frameUpdate(params) {
        super.frameUpdate(params);
        if (!this._steadyActive) return;
        this._quadMeshInstance.setCustomAabb(this.meshInstance.aabb);
        const material = this.sampleMaterial;
        const native = this._material;
        if (this._nativeMaterialVersion !== native.updateVersion) {
            for (const key of this._sampleDefines) {
                if (!native.defines.has(key)) material.setDefine(key, undefined);
            }
            this._sampleDefines.clear();
            native.defines.forEach((value, key) => {
                material.setDefine(key, value);
                this._sampleDefines.add(key);
            });
            material.shaderChunks.copy(native.shaderChunks);
            material.update();
            this._nativeMaterialVersion = native.updateVersion;
        }
        const parameters = native.parameters;
        for (const name in parameters) {
            if (Object.hasOwn(parameters, name)) material.setParameter(name, parameters[name].data);
        }
        this._viewParams.alphaClipForward = params.alphaClipForward;
        this._viewParams.steadyHistoryWeight = params.steadyHistoryWeight;
        this._viewParams.steadyConvergence = params.steadyConvergence;
        this._viewParams.steadyConvergenceFrames = params.steadyConvergenceFrames;
        this._viewParams.historyVersion = params.historyVersion;
        this.resolveMaterial.sceneTexturesWrite = params.sceneDepthWrite;
    }

    destroy() {
        this.steadyPass?.destroy();
        this.steadyPass = null;
        this._passes.length = 0;
        super.destroy();
        this._sampleMesh.destroy();
        this._resolveMesh.destroy();
        this.sampleMaterial.destroy();
        this.resolveMaterial.destroy();
    }
}

export { GSplatSteadyWebglRenderer };
