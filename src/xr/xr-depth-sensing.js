import { EventHandler } from '../core/event-handler.js';
import { Mat4 } from '../math/mat4.js';
import { Texture } from '../graphics/texture.js';
import { ADDRESS_CLAMP_TO_EDGE, PIXELFORMAT_L8_A8, FILTER_LINEAR } from '../graphics/constants.js';
import { XRDEPTHSENSINGUSAGE_CPU, XRDEPTHSENSINGUSAGE_GPU } from './constants.js';

/* eslint-disable jsdoc/check-examples */
/**
 * @class
 * @name XrDepthSensing
 * @augments EventHandler
 * @classdesc Depth Sensing provides depth information which is reconstructed using the underlying AR system. It provides the ability to query depth values (CPU path) or access a depth texture (GPU path). Depth information can be used (not limited to) for reconstructing real world geometry, virtual object placement, occlusion of virtual objects by real world geometry and more.
 * @description Depth Sensing provides depth information which is reconstructed using the underlying AR system. It provides the ability to query depth values (CPU path) or access a depth texture (GPU path). Depth information can be used (not limited to) for reconstructing real world geometry, virtual object placement, occlusion of virtual objects by real world geometry and more.
 * @param {XrManager} manager - WebXR Manager.
 * @property {boolean} supported True if Depth Sensing is supported.
 * @property {number} width Width of depth texture or 0 if not available.
 * @property {number} height Height of depth texture or 0 if not available.
 * @example
 * // CPU path
 * var depthSensing = app.xr.depthSensing;
 * if (depthSensing.available) {
 *     // get depth in the middle of the screen, value is in meters
 *     var depth = depthSensing.getDepth(depthSensing.width / 2, depthSensing.height / 2);
 * }
 * @example
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
 *     depth = min(depth / 8.0, 1.0); // 0..1 = 0..8
 *
 *     // paint scene from black to white based on distance
 *     gl_FragColor = vec4(depth, depth, depth, 1.0);
 * }
 */
/* eslint-enable jsdoc/check-examples */
class XrDepthSensing extends EventHandler {
    constructor(manager) {
        super();

        this._manager = manager;
        this._available = false;

        this._depthInfoCpu = null;
        this._depthInfoGpu = null;

        this._usage = null;
        this._dataFormat = null;

        this._matrixDirty = false;
        this._matrix = new Mat4();
        this._emptyBuffer = new Uint8Array(32);
        this._depthBuffer = null;

        // TODO
        // data format can be different
        this._texture = new Texture(this._manager.app.graphicsDevice, {
            format: PIXELFORMAT_L8_A8,
            mipmaps: false,
            addressU: ADDRESS_CLAMP_TO_EDGE,
            addressV: ADDRESS_CLAMP_TO_EDGE,
            minFilter: FILTER_LINEAR,
            magFilter: FILTER_LINEAR
        });

        if (this.supported) {
            this._manager.on('start', this._onSessionStart, this);
            this._manager.on('end', this._onSessionEnd, this);
        }
    }

    /**
     * @event
     * @name XrDepthSensing#available
     * @description Fired when depth sensing data becomes available.
     */

    /**
     * @event
     * @name XrDepthSensing#unavailable
     * @description Fired when depth sensing data becomes unavailable.
     */

    /**
     * @event
     * @name XrDepthSensing#resize
     * @description Fired when the depth sensing texture been resized. The {@link XrDepthSensing#uvMatrix} needs to be updated for relevant shaders.
     * @param {number} width - The new width of the depth texture in pixels.
     * @param {number} height - The new height of the depth texture in pixels.
     * @example
     * depthSensing.on('resize', function () {
     *     material.setParameter('matrix_depth_uv', depthSensing.uvMatrix);
     * });
     */

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

    update(frame, view) {
        if (! this._usage)
            return;

        let depthInfoCpu = null;
        let depthInfoGpu = null;
        if (this._usage === XRDEPTHSENSINGUSAGE_CPU && view) {
            depthInfoCpu = frame.getDepthInformation(view);
        } else if (this._usage === XRDEPTHSENSINGUSAGE_GPU && view) {
            depthInfoGpu = frame.getDepthInformation(view);
        }

        if ((this._depthInfoCpu && ! depthInfoCpu) || (! this._depthInfoCpu && depthInfoCpu) || (this.depthInfoGpu && ! depthInfoGpu) || (! this._depthInfoGpu && depthInfoGpu)) {
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

        if ((this._depthInfoCpu || this._depthInfoGpu) && ! this._available) {
            this._available = true;
            this.fire('available');
        } else if (! this._depthInfoCpu && ! this._depthInfoGpu && this._available) {
            this._available = false;
            this.fire('unavailable');
        }
    }

    /**
     * @function
     * @name XrDepthSensing#getDepth
     * @param {number} u - U coordinate of pixel in depth texture, which is in range from 0.0 to 1.0 (left to right).
     * @param {number} v - V coordinate of pixel in depth texture, which is in range from 0.0 to 1.0 (top to bottom).
     * @description Get depth value from depth information in meters. UV is in range of 0..1, with origin in top-left corner of a texture.
     * @example
     * var depth = app.xr.depthSensing.getDepth(u, v);
     * if (depth !== null) {
     *     // depth in meters
     * }
     * @returns {number|null} Depth in meters or null if depth information is currently not available.
     */
    getDepth(u, v) {
        // TODO
        // GPU usage

        if (! this._depthInfoCpu)
            return null;

        return this._depthInfoCpu.getDepthInMeters(u, v);
    }

    get supported() {
        return !! window.XRDepthInformation;
    }

    /**
     * @name XrDepthSensing#available
     * @type {boolean}
     * @description True if depth sensing information is available.
     * @example
     * if (app.xr.depthSensing.available) {
     *     var depth = app.xr.depthSensing.getDepth(x, y);
     * }
     */
    get available() {
        return this._available;
    }

    get usage() {
        return this._usage;
    }

    get dataFormat() {
        return this._dataFormat;
    }

    get width() {
        const depthInfo = this._depthInfoCpu || this._depthInfoGpu;
        return depthInfo && depthInfo.width || 0;
    }

    get height() {
        const depthInfo = this._depthInfoCpu || this._depthInfoGpu;
        return depthInfo && depthInfo.height || 0;
    }

    /* eslint-disable jsdoc/check-examples */
    /**
     * @name XrDepthSensing#texture
     * @type {Texture}
     * @description Texture that contains packed depth information. The format of this texture is {@link PIXELFORMAT_L8_A8}. It is UV transformed based on the underlying AR system which can be normalized using {@link XrDepthSensing#uvMatrix}.
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
    /* eslint-enable jsdoc/check-examples */
    get texture() {
        return this._texture;
    }

    /**
     * @name XrDepthSensing#uvMatrix
     * @type {Mat4}
     * @description 4x4 matrix that should be used to transform depth texture UVs to normalized UVs in a shader. It is updated when the depth texture is resized. Refer to {@link XrDepthSensing#resize}.
     * @example
     * material.setParameter('matrix_depth_uv', depthSensing.uvMatrix.data);
     */
    get uvMatrix() {
        return this._matrix;
    }

    /**
     * @name XrDepthSensing#rawValueToMeters
     * @type {number}
     * @description Multiply this coefficient number by raw depth value to get depth in meters.
     * @example
     * material.setParameter('depth_raw_to_meters', depthSensing.rawValueToMeters);
     */
    get rawValueToMeters() {
        const depthInfo = this._depthInfoCpu || this._depthInfoGpu;
        return depthInfo && depthInfo.rawValueToMeters || 0;
    }
}

export { XrDepthSensing };
