import { Color } from '../../core/math/color.js';
import { RenderTarget } from '../../platform/graphics/render-target.js';
import { Texture } from '../../platform/graphics/texture.js';
import { FILTER_NEAREST, PIXELFORMAT_RGBA16F, PIXELFORMAT_RGBA32F, PIXELFORMAT_RGBA32U, SEMANTIC_POSITION } from '../../platform/graphics/constants.js';
import { RenderPassShaderQuad } from '../graphics/render-pass-shader-quad.js';
import { ShaderUtils } from '../shader-lib/shader-utils.js';
import { GSplatSteadyPassBase } from './gsplat-steady-pass-base.js';
import commonSource from '../shader-lib/glsl/chunks/gsplat/gsplat-steady-common.js';
import historySource from '../shader-lib/glsl/chunks/gsplat/frag/gsplatSteadyHistory.js';
import resolveSource from '../shader-lib/glsl/chunks/gsplat/frag/gsplatSteadyResolve.js';

/**
 * @import { GraphicsDevice } from '../../platform/graphics/graphics-device.js'
 * @import { ScopeId } from '../../platform/graphics/scope-id.js'
 * @import { Shader } from '../../platform/graphics/shader.js'
 * @import { MeshInstance } from '../mesh-instance.js'
 * @import { ForwardRenderer } from '../renderer/forward-renderer.js'
 * @import { GSplatRenderViewParams } from './gsplat-renderer.js'
 * @import { GSplatSteadyWebglRenderer } from './gsplat-steady-webgl-renderer.js'
 */

const HISTORY_PARAMETERS = ['steadyHistory0', 'steadyHistory1', 'steadyHistory2', 'steadyHistory3'];

/**
 * @typedef {number|number[]|Float32Array|Texture} SteadyUniformValue
 * @ignore
 */

/**
 * Full-screen reconstruction pass with instance-owned uniform bindings.
 *
 * @ignore
 */
class GSplatSteadyWebglQuadPass extends RenderPassShaderQuad {
    /** @type {Map<string, {scope: ScopeId, data: SteadyUniformValue}>} */
    parameters = new Map();

    /**
     * @param {string} name - Uniform name.
     * @param {SteadyUniformValue} data - Uniform value.
     */
    setParameter(name, data) {
        const existing = this.parameters.get(name);
        if (existing) {
            existing.data = data;
        } else {
            this.parameters.set(name, { scope: this.device.scope.resolve(name), data });
        }
    }

    execute() {
        for (const parameter of this.parameters.values()) parameter.scope.setValue(parameter.data);
        super.execute();
    }
}

/**
 * WebGL2 stochastic visibility, texture FIFO, spatial reuse and temporal reconstruction.
 * Uses engine render passes and textures throughout; no native WebGL calls are required.
 *
 * @ignore
 */
class GSplatSteadyWebglPass extends GSplatSteadyPassBase {
    /** @type {GSplatSteadyWebglRenderer} */
    owner;

    /** @type {Texture[]} */
    textures = [];

    /** @type {Texture[]} */
    colors = [];

    /** @type {Texture[][]} */
    histories = [[], []];

    /** @type {Texture[]} */
    averages = [];

    /** @type {RenderTarget[]} */
    targets = [];

    /** @type {RenderTarget[]} */
    resolveTargets = [];

    /** @type {Texture} */
    raw;

    /** @type {Texture} */
    samples;

    /** @type {Texture} */
    gaussians;

    /** @type {GSplatSteadyWebglQuadPass[]} */
    _activePasses = [];

    /**
     * @param {GraphicsDevice} device - Graphics device.
     * @param {GSplatSteadyWebglRenderer} owner - Owning renderer.
     * @param {ForwardRenderer} forwardRenderer - Forward renderer.
     * @param {MeshInstance} sampleMesh - Stochastic sample mesh.
     */
    constructor(device, owner, forwardRenderer, sampleMesh) {
        super(device, owner.cameraNode, owner.sampleMaterial, forwardRenderer, sampleMesh);
        this.owner = owner;
        this.historyPasses = [new GSplatSteadyWebglQuadPass(device), new GSplatSteadyWebglQuadPass(device)];
        this.resolvePasses = [new GSplatSteadyWebglQuadPass(device), new GSplatSteadyWebglQuadPass(device)];
        const historyShader = this._createShader('GSplatSteadyGLHistory', historySource, false, false,
            ['uvec4', 'uvec4', 'uvec4', 'uvec4']);
        for (let i = 0; i < 2; i++) {
            this.historyPasses[i].name = 'GSplatSteadyHistory';
            this.historyPasses[i].shader = historyShader;
            this.resolvePasses[i].name = 'GSplatSteadyResolve';
        }
        this.beforePasses.push(this.samplePass, this.historyPasses[0], this.resolvePasses[0]);
    }

    /**
     * @param {string} name - Shader cache name.
     * @param {string} source - Fragment source.
     * @param {boolean} [temporal] - Whether to include temporal reuse.
     * @param {boolean} [convergence] - Whether to include stationary convergence.
     * @param {string|string[]} [outputs] - Attachment output types.
     * @returns {Shader} Cached shader.
     * @private
     */
    _createShader(name, source, temporal = false, convergence = false, outputs = 'vec4') {
        const defines = new Map();
        if (temporal) defines.set('STEADY_TEMPORAL', '');
        if (convergence) defines.set('STEADY_CONVERGENCE', '');
        return ShaderUtils.createShader(this.device, {
            uniqueName: name,
            attributes: { aPosition: SEMANTIC_POSITION },
            vertexChunk: 'quadVS',
            fragmentGLSL: commonSource + source,
            fragmentDefines: defines,
            fragmentOutputTypes: outputs
        });
    }

    /**
     * @param {string} name - Texture name.
     * @param {number} format - Pixel format.
     * @returns {Texture} The allocated texture.
     * @private
     */
    _createTexture(name, format) {
        const texture = new Texture(this.device, {
            name,
            width: this.width,
            height: this.height,
            format,
            minFilter: FILTER_NEAREST,
            magFilter: FILTER_NEAREST,
            mipmaps: false
        });
        this.textures.push(texture);
        return texture;
    }

    _destroyResolveTargets() {
        for (const target of this.resolveTargets) target.destroy();
        this.resolveTargets.length = 0;
        for (const texture of [...this.colors, ...this.averages]) {
            this.textures.splice(this.textures.indexOf(texture), 1);
            texture.destroy();
        }
        this.colors.length = 0;
        this.averages.length = 0;
    }

    /**
     * @param {boolean} temporal - Whether to enable temporal reuse.
     * @param {boolean} convergence - Whether to allocate stationary averages.
     * @protected
     */
    _configureResolve(temporal, convergence) {
        if (this.colors.length && this._temporal === temporal && this._convergence === convergence) return;
        this._destroyResolveTargets();
        this._temporal = temporal;
        this._convergence = convergence;
        const shader = this._createShader(`GSplatSteadyGL${convergence ? 'Convergence' : temporal ? 'Temporal' : 'Spatial'}`,
            resolveSource, temporal, convergence);
        const count = temporal ? 2 : 1;
        for (let i = 0; i < count; i++) this.colors.push(this._createTexture(`GSplatSteadyColor${i}`, PIXELFORMAT_RGBA16F));
        if (convergence) {
            for (let i = 0; i < 2; i++) this.averages.push(this._createTexture(`GSplatSteadyRest${i}`, PIXELFORMAT_RGBA32F));
        }
        for (let i = 0; i < 2; i++) {
            const colorBuffers = [this.colors[temporal ? i : 0]];
            if (convergence) colorBuffers.push(this.averages[i]);
            const target = new RenderTarget({ colorBuffers, depth: false, samples: 1 });
            this.resolveTargets.push(target);
            const pass = this.resolvePasses[i];
            pass.shader = shader;
            pass.init(target);
        }
        this.resetHistory();
    }

    /**
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
        this.samples = this._createTexture('GSplatSteadySamples', PIXELFORMAT_RGBA32U);
        this.gaussians = this._createTexture('GSplatSteadyGaussians', PIXELFORMAT_RGBA32F);
        const target = new RenderTarget({ colorBuffers: [this.raw, this.samples, this.gaussians], depth: true, samples: 1 });
        this.targets.push(target);
        this.samplePass.init(target);
        const clear = new Color(0, 0, 0, 0);
        for (let i = 0; i < 3; i++) {
            this.samplePass.setClearColor(clear, i);
            this.samplePass.colorArrayOps[i].store = true;
        }
        this.samplePass.setClearDepth(1);
        for (let i = 0; i < 2; i++) {
            for (let k = 0; k < 4; k++) this.histories[i].push(this._createTexture(`GSplatSteadyFIFO${i}_${k}`, PIXELFORMAT_RGBA32U));
            const historyTarget = new RenderTarget({ colorBuffers: this.histories[i], depth: false, samples: 1 });
            this.targets.push(historyTarget);
            this.historyPasses[i].init(historyTarget);
        }
        this._configureResolve(this._temporal, this._convergence);
        this.writeIndex = 0;
        this.resetHistory();
    }

    /**
     * @param {GSplatRenderViewParams} params - Current view settings.
     */
    update(params) {
        const { owner } = this;
        const index = this.writeIndex;
        const historyPass = this.historyPasses[index];
        const resolvePass = this.resolvePasses[index];
        this.beforePasses[1] = historyPass;
        this.beforePasses[2] = resolvePass;
        this._activePasses[0] = historyPass;
        this._activePasses[1] = resolvePass;
        for (const pass of this._activePasses) {
            pass.setParameter('steadySize', this._size);
            pass.setParameter('alphaClipForward', params.alphaClipForward);
            pass.setParameter('steadyValid', this.valid ? 1 : 0);
            pass.setParameter('steadySamples', this.samples);
            pass.setParameter('steadyGaussians', this.gaussians);
            for (let k = 0; k < 4; k++) pass.setParameter(HISTORY_PARAMETERS[k], this.histories[1 - index][k]);
        }
        resolvePass.setParameter('steadyRaw', this.raw);
        if (this._temporal) {
            resolvePass.setParameter('steadyCameraStill', this.stationary ? 1 : 0);
            resolvePass.setParameter('steadyRetention', this.retention);
            resolvePass.setParameter('steadyBackground', this._background);
            resolvePass.setParameter('steadyInverseProjection', this._inverseProjection.data);
            resolvePass.setParameter('steadyInverseView', owner.cameraNode.getWorldTransform().data);
            resolvePass.setParameter('steadyPreviousViewProjection', this._previousViewProjection.data);
            resolvePass.setParameter('steadyPrevious', this.colors[1 - index]);
        }
        if (this._convergence) {
            resolvePass.setParameter('steadyRest', this.averages[1 - index]);
            resolvePass.setParameter('steadyRestFrames', this.restFrames);
        }
        owner.resolveMaterial.setParameter('steadyImage', this.colors[this._temporal ? index : 0]);
        owner.resolveMaterial.setParameter('steadySamples', this.samples);
        owner.resolveMaterial.setParameter('steadyProjection', this._projection.data);
    }

    execute() {
        super.execute();
        this.writeIndex = 1 - this.writeIndex;
    }

    _destroyFrameResources() {
        this._destroyResolveTargets();
        for (const target of this.targets) target.destroy();
        this.targets.length = 0;
        for (const texture of this.textures) texture.destroy();
        this.textures.length = 0;
        for (const history of this.histories) history.length = 0;
    }

    destroy() {
        this._destroyFrameResources();
        for (const pass of this.historyPasses) pass.destroy();
        for (const pass of this.resolvePasses) pass.destroy();
        super.destroy();
    }
}

export { GSplatSteadyWebglPass };
