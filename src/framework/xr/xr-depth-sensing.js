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
 * @deprecated
 * @ignore
 */
class XrDepthSensing extends EventHandler {
    /**
     * @type {import('./xr-manager.js').XrManager}
     * @private
     */
    _manager;

    /**
     * @type {import('./xr-views.js').XrViews}
     * @private
     */
    _views;

    /**
     * @type {boolean}
     * @private
     */
    _available = false;

    /**
     * Create a new XrDepthSensing instance.
     *
     * @param {import('./xr-manager.js').XrManager} manager - WebXR Manager.
     * @hideconstructor
     */
    constructor(manager) {
        super();

        this._manager = manager;
        this._views = manager.views;

        if (this._views.supportedDepth) {
            this._manager.on('start', this._onSessionStart, this);
            this._manager.on('end', this._onSessionEnd, this);
        }
    }

    /**
     * Fired when depth sensing data becomes available.
     *
     * @event XrDepthSensing#available
     * @deprecated
     * @ignore
     */

    /**
     * Fired when depth sensing data becomes unavailable.
     *
     * @event XrDepthSensing#unavailable
     * @deprecated
     * @ignore
     */

    /**
     * Fired when the depth sensing texture been resized. The {@link XrDepthSensing#uvMatrix} needs
     * to be updated for relevant shaders.
     *
     * @event XrDepthSensing#resize
     * @param {number} width - The new width of the depth texture in pixels.
     * @param {number} height - The new height of the depth texture in pixels.
     * @deprecated
     * @ignore
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
        if (this._views.availableDepth) {
            this._available = true;
            this.fire('available')
        }
    }

    /** @private */
    _onSessionEnd() {
        if (this._available) {
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
     * @deprecated
     * @ignore
     * @returns {number|null} Depth in meters or null if depth information is currently not
     * available.
     * @example
     * const depth = app.xr.depthSensing.getDepth(u, v);
     * if (depth !== null) {
     *     // depth in meters
     * }
     */
    getDepth(u, v) {
        return this._views.list[0]?.getDepth(u, v) ?? null;
    }

    /**
     * True if Depth Sensing is supported.
     *
     * @type {boolean}
     * @deprecated
     * @ignore
     */
    get supported() {
        return this._views.supportedDepth;
    }

    /**
     * True if depth sensing information is available.
     *
     * @type {boolean}
     * @deprecated
     * @ignore
     * @example
     * if (app.xr.depthSensing.available) {
     *     const depth = app.xr.depthSensing.getDepth(x, y);
     * }
     */
    get available() {
        return this._views.availableDepth;
    }

    /**
     * Whether the usage is CPU or GPU.
     *
     * @type {string}
     * @deprecated
     * @ignore
     */
    get usage() {
        return this._views.depthUsage;
    }

    /**
     * The depth sensing data format.
     *
     * @type {string}
     * @deprecated
     * @ignore
     */
    get dataFormat() {
        return this._views.depthFormat;
    }

    /**
     * Width of depth texture or 0 if not available.
     *
     * @type {number}
     * @deprecated
     * @ignore
     */
    get width() {
        return this._views.list[0]?.textureDepth?.width ?? 0;
    }

    /**
     * Height of depth texture or 0 if not available.
     *
     * @type {number}
     * @deprecated
     * @ignore
     */
    get height() {
        return this._views.list[0]?.textureDepth?.height ?? 0;
    }

    /* eslint-disable jsdoc/check-examples */
    /**
     * Texture that contains packed depth information. The format of this texture is
     * {@link PIXELFORMAT_LA8}. It is UV transformed based on the underlying AR system which can
     * be normalized using {@link XrDepthSensing#uvMatrix}.
     *
     * @type {Texture}
     * @deprecated
     * @ignore
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
        return this._views.list[0]?.textureDepth;
    }
    /* eslint-enable jsdoc/check-examples */

    /**
     * 4x4 matrix that should be used to transform depth texture UVs to normalized UVs in a shader.
     * It is updated when the depth texture is resized. Refer to {@link XrDepthSensing#resize}.
     *
     * @type {Mat4}
     * @deprecated
     * @ignore
     * @example
     * material.setParameter('matrix_depth_uv', depthSensing.uvMatrix.data);
     */
    get uvMatrix() {
        return this._views.list[0]?.depthUvMatrix;
    }

    /**
     * Multiply this coefficient number by raw depth value to get depth in meters.
     *
     * @type {number}
     * @deprecated
     * @ignore
     * @example
     * material.setParameter('depth_raw_to_meters', depthSensing.rawValueToMeters);
     */
    get rawValueToMeters() {
        return this._views.list[0]?.depthValueToMeters ?? 0;
    }
}

export { XrDepthSensing };
