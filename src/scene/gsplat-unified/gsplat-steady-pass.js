import { Color } from '../../core/math/color.js';
import { Mat4 } from '../../core/math/mat4.js';
import { Compute } from '../../platform/graphics/compute.js';
import { ComputePass } from '../../platform/graphics/compute-pass.js';
import { FramePass } from '../../platform/graphics/frame-pass.js';
import { RenderPass } from '../../platform/graphics/render-pass.js';
import { RenderTarget } from '../../platform/graphics/render-target.js';
import { Shader } from '../../platform/graphics/shader.js';
import { StorageBuffer } from '../../platform/graphics/storage-buffer.js';
import { Texture } from '../../platform/graphics/texture.js';
import {
    ADDRESS_CLAMP_TO_EDGE, FILTER_NEAREST, PIXELFORMAT_RGBA16F, PIXELFORMAT_RGBA32F,
    PIXELFORMAT_RGBA32U, RENDERTARGET_ORIGIN_TOP, SHADERLANGUAGE_WGSL
} from '../../platform/graphics/constants.js';
import { SHADER_FORWARD } from '../constants.js';
import { Camera } from '../camera.js';
import commonSource from '../shader-lib/wgsl/chunks/gsplat/gsplat-steady-common.js';
import historySource from '../shader-lib/wgsl/chunks/gsplat/compute-gsplat-steady-history.js';
import spatialSource from '../shader-lib/wgsl/chunks/gsplat/compute-gsplat-steady-spatial.js';
import temporalSource from '../shader-lib/wgsl/chunks/gsplat/compute-gsplat-steady-temporal.js';

/**
 * @import { GraphicsDevice } from '../../platform/graphics/graphics-device.js'
 * @import { MeshInstance } from '../mesh-instance.js'
 * @import { ShaderMaterial } from '../materials/shader-material.js'
 * @import { GSplatSteadyRenderer } from './gsplat-steady-renderer.js'
 * @import { GSplatRenderViewParams } from './gsplat-renderer.js'
 * @import { ForwardRenderer } from '../renderer/forward-renderer.js'
 */

// Four FIFO entries of one ID, one depth and four PDF ratios, all 32-bit.
const HISTORY_BYTES_PER_PIXEL = 4 * 24;
// Stay within WebGPU's minimum storage-binding limit without accessing backend handles.
// Separate row bands also avoid requiring an adapter's optional larger buffer limits at 4K.
const HISTORY_BUFFER_BYTES = 64 * 1024 * 1024;

/**
 * Rasterizes stochastic splat IDs and color using the engine's forward drawing and indirect draw.
 *
 * @ignore
 */
class GSplatSteadySamplePass extends RenderPass {
    /** @type {GSplatSteadyPass} */
    owner;

    /** @type {{meshInstances: MeshInstance[]}} */
    drawOptions;

    constructor(device, owner, meshInstance) {
        super(device);
        this.owner = owner;
        this.drawOptions = { meshInstances: [meshInstance] };
        this.name = 'GSplatSteadySample';
    }

    execute() {
        const { owner } = this;
        owner.forwardRenderer.renderForwardLayer(owner.owner.cameraNode.camera.camera,
            this.renderTarget, null, false, SHADER_FORWARD, this.drawOptions);
    }
}

/**
 * Per-camera/layer resources and ordered visibility, history, spatial and temporal passes.
 * The resolved image is composited by the renderer's forward mesh at the original layer position.
 *
 * @ignore
 */
class GSplatSteadyPass extends FramePass {
    /** @type {GSplatSteadyRenderer} */
    owner;

    /** @type {ForwardRenderer} */
    forwardRenderer;

    /** @type {GSplatSteadySamplePass} */
    samplePass;

    /** @type {Texture[]} */
    textures = [];

    /** @type {Texture[]} */
    colors = [];

    /** @type {StorageBuffer[]} */
    historyBuffers = [];

    /** @type {Compute[]} */
    historyComputes = [];

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

    /** @type {Texture} */
    spatial;

    width = 0;

    height = 0;

    frame = 0;

    valid = false;

    writeIndex = 0;

    historyVersion = -1;

    worldVersion = -1;

    lastRenderVersion = -1;

    _size = new Float32Array(2);

    _projection = new Mat4();

    _inverseProjection = new Mat4();

    _viewProjection = new Mat4();

    _previousViewProjection = new Mat4();

    _previousProjection = new Mat4();

    /** @type {number} */
    _materialVersion = -1;

    _alphaClipForward = -1;

    /**
     * @param {GraphicsDevice} device - Graphics device.
     * @param {GSplatSteadyRenderer} owner - Renderer owning these resources.
     * @param {ForwardRenderer} forwardRenderer - Engine forward renderer.
     * @param {MeshInstance} sampleMesh - Indirect stochastic draw.
     */
    constructor(device, owner, forwardRenderer, sampleMesh) {
        super(device);
        this.name = 'GSplatSteady';
        this.owner = owner;
        this.forwardRenderer = forwardRenderer;
        this.samplePass = new GSplatSteadySamplePass(device, this, sampleMesh);
        this.historyShader = this._createShader('GSplatSteadyHistory', commonSource + historySource);
        this.spatialCompute = new Compute(device, this._createShader('GSplatSteadySpatial', spatialSource));
        this.temporalCompute = new Compute(device, this._createShader('GSplatSteadyTemporal', temporalSource));
        this.historyPass = new ComputePass(device, this.historyComputes);
        this.historyPass.name = 'GSplatSteadyHistory';
        this.spatialPass = new ComputePass(device, [this.spatialCompute]);
        this.spatialPass.name = 'GSplatSteadySpatial';
        this.temporalPass = new ComputePass(device, [this.temporalCompute]);
        this.temporalPass.name = 'GSplatSteadyTemporal';
        this.beforePasses.push(this.samplePass, this.historyPass, this.spatialPass, this.temporalPass);
        device.on('devicelost', this.resetHistory, this);
        device.on('devicerestored', this.resetHistory, this);
    }

    /** @private */
    _createShader(name, source) {
        const shader = new Shader(this.device, { name, shaderLanguage: SHADERLANGUAGE_WGSL, cshader: source });
        this.shaders.push(shader);
        return shader;
    }

    resetHistory() {
        this.valid = false;
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
        const texture = (name, format, storage = false) => {
            const result = new Texture(this.device, {
                name,
                width,
                height,
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
        };
        this.raw = texture('GSplatSteadyRaw', PIXELFORMAT_RGBA16F);
        this.samples = texture('GSplatSteadySamples', PIXELFORMAT_RGBA32U);
        this.weights = texture('GSplatSteadyWeights', PIXELFORMAT_RGBA32F, true);
        this.spatial = texture('GSplatSteadySpatial', PIXELFORMAT_RGBA16F, true);
        this.colors = [texture('GSplatSteadyHistory0', PIXELFORMAT_RGBA16F, true),
            texture('GSplatSteadyHistory1', PIXELFORMAT_RGBA16F, true)];
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
        this.spatialCompute.setParameter('steadySize', this._size);
        this.spatialCompute.setParameter('steadyRaw', this.raw);
        this.spatialCompute.setParameter('steadyWeights', this.weights);
        this.spatialCompute.setParameter('steadySpatial', this.spatial);
        this.spatialCompute.setupDispatch(Math.ceil(width / 8), Math.ceil(height / 8), 1);
        this.temporalCompute.setParameter('steadySize', this._size);
        this.temporalCompute.setParameter('steadyRaw', this.raw);
        this.temporalCompute.setParameter('steadySamples', this.samples);
        this.temporalCompute.setParameter('steadySpatial', this.spatial);
        this.temporalCompute.setupDispatch(Math.ceil(width / 8), Math.ceil(height / 8), 1);
        this.writeIndex = 0;
        this.resetHistory();
    }

    /**
     * @param {GSplatRenderViewParams} params - Current scene and camera parameters.
     * @param {number} worldVersion - Version defining stable work-buffer identities.
     */
    update(params, worldVersion) {
        const camera = this.owner.cameraNode.camera.camera;
        Camera.applyShaderProjectionTransform(camera.projectionMatrix, this._projection, false, true);
        this._inverseProjection.invert(this._projection);
        this._viewProjection.mul2(this._projection, camera.viewMatrix);
        const lensChanged = !this._projection.equals(this._previousProjection);
        const materialChanged = this._materialVersion !== params.material.updateVersion;
        const missedFrame = this.lastRenderVersion !== this.device.renderVersion - 1;
        if (lensChanged || materialChanged || missedFrame || params.alphaClipForward !== this._alphaClipForward || worldVersion !== this.worldVersion ||
            params.historyVersion !== this.historyVersion) {
            this.resetHistory();
        }
        const { owner } = this;
        owner.sampleMaterial.setParameter('steadySize', this._size);
        owner.sampleMaterial.setParameter('steadyCacheStride', owner._cacheStride);
        owner.sampleMaterial.setParameter('alphaClipForward', params.alphaClipForward);
        owner.sampleMaterial.setParameter('steadyFrame', this.frame >>> 0);
        for (let i = 0; i < this.historyComputes.length; i++) {
            const compute = this.historyComputes[i];
            compute.setParameter('steadySize', this._size);
            compute.setParameter('steadyCacheStride', owner._cacheStride);
            compute.setParameter('alphaClipForward', params.alphaClipForward);
            compute.setParameter('steadyValid', this.valid ? 1 : 0);
            compute.setParameter('projCache', owner.projector.projCache);
        }
        const retention = Number.isFinite(params.steadyHistoryWeight) ? Math.max(0, Math.min(0.9999999, params.steadyHistoryWeight)) : 0.7;
        this.temporalCompute.setParameter('steadyValid', this.valid ? 1 : 0);
        this.temporalCompute.setParameter('steadyRetention', retention);
        this.temporalCompute.setParameter('steadyInverseProjection', this._inverseProjection.data);
        this.temporalCompute.setParameter('steadyInverseView', this.owner.cameraNode.getWorldTransform().data);
        this.temporalCompute.setParameter('steadyPreviousViewProjection', this._previousViewProjection.data);
        this.temporalCompute.setParameter('steadyPrevious', this.colors[1 - this.writeIndex]);
        this.temporalCompute.setParameter('steadyOutput', this.colors[this.writeIndex]);
        owner.resolveMaterial.setParameter('steadyImage', this.colors[this.writeIndex]);
        owner.resolveMaterial.setParameter('steadySamples', this.samples);
        this.historyVersion = params.historyVersion;
        this.worldVersion = worldVersion;
        this._materialVersion = params.material.updateVersion;
        this._alphaClipForward = params.alphaClipForward;
    }

    execute() {
        this.valid = true;
        this.frame++;
        this.writeIndex = 1 - this.writeIndex;
        this._previousViewProjection.copy(this._viewProjection);
        this._previousProjection.copy(this._projection);
        this.lastRenderVersion = this.device.renderVersion;
    }

    /** @private */
    _destroyFrameResources() {
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
        this.device.off('devicelost', this.resetHistory, this);
        this.device.off('devicerestored', this.resetHistory, this);
        this._destroyFrameResources();
        this.samplePass.destroy();
        this.historyPass.destroy();
        this.spatialPass.destroy();
        this.temporalPass.destroy();
        this.spatialCompute.destroy();
        this.temporalCompute.destroy();
        for (let i = 0; i < this.shaders.length; i++) this.shaders[i].destroy();
        this.shaders.length = 0;
        super.destroy();
    }
}

export { GSplatSteadyPass };
