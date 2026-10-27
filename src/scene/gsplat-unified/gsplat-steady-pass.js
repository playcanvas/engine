import { Color } from '../../core/math/color.js';
import { Compute } from '../../platform/graphics/compute.js';
import { ComputePass } from '../../platform/graphics/compute-pass.js';
import { RenderTarget } from '../../platform/graphics/render-target.js';
import { Shader } from '../../platform/graphics/shader.js';
import { StorageBuffer } from '../../platform/graphics/storage-buffer.js';
import { Texture } from '../../platform/graphics/texture.js';
import {
    ADDRESS_CLAMP_TO_EDGE, FILTER_NEAREST, PIXELFORMAT_RGBA16F, PIXELFORMAT_RGBA32F,
    PIXELFORMAT_RG32U, RENDERTARGET_ORIGIN_TOP, SHADERLANGUAGE_WGSL
} from '../../platform/graphics/constants.js';
import { GSplatSteadyPassBase } from './gsplat-steady-pass-base.js';
import commonSource from '../shader-lib/wgsl/chunks/gsplat/gsplat-steady-common.js';
import historySource from '../shader-lib/wgsl/chunks/gsplat/compute-gsplat-steady-history.js';
import resolveSource from '../shader-lib/wgsl/chunks/gsplat/compute-gsplat-steady-resolve.js';

/**
 * @import { GraphicsDevice } from '../../platform/graphics/graphics-device.js'
 * @import { MeshInstance } from '../mesh-instance.js'
 * @import { GSplatSteadyRenderer } from './gsplat-steady-renderer.js'
 * @import { GSplatRenderViewParams } from './gsplat-renderer.js'
 * @import { ForwardRenderer } from '../renderer/forward-renderer.js'
 */

// Full-precision IDs/depth and packed half-float PDF ratios, plus the ring head and entry count.
const HISTORY_BYTES_PER_PIXEL = 4 * 16 + 4;
// Stay within WebGPU's minimum storage-binding limit without accessing backend handles.
// Separate row bands also avoid requiring an adapter's optional larger buffer limits at 4K.
const HISTORY_BUFFER_BYTES = 64 * 1024 * 1024;
const CONVERGENCE_BYTES_PER_PIXEL = 16;

/**
 * Per-camera/layer resources and ordered visibility, history and reconstruction passes.
 * The resolved image is composited by the renderer's forward mesh at the original layer position.
 *
 * @ignore
 */
class GSplatSteadyPass extends GSplatSteadyPassBase {
    /** @type {GSplatSteadyRenderer} */
    owner;

    /** @type {Texture[]} */
    textures = [];

    /** @type {Texture[]} */
    colors = [];

    /** @type {StorageBuffer[]} */
    historyBuffers = [];

    /** @type {Compute[]} */
    historyComputes = [];

    /** @type {StorageBuffer[]} */
    convergenceBuffers = [];

    /** @type {Compute[]} */
    convergenceComputes = [];

    /** @type {Shader[]} */
    shaders = [];

    /** @type {RenderTarget|null} */
    target = null;

    /** @type {Texture} */
    raw;

    /** @type {Texture} */
    samples;

    /** @type {Texture} */
    weights;

    /** @type {Compute[]} */
    _spatialComputes;

    /** @type {Compute[]} */
    _temporalComputes;

    // Perspective z/w coefficients recover device depth from the stored linear depth.
    _depthProjection = new Float32Array(4);

    /**
     * @param {GraphicsDevice} device - Graphics device.
     * @param {GSplatSteadyRenderer} owner - Renderer owning these resources.
     * @param {ForwardRenderer} forwardRenderer - Engine forward renderer.
     * @param {MeshInstance} sampleMesh - Indirect stochastic draw.
     */
    constructor(device, owner, forwardRenderer, sampleMesh) {
        super(device, owner.cameraNode, owner.sampleMaterial, forwardRenderer, sampleMesh);
        this.owner = owner;
        this.historyShader = this._createShader('GSplatSteadyHistory', commonSource + historySource);
        this.spatialCompute = new Compute(device, this._createShader('GSplatSteadySpatial', resolveSource));
        this.temporalCompute = new Compute(device, this._createShader('GSplatSteadyTemporal', resolveSource,
            new Map([['STEADY_TEMPORAL', '']])));
        this.convergenceShader = this._createShader('GSplatSteadyConvergence', resolveSource,
            new Map([['STEADY_TEMPORAL', ''], ['STEADY_CONVERGENCE', '']]));
        this._spatialComputes = [this.spatialCompute];
        this._temporalComputes = [this.temporalCompute];
        this.historyPass = new ComputePass(device, this.historyComputes);
        this.historyPass.name = 'GSplatSteadyHistory';
        this.resolvePass = new ComputePass(device, this._spatialComputes);
        this.resolvePass.name = 'GSplatSteadyResolve';
        this.beforePasses.push(this.samplePass, this.historyPass, this.resolvePass);
    }

    /**
     * @param {string} name - Shader name.
     * @param {string} source - Compute shader source.
     * @param {Map<string, string>} [defines] - Compute shader defines.
     * @returns {Shader} Owned shader.
     * @private
     */
    _createShader(name, source, defines) {
        const shader = new Shader(this.device, { name, shaderLanguage: SHADERLANGUAGE_WGSL, cshader: source, cdefines: defines });
        this.shaders.push(shader);
        return shader;
    }

    /**
     * @param {string} name - Texture name.
     * @param {number} format - Pixel format.
     * @param {boolean} [storage] - Whether the texture supports storage writes.
     * @returns {Texture} Owned texture.
     * @private
     */
    _createTexture(name, format, storage = false) {
        const result = new Texture(this.device, {
            name,
            width: this.width,
            height: this.height,
            format,
            storage,
            mipmaps: false,
            minFilter: FILTER_NEAREST,
            magFilter: FILTER_NEAREST,
            addressU: ADDRESS_CLAMP_TO_EDGE,
            addressV: ADDRESS_CLAMP_TO_EDGE
        });
        this.textures.push(result);
        return result;
    }

    /**
     * @param {boolean} enabled - Whether to allocate temporal color history.
     * @private
     */
    _setTemporalEnabled(enabled) {
        if (enabled && this.colors.length === 1) {
            this.colors.push(this._createTexture('GSplatSteadyHistory1', PIXELFORMAT_RGBA16F, true));
        } else if (!enabled && this.colors.length === 2) {
            const texture = this.colors.pop();
            this.textures.splice(this.textures.indexOf(texture), 1);
            texture.destroy();
        }
        if (this._temporal !== enabled) {
            this._temporal = enabled;
            this.writeIndex = 0;
            this.resetHistory();
        }
        this._selectResolveComputes();
    }

    /** @private */
    _selectResolveComputes() {
        this.resolvePass.computes = this._temporal ?
            (this._convergence ? this.convergenceComputes : this._temporalComputes) : this._spatialComputes;
    }

    /**
     * @param {boolean} temporal - Whether to allocate temporal color history.
     * @param {boolean} convergence - Whether to allocate stationary averages.
     * @protected
     */
    _configureResolve(temporal, convergence) {
        this._setTemporalEnabled(temporal);
        this._setConvergenceEnabled(convergence);
    }

    /**
     * @param {boolean} enabled - Whether to allocate stationary averages.
     * @private
     */
    _setConvergenceEnabled(enabled) {
        if (enabled && !this.convergenceBuffers.length && this.width && this.height) {
            const rowsPerBuffer = Math.max(1, Math.floor(HISTORY_BUFFER_BYTES / (this.width * CONVERGENCE_BYTES_PER_PIXEL)));
            for (let row = 0; row < this.height; row += rowsPerBuffer) {
                const rows = Math.min(rowsPerBuffer, this.height - row);
                const buffer = new StorageBuffer(this.device, this.width * rows * CONVERGENCE_BYTES_PER_PIXEL);
                buffer.name = 'GSplatSteadyConvergence';
                this.convergenceBuffers.push(buffer);
                const compute = new Compute(this.device, this.convergenceShader, 'GSplatSteadyConvergence');
                this._bindResolve(compute);
                compute.setParameter('steadySamples', this.samples);
                compute.setParameter('steadyRowStart', row);
                compute.setParameter('steadyRowCount', rows);
                compute.setParameter('steadyRest', buffer);
                compute.setupDispatch(Math.ceil(this.width / 8), Math.ceil(rows / 8), 1);
                this.convergenceComputes.push(compute);
            }
        } else if (!enabled) {
            this._destroyConvergenceResources();
        }
        if (enabled !== this._convergence) {
            this._convergence = enabled;
            this.resetHistory();
        }
        this._selectResolveComputes();
    }

    /**
     * Recreates only size-dependent resources. The compute pipelines and sample sequence survive.
     *
     * @param {number} width - Render width.
     * @param {number} height - Render height.
     */
    resize(width, height) {
        if (width === this.width && height === this.height) return;
        this._destroyFrameResources();
        this.width = width;
        this.height = height;
        this._size[0] = width;
        this._size[1] = height;
        this.raw = this._createTexture('GSplatSteadyRaw', PIXELFORMAT_RGBA16F);
        this.samples = this._createTexture('GSplatSteadySamples', PIXELFORMAT_RG32U);
        this.weights = this._createTexture('GSplatSteadyWeights', PIXELFORMAT_RGBA32F, true);
        this.colors.push(this._createTexture('GSplatSteadyHistory0', PIXELFORMAT_RGBA16F, true));
        this._setTemporalEnabled(this._temporal);
        this.target = new RenderTarget({ name: 'GSplatSteadySamples',
            colorBuffers: [this.raw, this.samples],
            depth: true,
            samples: 1,
            origin: RENDERTARGET_ORIGIN_TOP });
        this.samplePass.init(this.target);
        const clear = new Color(0, 0, 0, 0);
        this.samplePass.setClearColor(clear, 0);
        this.samplePass.setClearColor(clear, 1);
        this.samplePass.setClearDepth(1);
        this.samplePass.colorArrayOps[0].store = true;
        this.samplePass.colorArrayOps[1].store = true;

        const rowsPerBuffer = Math.max(1, Math.floor(HISTORY_BUFFER_BYTES / (width * HISTORY_BYTES_PER_PIXEL)));
        for (let row = 0; row < height; row += rowsPerBuffer) {
            const rows = Math.min(rowsPerBuffer, height - row);
            const history = new StorageBuffer(this.device, width * rows * HISTORY_BYTES_PER_PIXEL);
            history.name = 'GSplatSteadyOccluders';
            this.historyBuffers.push(history);
            const compute = new Compute(this.device, this.historyShader, 'GSplatSteadyHistory');
            compute.setParameter('steadyRowStart', row);
            compute.setParameter('steadyRowCount', rows);
            compute.setParameter('steadyHistory', history);
            compute.setParameter('steadySamples', this.samples);
            compute.setParameter('steadyWeights', this.weights);
            compute.setupDispatch(Math.ceil(width / 8), Math.ceil(rows / 8), 1);
            this.historyComputes.push(compute);
        }
        this._bindResolve(this.spatialCompute);
        this._bindResolve(this.temporalCompute);
        this.temporalCompute.setParameter('steadySamples', this.samples);
        this._setConvergenceEnabled(this._convergence);
        this.writeIndex = 0;
        this.resetHistory();
    }

    /**
     * @param {Compute} compute - Reconstruction compute to bind.
     * @private
     */
    _bindResolve(compute) {
        compute.setParameter('steadySize', this._size);
        compute.setParameter('steadyRaw', this.raw);
        compute.setParameter('steadyWeights', this.weights);
        compute.setupDispatch(Math.ceil(this.width / 8), Math.ceil(this.height / 8), 1);
    }

    /**
     * @param {GSplatRenderViewParams} params - Current scene and camera parameters.
     */
    update(params) {
        const { owner } = this;
        owner.sampleMaterial.setParameter('steadySize', this._size);
        owner.sampleMaterial.setParameter('steadyCacheStride', owner._cacheStride);
        owner.sampleMaterial.setParameter('alphaClipForward', params.alphaClipForward);
        for (let i = 0; i < this.historyComputes.length; i++) {
            const compute = this.historyComputes[i];
            compute.setParameter('steadySize', this._size);
            compute.setParameter('steadyCacheStride', owner._cacheStride);
            compute.setParameter('alphaClipForward', params.alphaClipForward);
            compute.setParameter('steadyValid', this.valid ? 1 : 0);
            compute.setParameter('projCache', owner.projector.projCache);
            compute.setParameter('steadyIds', owner.projector.sortKeys);
        }
        const computes = this.resolvePass.computes;
        for (let i = 0; i < computes.length; i++) {
            const compute = computes[i];
            if (this._temporal) {
                compute.setParameter('steadyValid', this.valid ? 1 : 0);
                compute.setParameter('steadyCameraStill', this.stationary ? 1 : 0);
                compute.setParameter('steadyRetention', this.retention);
                compute.setParameter('steadyBackground', this._background);
                compute.setParameter('steadyInverseProjection', this._inverseProjection.data);
                compute.setParameter('steadyInverseView', this.owner.cameraNode.getWorldTransform().data);
                compute.setParameter('steadyPreviousViewProjection', this._previousViewProjection.data);
                compute.setParameter('steadyPrevious', this.colors[1 - this.writeIndex]);
            }
            if (this._convergence) {
                compute.setParameter('steadyRestFrames', this.restFrames);
            }
            compute.setParameter('steadyOutput', this.colors[this.writeIndex]);
        }
        owner.resolveMaterial.setParameter('steadyImage', this.colors[this.writeIndex]);
        owner.resolveMaterial.setParameter('steadySamples', this.samples);
        const projection = this._projection.data;
        this._depthProjection[0] = projection[10];
        this._depthProjection[1] = projection[14];
        this._depthProjection[2] = projection[11];
        this._depthProjection[3] = projection[15];
        owner.resolveMaterial.setParameter('steadyDepthProjection', this._depthProjection);
    }

    execute() {
        super.execute();
        if (this._temporal) this.writeIndex = 1 - this.writeIndex;
    }

    /** @private */
    _destroyConvergenceResources() {
        for (let i = 0; i < this.convergenceComputes.length; i++) this.convergenceComputes[i].destroy();
        this.convergenceComputes.length = 0;
        for (let i = 0; i < this.convergenceBuffers.length; i++) this.convergenceBuffers[i].destroy();
        this.convergenceBuffers.length = 0;
    }

    /** @private */
    _destroyFrameResources() {
        this._destroyConvergenceResources();
        for (let i = 0; i < this.historyComputes.length; i++) this.historyComputes[i].destroy();
        this.historyComputes.length = 0;
        for (let i = 0; i < this.historyBuffers.length; i++) this.historyBuffers[i].destroy();
        this.historyBuffers.length = 0;
        this.target?.destroy();
        this.target = null;
        for (let i = 0; i < this.textures.length; i++) this.textures[i].destroy();
        this.textures.length = 0;
        this.colors.length = 0;
    }

    destroy() {
        this._destroyFrameResources();
        this.historyPass.destroy();
        this.resolvePass.destroy();
        this.spatialCompute.destroy();
        this.temporalCompute.destroy();
        for (let i = 0; i < this.shaders.length; i++) this.shaders[i].destroy();
        this.shaders.length = 0;
        super.destroy();
    }
}

export { GSplatSteadyPass };
