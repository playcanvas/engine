import { Debug } from '../../core/debug.js';
import { Vec4 } from '../../core/math/vec4.js';
import {
    ADDRESS_CLAMP_TO_EDGE, FILTER_NEAREST, PIXELFORMAT_R16F, PIXELFORMAT_RGBA8,
    RENDERTARGET_ORIGIN_BOTTOM, SEMANTIC_POSITION, SHADERLANGUAGE_GLSL, SHADERLANGUAGE_WGSL
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
 * clears to it, and the scene pass clears to its reciprocal, which decodes back to it - so the margin is
 * only here to absorb the rounding of that round trip. A whole float survives it to within a few parts
 * in a million, a half float to a few parts in ten thousand, and the margin is picked to match, as a
 * surface which happens to lie inside it reads as empty.
 */
const _farLimitFractionFull = 1 - 1e-5;

const _farLimitFractionHalf = 1 - 1.5e-3;

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

    /**
     * False once this reader, the camera it reads or the device has gone, after which nothing further
     * is rendered for it and a read in flight has nothing meaningful left to report.
     *
     * @type {boolean}
     * @private
     */
    _valid = true;

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

    /** @private */
    _onDeviceDestroy;

    /** @private */
    _onCameraRemove;

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

        // A destroyed device renders nothing further, and neither does a camera whose component has
        // been removed - which notably leaves its enabled flag set, so the check in read cannot see it.
        // Either way reads are turned away from then on, and anything already queued is settled rather
        // than left waiting on a frame which will never come.
        this._onDeviceDestroy = () => {
            this._invalidate();
        };
        device.on('destroy', this._onDeviceDestroy);

        // fired before the component sheds its own listeners, so this is still reached
        this._onCameraRemove = () => {
            this._invalidate();
        };
        camera.on('beforeremove', this._onCameraRemove);
    }

    /**
     * Requests the depth of a region of the view, as `width * height` samples in row major order. The
     * region is point sampled rather than averaged - one sample per cell, taken at its centre - so
     * asking for more samples than the region resolves to repeats them.
     *
     * Samples where nothing was rendered read as `Infinity`, as do the few which land within a hair of
     * the far clip, that being the depth an empty pixel reports.
     *
     * Note that on a device which stores the scene depth at a lower precision - see
     * {@link GSplatParams#sceneDepthWrite} - a far clip beyond about 16384 leaves an empty pixel
     * reporting a large distance rather than `Infinity`, as the two stop being far enough apart to
     * tell one from the other.
     *
     * @param {Vec4} rect - The region of the view to sample, normalized, with its origin in the bottom
     * left as {@link CameraComponent#rect}.
     * @param {number} width - The number of samples across the region. Not pixels.
     * @param {number} height - The number of samples down the region.
     * @param {Float32Array} [target] - An array to fill, at least `width * height` long. One is
     * allocated when not given. It is filled when the returned promise resolves, so an array must not
     * be shared between reads which overlap in time.
     * @returns {Promise<Float32Array>|null} The samples, in world units, or null when the camera is
     * disabled or is not rendering a scene depth, leaving nothing to read.
     */
    read(rect, width, height, target) {

        Debug.assert(width > 0 && height > 0 && Number.isInteger(width) && Number.isInteger(height),
            'SceneDepthReader#read needs a whole positive number of samples, as they become the dimensions of a texture.');
        const count = width * height;
        Debug.assert(!target || target.length >= count, `SceneDepthReader#read needs an array of at least ${count} samples.`);

        // a disabled camera renders nothing, so it would never service the read - the request would sit
        // in the queue unanswered rather than the caller being told there is nothing to read
        const { camera } = this;
        if (!this._valid || !this._depthRendered || !camera.enabled || !camera.entity.enabled) {
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
            this._settleRequests();
            return;
        }

        this._updateShader();

        // sized to the largest request before any of them render, as growing it part way through would
        // destroy the texture the readback of an already rendered one is still to be sourced from
        let width = 0;
        let height = 0;
        for (let i = 0; i < requests.length; i++) {
            width = Math.max(width, requests[i].width);
            height = Math.max(height, requests[i].height);
        }
        this._updateRenderTarget(width, height);

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

        const { rectValue, gridValue } = this;
        rectValue[0] = request.x;
        rectValue[1] = request.y;
        rectValue[2] = request.z;
        rectValue[3] = request.w;
        this.rectId.setValue(rectValue);

        gridValue[0] = width;
        gridValue[1] = height;
        this.gridId.setValue(gridValue);

        const halfFloat = internal.sceneDepthMap.format === PIXELFORMAT_R16F;
        this.farId.setValue(internal.farClip * (halfFloat ? _farLimitFractionHalf : _farLimitFractionFull));
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

        const read = this.renderTarget.colorBuffer.read(0, 0, width, height, {
            renderTarget: this.renderTarget,
            data: buffer.bytes
        });

        // a backend which implements no readback at all - the null device among them - hands back
        // nothing rather than a promise, so the region is reported as empty instead of the request
        // being left with no way to be answered
        if (!read) {
            Debug.warnOnce('SceneDepthReader: this device implements no texture readback, so the depth reads as empty.');
            target.fill(Infinity, 0, count);
            this._returnBuffer(buffer);
            resolve(target);
            return;
        }

        read.then(() => {

            // the reader, its camera or the device went while this was in flight, so the bytes mean
            // nothing and the buffers they would be unpacked through have been let go of
            if (!this._valid) {
                target.fill(Infinity, 0, count);
                resolve(target);
                return;
            }

            // the chunk packs the float with its high byte in red, which is a big endian read
            const view = buffer.view;
            for (let i = 0; i < count; i++) {
                target[i] = view.getFloat32(i * 4, false);
            }
            this._returnBuffer(buffer);
            resolve(target);

        }).catch((error) => {

            // The region is reported as empty rather than the promise being left hanging, which is the
            // answer a read has when the device or the reader went away under it. A read can also fail
            // for a reason of its own, though, and reporting that as an empty region alone would leave
            // nothing to go on - so it is warned about, as reads are issued from an update loop and
            // rejecting would ask every caller to handle what is usually not theirs to handle.
            if (this._valid) {
                Debug.warnOnce(`SceneDepthReader read failed: ${error?.message ?? error}`);

                // handed back only while the reader is valid - the pool is let go of as it is
                // invalidated, and a buffer arriving after that would build it again, which is why the
                // path above drops its own the same way
                this._returnBuffer(buffer);
            }

            target.fill(Infinity, 0, count);
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

        // The target is only ever grown, so a read is generally smaller than it. The rendered region
        // and the region read back therefore have to be the same rows, which they are not by default:
        // the viewport is placed from the bottom on WebGL and from the top on WebGPU, while the readback
        // addresses texels natively on both. Asking for the WebGL row order on every API settles it.
        this.renderTarget = new RenderTarget({
            name: 'SceneDepthRead',
            colorBuffer: texture,
            depth: false,
            origin: RENDERTARGET_ORIGIN_BOTTOM
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
     * Marks the reader as having nothing left to read, and settles what is queued. Called when the
     * device is destroyed, when the camera component is removed, and when the reader itself is
     * destroyed - each of which means no frame will ever service a read again.
     *
     * @private
     */
    _invalidate() {
        this._valid = false;
        this._settleRequests();
    }

    /**
     * Reports every queued read as empty, for the cases where the frame which would have serviced them
     * is never going to arrive.
     *
     * @private
     */
    _settleRequests() {
        this._requests.forEach((request) => {
            request.target.fill(Infinity, 0, request.width * request.height);
            request.resolve(request.target);
        });
        this._requests.length = 0;
    }

    /**
     * Frees the resources the reader owns and stops reading for this camera. Reads which have not been
     * rendered yet report their region as empty, and one already in flight does the same once it
     * completes, rather than writing samples read through resources this has let go of.
     */
    destroy() {

        this.camera.system.app.scene.off(EVENT_POSTRENDER, this._onPostRender);
        this.camera.off('beforeremove', this._onCameraRemove);
        this.device.off('destroy', this._onDeviceDestroy);

        this._invalidate();

        // clearing the shader is what releases the quad the pass renders with - the pass itself has
        // no teardown of its own, and the shader stays owned by the program library which cached it
        this.pass.shader = null;
        this.pass.destroy();
        this._destroyRenderTarget();
        this._buffers.clear();
    }
}

export { SceneDepthReader };
