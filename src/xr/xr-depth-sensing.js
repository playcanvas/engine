import { EventHandler } from '../core/event-handler.js';
import { Mat4 } from '../math/mat4.js';
import { Texture } from '../graphics/texture.js';
import { ADDRESS_CLAMP_TO_EDGE, PIXELFORMAT_L8_A8 } from '../graphics/graphics.js';

/* eslint-disable */
/**
 * @class
 * @name pc.XrDepthSensing
 * @augments pc.EventHandler
 * @classdesc Depth Sensing provides depth information which is reconstructed using underlying AR system. It provides ability to query depth value (CPU path) or access a depth texture (GPU path). Depth information can be used (not limited to) for: reconstructing real world geometry; virtual object placement; occlusion of virtual objects by real world geometry; and more.
 * @description Depth Sensing provides depth information which is reconstructed using underlying AR system. It provides ability to query depth value (CPU path) or access a depth texture (GPU path). Depth information can be used (not limited to) for: reconstructing real world geometry; virtual object placement; occlusion of virtual objects by real world geometry; and more.
 * @param {pc.XrManager} manager - WebXR Manager.
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
 * material.update();
 *
 * // update UV transformation matrix on depth texture resize
 * depthSensing.on('resize', function () {
 *     material.setParameter('matrix_depth_uv', depthSensing.uvMatrix.data);
 * });
 * @example
 * // GLSL shader to unpack depth texture
 * varying vec2 vUv0;
 *
 * uniform sampler2D texture_depthSensingMap;
 * uniform mat4 matrix_depth_uv;
 *
 * void main(void) {
 *     // transform UVs using depth matrix
 *     vec2 texCoord = (matrix_depth_uv * vec4(vUv0.xy, 0.0, 1.0)).xy;
 *
 *     // get luminance alpha components from depth texture
 *     vec2 packedDepth = texture2D(texture_depthSensingMap, texCoord).ra;
 *
 *     // unpack into single value in millimeters
 *     float depth = dot(packedDepth, vec2(255.0, 256.0 * 255.0)); // mm
 *
 *     // normalize: 0m to 8m distance
 *     depth = min(depth / 8000.0, 1.0); // 0..1 = 0m..8m
 *
 *     // paint scene from black to white based on distance
 *     gl_FragColor = vec4(depth, depth, depth, 1.0);
 * }
 */
/* eslint-enable */
function XrDepthSensing(manager) {
    EventHandler.call(this);

    this._manager = manager;
    this._depthInfo = null;
    this._available = false;

    this._matrixDirty = false;
    this._matrix = new Mat4();
    this._emptyBuffer = new Uint8Array(32);
    this._depthBuffer = null;

    this._texture = new Texture(this._manager.app.graphicsDevice, {
        format: PIXELFORMAT_L8_A8,
        mipmaps: false,
        addressU: ADDRESS_CLAMP_TO_EDGE,
        addressV: ADDRESS_CLAMP_TO_EDGE,
        minFilter: FILTER_LINEAR,
        magFilter: FILTER_LINEAR
    });

    this._manager.on('end', this._onSessionEnd, this);
}
XrDepthSensing.prototype = Object.create(EventHandler.prototype);
XrDepthSensing.prototype.constructor = XrDepthSensing;

/**
 * @event
 * @name pc.XrDepthSensing#available
 * @description Fired when depth sensing data becomes available.
 */

/**
 * @event
 * @name pc.XrDepthSensing#unavailable
 * @description Fired when depth sensing data becomes unavailable.
 */

/**
 * @event
 * @name pc.XrDepthSensing#resize
 * @description Fired when depth sensing texture been resized. So {@link pc.XrDepthSensing#uvMatrix} needs to be updated for relevant shaders.
 * @param {number} width - The new width of the depth texture in pixels.
 * @param {number} height - The new height of the depth texture in pixels.
 * @example
 * depthSensing.on('resize', function () {
 *     material.setParameter('matrix_depth_uv', depthSensing.uvMatrix);
 * });
 */

XrDepthSensing.prototype._onSessionEnd = function () {
    this._depthInfo = null;

    if (this._available) {
        this._available = false;
        this.fire('unavailable');
    }

    this._depthBuffer = null;
    this._texture._width = 4;
    this._texture._height = 4;
    this._texture._levels[0] = this._emptyBuffer;
    this._texture.upload();
};

XrDepthSensing.prototype._updateTexture = function () {
    if (this._depthInfo) {
        var resized = false;

        // changed resolution
        if (this._depthInfo.width !== this._texture.width || this._depthInfo.height !== this._texture.height) {
            this._texture._width = this._depthInfo.width;
            this._texture._height = this._depthInfo.height;
            this._matrixDirty = true;
            resized = true;
        }

        var dataBuffer = this._depthInfo.data;
        this._depthBuffer = new Uint8Array(dataBuffer.buffer, dataBuffer.byteOffset, dataBuffer.byteLength);
        this._texture._levels[0] = this._depthBuffer;
        this._texture.upload();

        if (resized) this.fire('resize', this._depthInfo.width, this._depthInfo.height);

    } else if (this._depthBuffer) {
        // depth info not available anymore
        this._depthBuffer = null;
        this._texture._width = 4;
        this._texture._height = 4;
        this._texture._levels[0] = this._emptyBuffer;
        this._texture.upload();
    }
};

XrDepthSensing.prototype.update = function (frame, view) {
    if (view) {
        if (! this._depthInfo) this._matrixDirty = true;
        this._depthInfo = frame.getDepthInformation(view);
    } else {
        if (this._depthInfo) this._matrixDirty = true;
        this._depthInfo = null;
    }

    this._updateTexture();

    if (this._matrixDirty) {
        this._matrixDirty = false;

        if (this._depthInfo) {
            this._matrix.data.set(this._depthInfo.normTextureFromNormView.matrix);
        } else {
            this._matrix.setIdentity();
        }
    }

    if (this._depthInfo && ! this._available) {
        this._available = true;
        this.fire('available');
    } else if (! this._depthInfo && this._available) {
        this._available = false;
        this.fire('unavailable');
    }
};

/**
 * @function
 * @name pc.XrDepthSensing#getDepth
 * @param {number} x - x coordinate of pixel in depth texture.
 * @param {number} y - y coordinate of pixel in depth texture.
 * @description Get depth value from depth information in meters. X and Y coordinates are in depth texture space, use {@link pc.XrDepthSensing#width} and {@link pc.XrDepthSensing#height}. This is not using GPU texture, and is a CPU path.
 * @example
 * var depth = app.xr.depthSensing.getDepth(x, y);
 * if (depth !== null) {
 *     // depth in meters
 * }
 * @returns {number|null} Depth in meters or null if depth information is not available.
 */
XrDepthSensing.prototype.getDepth = function (x, y) {
    if (! this._depthInfo)
        return null;

    return this._depthInfo.getDepth(x, y);
};

Object.defineProperty(XrDepthSensing.prototype, 'supported', {
    get: function () {
        return !! window.XRDepthInformation;
    }
});

/**
 * @name pc.XrDepthSensing#available
 * @type {boolean}
 * @description True if depth sensing information is available.
 * @example
 * if (app.xr.depthSensing.available) {
 *     var depth = app.xr.depthSensing.getDepth(x, y);
 * }
 */
Object.defineProperty(XrDepthSensing.prototype, 'available', {
    get: function () {
        return this._available;
    }
});

Object.defineProperty(XrDepthSensing.prototype, 'width', {
    get: function () {
        return this._depthInfo && this._depthInfo.width || 0;
    }
});

Object.defineProperty(XrDepthSensing.prototype, 'height', {
    get: function () {
        return this._depthInfo && this._depthInfo.height || 0;
    }
});

/* eslint-disable */
/**
 * @name pc.XrDepthSensing#texture
 * @type {pc.Texture}
 * @description Texture that contains packed depth information. Format of this texture is {@link pc.PIXELFORMAT_L8_A8}. And is UV transformed based on onderlying AR system, which can be normalized using {@link pc.XrDepthSensing#uvMatrix}.
 * @example
 * material.diffuseMap = depthSensing.texture;
 * @example
 * // GLSL shader to unpack depth texture
 * varying vec2 vUv0;
 *
 * uniform sampler2D texture_depthSensingMap;
 * uniform mat4 matrix_depth_uv;
 *
 * void main(void) {
 *     // transform UVs using depth matrix
 *     vec2 texCoord = (matrix_depth_uv * vec4(vUv0.xy, 0.0, 1.0)).xy;
 *
 *     // get luminance alpha components from depth texture
 *     vec2 packedDepth = texture2D(texture_depthSensingMap, texCoord).ra;
 *
 *     // unpack into single value in millimeters
 *     float depth = dot(packedDepth, vec2(255.0, 256.0 * 255.0)); // mm
 *
 *     // normalize: 0m to 8m distance
 *     depth = min(depth / 8000.0, 1.0); // 0..1 = 0m..8m
 *
 *     // paint scene from black to white based on distance
 *     gl_FragColor = vec4(depth, depth, depth, 1.0);
 * }
 */
/* eslint-enable */
Object.defineProperty(XrDepthSensing.prototype, 'texture', {
    get: function () {
        return this._texture;
    }
});

/**
 * @name pc.XrDepthSensing#uvMatrix
 * @type {pc.Mat4}
 * @description Data of 4x4 matrix that should be used to transform depth texture UVs to normalized UVs in a shader. It is updated when depth texture is resized, refer to {@link pc.XrDepthSensing#resize}
 * @example
 * material.setParameter('matrix_depth_uv', depthSensing.uvMatrix.data);
 */
Object.defineProperty(XrDepthSensing.prototype, 'uvMatrix', {
    get: function () {
        return this._matrix;
    }
});

export { XrDepthSensing };
