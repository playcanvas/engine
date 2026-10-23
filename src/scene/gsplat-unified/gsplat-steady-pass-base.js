import { Mat4 } from '../../core/math/mat4.js';
import { FramePass } from '../../platform/graphics/frame-pass.js';
import { Camera } from '../camera.js';
import { GSplatSteadySamplePass } from './gsplat-steady-sample-pass.js';

/**
 * @import { GraphicsDevice } from '../../platform/graphics/graphics-device.js'
 * @import { GraphNode } from '../graph-node.js'
 * @import { MeshInstance } from '../mesh-instance.js'
 * @import { ShaderMaterial } from '../materials/shader-material.js'
 * @import { ForwardRenderer } from '../renderer/forward-renderer.js'
 * @import { GSplatRenderViewParams } from './gsplat-renderer.js'
 */

const convergenceFrames = value => Math.max(1, Math.min(1024, Math.floor(Number.isFinite(value) ? value : 16)));

/**
 * Camera state, sampling and history invalidation shared by both SteadySplats backends.
 * Resource allocation and shader bindings stay in the backend-specific passes.
 *
 * @ignore
 */
class GSplatSteadyPassBase extends FramePass {
    width = 0;

    height = 0;

    frame = 0;

    restFrames = 0;

    valid = false;

    writeIndex = 0;

    historyVersion = -1;

    worldVersion = -1;

    lastRenderVersion = -1;

    stationary = false;

    needsRender = true;

    retention = 0.7;

    _temporal = false;

    _convergence = false;

    _animated = false;

    _materialVersion = -1;

    _sampleMaterialVersion = -1;

    _cameraShaderKey = -1;

    _alphaClipForward = -1;

    _size = new Float32Array(2);

    _projection = new Mat4();

    _inverseProjection = new Mat4();

    _viewProjection = new Mat4();

    _previousViewProjection = new Mat4();

    _cameraProjection = new Mat4();

    _cameraTransform = new Mat4();

    _background = new Float32Array(3);

    /** @type {ShaderMaterial|null} */
    _sourceMaterial = null;

    _deviceWidth = 0;

    _deviceHeight = 0;

    /**
     * @param {GraphicsDevice} device - Graphics device.
     * @param {GraphNode} cameraNode - View camera node.
     * @param {ShaderMaterial} sampleMaterial - Stochastic sample material.
     * @param {ForwardRenderer} forwardRenderer - Engine forward renderer.
     * @param {MeshInstance} sampleMesh - Stochastic sample mesh.
     */
    constructor(device, cameraNode, sampleMaterial, forwardRenderer, sampleMesh) {
        super(device);
        this.name = 'GSplatSteady';
        this.cameraNode = cameraNode;
        this.sampleMaterial = sampleMaterial;
        this.samplePass = new GSplatSteadySamplePass(device, cameraNode, forwardRenderer, sampleMesh);
        device.on('devicelost', this.resetHistory, this);
        device.on('devicerestored', this.resetHistory, this);
    }

    resetHistory() {
        this.valid = false;
        this.restFrames = 0;
        this.needsRender = true;
    }

    /**
     * @param {GSplatRenderViewParams} params - Current scene and camera parameters.
     * @returns {boolean} Whether an on-demand application should render another frame.
     */
    requiresRender(params) {
        const camera = this.cameraNode.camera.camera;
        const weight = Number.isFinite(params.steadyHistoryWeight) ? params.steadyHistoryWeight : 0.7;
        const convergence = params.steadyConvergence && camera.jitter > 0 && weight > 0;
        const background = camera.clearColor;
        return !this.valid || this._sourceMaterial !== params.material ||
            this.historyVersion !== params.historyVersion || this._materialVersion !== params.material.updateVersion ||
            this._sampleMaterialVersion !== this.sampleMaterial.updateVersion ||
            this._cameraShaderKey !== camera.shaderParams.hash || this._alphaClipForward !== params.alphaClipForward ||
            this._animated !== (camera.jitter > 0) || this._convergence !== convergence ||
            this._deviceWidth !== this.device.width || this._deviceHeight !== this.device.height ||
            !this._cameraProjection.equals(camera.projectionMatrix) || !this._cameraTransform.equals(this.cameraNode.getWorldTransform()) ||
            this._background[0] !== Math.fround(background.r) || this._background[1] !== Math.fround(background.g) ||
            this._background[2] !== Math.fround(background.b) ||
            (convergence && this.restFrames < convergenceFrames(params.steadyConvergenceFrames));
    }

    /**
     * Allocates or releases backend history resources before updating camera state.
     *
     * @param {boolean} temporal - Whether temporal reuse is enabled.
     * @param {boolean} convergence - Whether stationary convergence is enabled.
     * @protected
     */
    _configureResolve(temporal, convergence) {
    }

    /**
     * @param {GSplatRenderViewParams} params - Current scene and camera parameters.
     * @param {number} worldVersion - Version defining stable work-buffer identities.
     */
    updateState(params, worldVersion) {
        const camera = this.cameraNode.camera.camera;
        Camera.applyShaderProjectionTransform(camera.projectionMatrix, this._projection, false, this.device.isWebGPU);
        this._inverseProjection.invert(this._projection);
        this._viewProjection.mul2(this._projection, camera.viewMatrix);
        const animated = camera.jitter > 0;
        this.retention = Number.isFinite(params.steadyHistoryWeight) ? Math.max(0, Math.min(0.9999999, params.steadyHistoryWeight)) : 0.7;
        this._configureResolve(this.retention > 0, this.retention > 0 && animated && params.steadyConvergence);
        const background = camera.clearColor;
        const r = Math.fround(background.r), g = Math.fround(background.g), b = Math.fround(background.b);
        if (!camera.projectionMatrix.equals(this._cameraProjection) ||
            this._sourceMaterial !== params.material ||
            this._materialVersion !== params.material.updateVersion ||
            this._sampleMaterialVersion !== this.sampleMaterial.updateVersion ||
            this.lastRenderVersion !== this.device.renderVersion - 1 || animated !== this._animated ||
            camera.shaderParams.hash !== this._cameraShaderKey || params.alphaClipForward !== this._alphaClipForward ||
            worldVersion !== this.worldVersion || params.historyVersion !== this.historyVersion ||
            this._background[0] !== r || this._background[1] !== g || this._background[2] !== b) {
            this.resetHistory();
        }
        this._background[0] = r;
        this._background[1] = g;
        this._background[2] = b;
        this.stationary = this.valid && this._viewProjection.equals(this._previousViewProjection);
        const accumulate = this._convergence && this.stationary;
        this.needsRender = !accumulate || this.restFrames < convergenceFrames(params.steadyConvergenceFrames);
        if (this.needsRender) this.restFrames = accumulate ? this.restFrames + 1 : 0;

        // A non-jittered camera repeats the same pattern, matching native stochastic rendering.
        const sampleFrame = animated ? this.frame >>> 0 : 0;
        this.sampleMaterial.setParameter('steadyFrame', sampleFrame);
        // A golden-ratio Cranley-Patterson shift avoids repeating each 64-frame STBN cycle.
        this.sampleMaterial.setParameter('steadyNoiseShift', Math.imul(Math.floor(sampleFrame / 64), 0x9e3779b9) >>> 0);

        this.historyVersion = params.historyVersion;
        this.worldVersion = worldVersion;
        this._sourceMaterial = params.material;
        this._materialVersion = params.material.updateVersion;
        this._sampleMaterialVersion = this.sampleMaterial.updateVersion;
        this._animated = animated;
        this._cameraShaderKey = camera.shaderParams.hash;
        this._alphaClipForward = params.alphaClipForward;
        // A converged view is still observed each render, even though its GPU passes are skipped.
        this.lastRenderVersion = this.device.renderVersion;
    }

    execute() {
        this.valid = true;
        this.frame++;
        this._previousViewProjection.copy(this._viewProjection);
        this._cameraProjection.copy(this.cameraNode.camera.camera.projectionMatrix);
        this._cameraTransform.copy(this.cameraNode.getWorldTransform());
        this._deviceWidth = this.device.width;
        this._deviceHeight = this.device.height;
        this.lastRenderVersion = this.device.renderVersion;
    }

    destroy() {
        this.device.off('devicelost', this.resetHistory, this);
        this.device.off('devicerestored', this.resetHistory, this);
        this.samplePass.destroy();
        super.destroy();
    }
}

export { GSplatSteadyPassBase };
