import { Debug } from '../../core/debug.js';
import { Vec4 } from '../../core/math/vec4.js';
import {
    ADDRESS_CLAMP_TO_EDGE, FILTER_NEAREST, PIXELFORMAT_RGBA8, SEMANTIC_POSITION,
    SHADERLANGUAGE_GLSL, SHADERLANGUAGE_WGSL
} from '../../platform/graphics/constants.js';
import { RenderTarget } from '../../platform/graphics/render-target.js';
import { Texture } from '../../platform/graphics/texture.js';
import { EVENT_POSTRENDER } from '../../scene/constants.js';
import { RenderPassShaderQuad } from '../../scene/graphics/render-pass-shader-quad.js';
import { ShaderChunks } from '../../scene/shader-lib/shader-chunks.js';
import { ShaderUtils } from '../../scene/shader-lib/shader-utils.js';
import glslSceneDepthReadPS from '../../scene/shader-lib/glsl/chunks/render-pass/frag/scene-depth-read.js';
import wgslSceneDepthReadPS from '../../scene/shader-lib/wgsl/chunks/render-pass/frag/scene-depth-read.js';

/**
 * @import { CameraComponent } from '../components/camera/component.js'
 */

/**
 * How close to the far clip a sample has to be to count as nothing having been rendered, as a fraction
 * of the far clip. Both producers report the far clip itself for a pixel nothing covered - the prepass
 * clears to it, and the scene pass clears to its reciprocal, which decodes back to it - so the margin
 * is only here to absorb the rounding of that round trip.
 */
const _farLimitFraction = 1 - 1.5e-3;

/**
 * Reads the scene depth of a camera back to the CPU.
 *
 * A sample is the distance from the camera to the surface at that point, in world units, measured
 * along the camera's view direction.
 *
 * Reads are asynchronous and land a frame or two later. Any number of them may be in flight at once, so
 * a read can be issued every frame without waiting for the previous one to finish.
 *
 * Note that something has to be rendering the depth for there to be anything to read: an effect which
 * consumes it, or {@link CameraComponent#requestSceneDepthMap}.
 *
 * ```javascript
 * const reader = new pc.SceneDepthReader(camera.camera);
 * const rect = new pc.Vec4(0.45, 0.45, 0.1, 0.1);
 *
 * app.on('update', () => {
 *     reader.read(rect, 8, 8)?.then((samples) => {
 *         const hit = samples.filter(Number.isFinite);
 *         console.log(hit.length ? Math.min(...hit) : 'nothing in view');
 *     });
 * });
 * ```
 *
 * @category Graphics
 * @alpha
 */
class SceneDepthReader {
    /**
     * The camera whose depth is read.
     *
     * @type {CameraComponent}
     * @private
     */
    camera;

    /**
     * Reads requested this frame, rendered and handed to the readback when the camera has finished.
     *
     * @type {object[]}
     * @private
     */
    _requests = [];

    /**
     * Readback buffers not currently in flight, keyed by their byte length. Each entry holds the bytes
     * and a view over them, so a read allocates neither.
     *
     * @type {Map<number, object[]>}
     * @private
     */
    _buffers = new Map();

    /**
     * Whether the camera rendered a depth the last time it finished a frame. Assumed true until then,
     * so that a read issued before the first frame is not turned away.
     *
     * @type {boolean}
     * @private
     */
    _depthRendered = true;

    /** @private */
    device;

    /** @private */
    pass;

    /**
     * Sized to the largest read so far, and never shrunk.
     *
     * @private
     */
    renderTarget;

    /** @private */
    viewport;

    /** @private */
    _shaderKey;

    /** @private */
    _onPostRender;

    // the uniform scope ids the pass writes, and the scratch values written through them

    /** @private */
    rectId;

    /** @private */
    rectValue;

    /** @private */
    gridId;

    /** @private */
    gridValue;

    /** @private */
    farId;

    /** @private */
    emptyId;

    /** @private */
    depthMapId;

    /** @private */
    cameraParamsId;

    /** @private */
    cameraParams;

    /**
     * @param {CameraComponent} camera - The camera whose depth is read.
     */
    constructor(camera) {
        Debug.assert(camera, 'SceneDepthReader requires a camera component.');
        this.camera = camera;

        const device = this.device = camera.system.app.graphicsDevice;
        ShaderChunks.get(device, SHADERLANGUAGE_GLSL).set('sceneDepthReadPS', glslSceneDepthReadPS);
        ShaderChunks.get(device, SHADERLANGUAGE_WGSL).set('sceneDepthReadPS', wgslSceneDepthReadPS);

        this.pass = new RenderPassShaderQuad(device);
        this.renderTarget = null;
        this.viewport = new Vec4();
        this._shaderKey = null;

        const { scope } = device;
        this.rectId = scope.resolve('uDepthReadRect');
        this.rectValue = new Float32Array(4);
        this.gridId = scope.resolve('uDepthReadGrid');
        this.gridValue = new Float32Array(2);
        this.farId = scope.resolve('uDepthReadFar');
        this.emptyId = scope.resolve('uDepthReadEmpty');
        this.depthMapId = scope.resolve('uSceneDepthMap');
        this.cameraParamsId = scope.resolve('camera_params');
        this.cameraParams = new Float32Array(4);

        // the depth of a camera is only current while that camera renders, so the reads are serviced as
        // it finishes - by which point its producer has published, and before another camera has run
        this._onPostRender = (cameraComponent) => {
            if (cameraComponent === this.camera) {
                this._process();
            }
        };
        camera.system.app.scene.on(EVENT_POSTRENDER, this._onPostRender);
    }

    /**
     * Requests the depth of a region of the view, as `width * height` samples in row major order. The
     * region is point sampled rather than averaged - one sample per cell, taken at its centre - so
     * asking for more samples than the region resolves to repeats them.
     *
     * Samples where nothing was rendered read as `Infinity`.
     *
     * @param {Vec4} rect - The region of the view to sample, normalized, with its origin in the bottom
     * left as {@link CameraComponent#rect}.
     * @param {number} width - The number of samples across the region. Not pixels.
     * @param {number} height - The number of samples down the region.
     * @param {Float32Array} [target] - An array to fill, at least `width * height` long. One is
     * allocated when not given. It is filled when the returned promise resolves, so an array must not
     * be shared between reads which overlap in time.
     * @returns {Promise<Float32Array>|null} The samples, in world units, or null when the camera is not
     * rendering a scene depth, leaving nothing to read.
     */
    read(rect, width, height, target) {

        Debug.assert(width > 0 && height > 0, 'SceneDepthReader#read needs a positive number of samples.');
        const count = width * height;
        Debug.assert(!target || target.length >= count, `SceneDepthReader#read needs an array of at least ${count} samples.`);

        if (!this._depthRendered) {
            return null;
        }

        const request = {
            x: rect.x,
            y: rect.y,
            z: rect.z,
            w: rect.w,
            width,
            height,
            target: target ?? new Float32Array(count),
            resolve: null
        };

        const promise = new Promise((resolve) => {
            request.resolve = resolve;
        });
        this._requests.push(request);
        return promise;
    }

    /**
     * Renders and reads back everything requested this frame.
     *
     * @private
     */
    _process() {

        const { camera, device, _requests: requests } = this;
        const internal = camera.camera;

        // the camera has just finished, so its record is this frame's if it rendered a depth at all
        this._depthRendered = !!internal.sceneDepthMap && internal.sceneDepthMapVersion === device.renderVersion;

        if (requests.length === 0) {
            return;
        }

        // nothing rendered the depth, so nothing was hit anywhere
        if (!this._depthRendered) {
            requests.forEach((request) => {
                request.target.fill(Infinity, 0, request.width * request.height);
                request.resolve(request.target);
            });
            requests.length = 0;
            return;
        }

        this._updateShader();

        for (let i = 0; i < requests.length; i++) {
            this._readRequest(requests[i]);
        }
        requests.length = 0;
    }

    /**
     * Renders one request and starts its readback.
     *
     * @param {object} request - The request.
     * @private
     */
    _readRequest(request) {

        const { camera } = this;
        const { width, height } = request;
        const internal = camera.camera;

        this._updateRenderTarget(width, height);

        const { rectValue, gridValue } = this;
        rectValue[0] = request.x;
        rectValue[1] = request.y;
        rectValue[2] = request.z;
        rectValue[3] = request.w;
        this.rectId.setValue(rectValue);

        gridValue[0] = width;
        gridValue[1] = height;
        this.gridId.setValue(gridValue);

        this.farId.setValue(internal.farClip * _farLimitFraction);
        this.emptyId.setValue(Infinity);
        this.cameraParamsId.setValue(internal.fillShaderParams(this.cameraParams));

        // this camera's own depth, rather than whatever the global uniform happens to hold - with more
        // than one camera rendering a depth, the last one to render owns that uniform
        this.depthMapId.setValue(internal.sceneDepthMap);

        // only the region the samples land in is rendered, as the target is sized to the largest read
        this.pass.viewport = this.viewport.set(0, 0, width, height);
        this.pass.render();

        const count = width * height;
        const buffer = this._borrowBuffer(count * 4);
        const { target, resolve } = request;

        this.renderTarget.colorBuffer.read(0, 0, width, height, {
            renderTarget: this.renderTarget,
            data: buffer.bytes
        }).then(() => {

            // the chunk packs the float with its high byte in red, which is a big endian read
            const view = buffer.view;
            for (let i = 0; i < count; i++) {
                target[i] = view.getFloat32(i * 4, false);
            }
            this._returnBuffer(buffer);
            resolve(target);

        }).catch(() => {

            // a lost device, or a destroyed reader - report the region as empty rather than leaving the
            // promise hanging
            target.fill(Infinity, 0, count);
            this._returnBuffer(buffer);
            resolve(target);
        });
    }

    /**
     * Builds the shader, or rebuilds it when the encoding of the depth this camera renders has changed.
     *
     * @private
     */
    _updateShader() {

        const defines = new Map();
        const key = ShaderUtils.addScreenDepthChunkDefines(this.camera.shaderParams, defines);
        if (this._shaderKey !== key) {
            this._shaderKey = key;
            this.pass.shader = ShaderUtils.createShader(this.device, {
                uniqueName: `SceneDepthRead${key}`,
                attributes: { aPosition: SEMANTIC_POSITION },
                vertexChunk: 'quadVS',
                fragmentChunk: 'sceneDepthReadPS',
                fragmentDefines: defines
            });
        }
    }

    /**
     * Grows the target to hold the requested number of samples. It is never shrunk, so a single large
     * read does not cost every following one an allocation.
     *
     * @param {number} width - Samples across.
     * @param {number} height - Samples down.
     * @private
     */
    _updateRenderTarget(width, height) {

        const current = this.renderTarget;
        if (current && current.width >= width && current.height >= height) {
            return;
        }

        const targetWidth = Math.max(width, current?.width ?? 0);
        const targetHeight = Math.max(height, current?.height ?? 0);
        this._destroyRenderTarget();

        const texture = new Texture(this.device, {
            name: 'SceneDepthRead',
            width: targetWidth,
            height: targetHeight,
            format: PIXELFORMAT_RGBA8,
            mipmaps: false,
            minFilter: FILTER_NEAREST,
            magFilter: FILTER_NEAREST,
            addressU: ADDRESS_CLAMP_TO_EDGE,
            addressV: ADDRESS_CLAMP_TO_EDGE
        });

        this.renderTarget = new RenderTarget({
            name: 'SceneDepthRead',
            colorBuffer: texture,
            depth: false
        });
        this.pass.init(this.renderTarget);
    }

    /** @private */
    _destroyRenderTarget() {
        if (this.renderTarget) {
            this.renderTarget.colorBuffer.destroy();
            this.renderTarget.destroy();
            this.renderTarget = null;
        }
    }

    /**
     * @param {number} byteLength - Bytes needed.
     * @returns {object} A buffer and a view over it.
     * @private
     */
    _borrowBuffer(byteLength) {
        const pool = this._buffers.get(byteLength);
        const buffer = pool?.pop();
        if (buffer) {
            return buffer;
        }

        const bytes = new Uint8Array(byteLength);
        return { bytes, view: new DataView(bytes.buffer) };
    }

    /**
     * @param {object} buffer - A buffer no longer in flight.
     * @private
     */
    _returnBuffer(buffer) {
        const byteLength = buffer.bytes.byteLength;
        const pool = this._buffers.get(byteLength) ?? [];
        pool.push(buffer);
        this._buffers.set(byteLength, pool);
    }

    /**
     * Frees the resources the reader owns and stops reading for this camera. Reads still in flight
     * report their region as empty.
     */
    destroy() {

        this.camera.system.app.scene.off(EVENT_POSTRENDER, this._onPostRender);

        this._requests.forEach((request) => {
            request.target.fill(Infinity, 0, request.width * request.height);
            request.resolve(request.target);
        });
        this._requests.length = 0;

        this.pass.destroy();
        this._destroyRenderTarget();
        this._buffers.clear();
    }
}

export { SceneDepthReader };
