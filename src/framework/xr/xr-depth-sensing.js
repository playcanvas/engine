import { EventHandler } from '../../core/event-handler.js';
import { platform } from '../../core/platform.js';
import { Mat4 } from '../../core/math/mat4.js';

import { ADDRESS_CLAMP_TO_EDGE, PIXELFORMAT_LA8, FILTER_LINEAR } from '../../platform/graphics/constants.js';
import { Texture } from '../../platform/graphics/texture.js';

import { XRDEPTHSENSINGUSAGE_CPU, XRDEPTHSENSINGUSAGE_GPU } from './constants.js';

/**
 * Depth Sensing provides depth information which is reconstructed using the underlying AR system.
 * It provides the ability to query depth values (CPU path) or access a depth texture (GPU path).
 * Depth information can be used (not limited to) for reconstructing real world geometry, virtual
 * object placement, occlusion of virtual objects by real world geometry and more.
 *
 * ```javascript
 * // CPU path
 * const depthSensing = app.xr.depthSensing;
 * if (depthSensing.available) {
 *     // get depth in the middle of the screen, value is in meters
 *     const depth = depthSensing.getDepth(depthSensing.width / 2, depthSensing.height / 2);
 * }
 * ```
 *
 * ```javascript
 * // GPU path, attaching texture to material
 * material.diffuseMap = depthSensing.texture;
 * material.setParameter('matrix_depth_uv', depthSensing.uvMatrix.data);
 * material.setParameter('depth_raw_to_meters', depthSensing.rawValueToMeters);
 * material.update();
 *
 * // update UV transformation matrix on depth texture resize
 * depthSensing.on('resize', function () {
 *     material.setParameter('matrix_depth_uv', depthSensing.uvMatrix.data);
 *     material.setParameter('depth_raw_to_meters', depthSensing.rawValueToMeters);
 * });
 * ```
 *
 * ```javascript
 * // GLSL shader to unpack depth texture
 * varying vec2 vUv0;
 *
 * uniform sampler2D texture_depthSensingMap;
 * uniform mat4 matrix_depth_uv;
 * uniform float depth_raw_to_meters;
 *
 * void main(void) {
 *     // transform UVs using depth matrix
 *     vec2 texCoord = (matrix_depth_uv * vec4(vUv0.xy, 0.0, 1.0)).xy;
 *
 *     // get luminance alpha components from depth texture
 *     vec2 packedDepth = texture2D(texture_depthSensingMap, texCoord).ra;
 *
 *     // unpack into single value in millimeters
 *     float depth = dot(packedDepth, vec2(255.0, 256.0 * 255.0)) * depth_raw_to_meters; // m
 *
 *     // normalize: 0m to 8m distance
 *     depth = min(depth / 8.0, 1.0); // 0..1 = 0..8
 *
 *     // paint scene from black to white based on distance
 *     gl_FragColor = vec4(depth, depth, depth, 1.0);
 * }
 * ```
 *
 * @augments EventHandler
 * @category XR
 */
class XrDepthSensing extends EventHandler {
    /**
     * @type {import('./xr-manager.js').XrManager}
     * @private
     */
    _manager;

     /**
      * @type {boolean}
      * @private
      */
    _available = false;

    /**
     * @type {XRCPUDepthInformation|null}
     * @private
     */
    _depthInfoCpu = null;

    /**
     * @type {XRCPUDepthInformation|null}
     * @private
     */
    _depthInfoGpu = null;

    /**
     * @type {string|null}
     * @private
     */
    _usage = null;

    /**
     * @type {string|null}
     * @private
     */
    _dataFormat = null;

    /**
     * @type {boolean}
     * @private
     */
    _matrixDirty = false;

    /**
     * @type {Mat4}
     * @private
     */
    _matrix = new Mat4();

    /**
     * @type {Uint8Array}
     * @private
     */
    _emptyBuffer = new Uint8Array(32);

    /**
     * @type {Uint8Array|null}
     * @private
     */
    _depthBuffer = null;

    /**
     * @type {Texture}
     * @private
     */
    _texture;

    /**
     * Create a new XrDepthSensing instance.
     *
     * @param {import('./xr-manager.js').XrManager} manager - WebXR Manager.
     * @hideconstructor
     */
    constructor(manager) {
        super();

        this._manager = manager;

        // TODO: data format can be different
        this._texture = new Texture(this._manager.app.graphicsDevice, {
            format: PIXELFORMAT_LA8,
            mipmaps: false,
            addressU: ADDRESS_CLAMP_TO_EDGE,
            addressV: ADDRESS_CLAMP_TO_EDGE,
            minFilter: FILTER_LINEAR,
            magFilter: FILTER_LINEAR,
            name: 'XRDepthSensing'
        });

        if (this.supported) {
            this._manager.on('start', this._onSessionStart, this);
            this._manager.on('end', this._onSessionEnd, this);
        }
    }

    /**
     * Fired when depth sensing data becomes available.
     *
     * @event XrDepthSensing#available
     */

    /**
     * Fired when depth sensing data becomes unavailable.
     *
     * @event XrDepthSensing#unavailable
     */

    /**
     * Fired when the depth sensing texture been resized. The {@link XrDepthSensing#uvMatrix} needs
     * to be updated for relevant shaders.
     *
     * @event XrDepthSensing#resize
     * @param {number} width - The new width of the depth texture in pixels.
     * @param {number} height - The new height of the depth texture in pixels.
     * @example
     * depthSensing.on('resize', function () {
     *     material.setParameter('matrix_depth_uv', depthSensing.uvMatrix);
     * });
     */

    /** @ignore */
    destroy() {
        this._texture.destroy();
        this._texture = null;
    }

    /** @private */
    _onSessionStart() {
        const session = this._manager.session;

        try {
            this._usage = session.depthUsage;
            this._dataFormat = session.depthDataFormat;
        } catch (ex) {
            this._usage = null;
            this._dataFormat = null;
            this._available = false;

            this.fire('error', ex);
        }
    }

    /** @private */
    _onSessionEnd() {
        this._depthInfoCpu = null;
        this._depthInfoGpu = null;

        this._usage = null;
        this._dataFormat = null;

        if (this._available) {
            this._available = false;
            this.fire('unavailable');
        }

        this._depthBuffer = null;
        this._texture._width = 4;
        this._texture._height = 4;
        this._texture._levels[0] = this._emptyBuffer;
        this._texture.upload();
    }

    /** @private */
    _updateTexture() {
        const depthInfo = this._depthInfoCpu || this._depthInfoGpu;

        if (depthInfo) {
            let resized = false;

            // changed resolution
            if (depthInfo.width !== this._texture.width || depthInfo.height !== this._texture.height) {
                this._texture._width = depthInfo.width;
                this._texture._height = depthInfo.height;
                this._matrixDirty = true;
                resized = true;
            }

            if (this._depthInfoCpu) {
                const dataBuffer = this._depthInfoCpu.data;
                this._depthBuffer = new Uint8Array(dataBuffer);
                this._texture._levels[0] = this._depthBuffer;
                this._texture.upload();
            } else if (this._depthInfoGpu) {
                this._texture._levels[0] = this._depthInfoGpu.texture;
                this._texture.upload();
            }

            if (resized) this.fire('resize', depthInfo.width, depthInfo.height);
        } else if (this._depthBuffer) {
            // depth info not available anymore
            this._depthBuffer = null;
            this._texture._width = 4;
            this._texture._height = 4;
            this._texture._levels[0] = this._emptyBuffer;
            this._texture.upload();
        }
    }

    /**
     * @param {*} frame - XRFrame from requestAnimationFrame callback.
     * @param {*} view - First XRView of viewer XRPose.
     * @ignore
     */
    update(frame, view) {
        if (!this._usage)
            return;

        let depthInfoCpu = null;
        let depthInfoGpu = null;
        if (this._usage === XRDEPTHSENSINGUSAGE_CPU && view) {
            depthInfoCpu = frame.getDepthInformation(view);
        } else if (this._usage === XRDEPTHSENSINGUSAGE_GPU && view) {
            depthInfoGpu = frame.getDepthInformation(view);
        }

        if ((this._depthInfoCpu && !depthInfoCpu) || (!this._depthInfoCpu && depthInfoCpu) || (this.depthInfoGpu && !depthInfoGpu) || (!this._depthInfoGpu && depthInfoGpu)) {
            this._matrixDirty = true;
        }
        this._depthInfoCpu = depthInfoCpu;
        this._depthInfoGpu = depthInfoGpu;

        this._updateTexture();

        if (this._matrixDirty) {
            this._matrixDirty = false;

            const depthInfo = this._depthInfoCpu || this._depthInfoGpu;

            if (depthInfo) {
                this._matrix.data.set(depthInfo.normDepthBufferFromNormView.matrix);
            } else {
                this._matrix.setIdentity();
            }
        }

        if ((this._depthInfoCpu || this._depthInfoGpu) && !this._available) {
            this._available = true;
            this.fire('available');
        } else if (!this._depthInfoCpu && !this._depthInfoGpu && this._available) {
            this._available = false;
            this.fire('unavailable');
        }
    }

    /**
     * Get depth value from depth information in meters. UV is in range of 0..1, with origin in
     * top-left corner of a texture.
     *
     * @param {number} u - U coordinate of pixel in depth texture, which is in range from 0.0 to
     * 1.0 (left to right).
     * @param {number} v - V coordinate of pixel in depth texture, which is in range from 0.0 to
     * 1.0 (top to bottom).
     * @returns {number|null} Depth in meters or null if depth information is currently not
     * available.
     * @example
     * const depth = app.xr.depthSensing.getDepth(u, v);
     * if (depth !== null) {
     *     // depth in meters
     * }
     */
    getDepth(u, v) {
        // TODO
        // GPU usage

        if (!this._depthInfoCpu)
            return null;

        return this._depthInfoCpu.getDepthInMeters(u, v);
    }

    /**
     * True if Depth Sensing is supported.
     *
     * @type {boolean}
     */
    get supported() {
        return platform.browser && !!window.XRDepthInformation;
    }

    /**
     * True if depth sensing information is available.
     *
     * @type {boolean}
     * @example
     * if (app.xr.depthSensing.available) {
     *     const depth = app.xr.depthSensing.getDepth(x, y);
     * }
     */
    get available() {
        return this._available;
    }

    /**
     * Whether the usage is CPU or GPU.
     *
     * @type {string}
     * @ignore
     */
    get usage() {
        return this._usage;
    }

    /**
     * The depth sensing data format.
     *
     * @type {string}
     * @ignore
     */
    get dataFormat() {
        return this._dataFormat;
    }

    /**
     * Width of depth texture or 0 if not available.
     *
     * @type {number}
     */
    get width() {
        const depthInfo = this._depthInfoCpu || this._depthInfoGpu;
        return depthInfo && depthInfo.width || 0;
    }

    /**
     * Height of depth texture or 0 if not available.
     *
     * @type {number}
     */
    get height() {
        const depthInfo = this._depthInfoCpu || this._depthInfoGpu;
        return depthInfo && depthInfo.height || 0;
    }

    /* eslint-disable jsdoc/check-examples */
    /**
     * Texture that contains packed depth information. The format of this texture is
     * {@link PIXELFORMAT_LA8}. It is UV transformed based on the underlying AR system which can
     * be normalized using {@link XrDepthSensing#uvMatrix}.
     *
     * @type {Texture}
     * @example
     * material.diffuseMap = depthSensing.texture;
     * @example
     * // GLSL shader to unpack depth texture
     * varying vec2 vUv0;
     *
     * uniform sampler2D texture_depthSensingMap;
     * uniform mat4 matrix_depth_uv;
     * uniform float depth_raw_to_meters;
     *
     * void main(void) {
     *     // transform UVs using depth matrix
     *     vec2 texCoord = (matrix_depth_uv * vec4(vUv0.xy, 0.0, 1.0)).xy;
     *
     *     // get luminance alpha components from depth texture
     *     vec2 packedDepth = texture2D(texture_depthSensingMap, texCoord).ra;
     *
     *     // unpack into single value in millimeters
     *     float depth = dot(packedDepth, vec2(255.0, 256.0 * 255.0)) * depth_raw_to_meters; // m
     *
     *     // normalize: 0m to 8m distance
     *     depth = min(depth / 8.0, 1.0); // 0..1 = 0m..8m
     *
     *     // paint scene from black to white based on distance
     *     gl_FragColor = vec4(depth, depth, depth, 1.0);
     * }
     */
    get texture() {
        return this._texture;
    }
    /* eslint-enable jsdoc/check-examples */

    /**
     * 4x4 matrix that should be used to transform depth texture UVs to normalized UVs in a shader.
     * It is updated when the depth texture is resized. Refer to {@link XrDepthSensing#resize}.
     *
     * @type {Mat4}
     * @example
     * material.setParameter('matrix_depth_uv', depthSensing.uvMatrix.data);
     */
    get uvMatrix() {
        return this._matrix;
    }

    /**
     * Multiply this coefficient number by raw depth value to get depth in meters.
     *
     * @type {number}
     * @example
     * material.setParameter('depth_raw_to_meters', depthSensing.rawValueToMeters);
     */
    get rawValueToMeters() {
        const depthInfo = this._depthInfoCpu || this._depthInfoGpu;
        return depthInfo && depthInfo.rawValueToMeters || 0;
    }
}

export { XrDepthSensing };
