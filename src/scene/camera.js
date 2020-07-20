import { Color } from '../core/color.js';

import { Mat4 } from '../math/mat4.js';
import { Vec3 } from '../math/vec3.js';
import { Vec4 } from '../math/vec4.js';

import { Frustum } from '../shape/frustum.js';

import {
    ASPECT_AUTO, PROJECTION_PERSPECTIVE,
    LAYERID_WORLD, LAYERID_DEPTH, LAYERID_SKYBOX, LAYERID_UI, LAYERID_IMMEDIATE
} from './constants.js';

// pre-allocated temp variables
var _deviceCoord = new Vec3();
var _far = new Vec3();
var _farW = new Vec3();
var _invViewProjMat = new Mat4();

/**
 * @private
 * @class
 * @name pc.Camera
 * @classdesc A camera.
 */
function Camera() {
    this._aspectRatio = 16 / 9;
    this._aspectRatioMode = ASPECT_AUTO;
    this._calculateProjection = null;
    this._calculateTransform = null;
    this._clearColor = new Color(0.75, 0.75, 0.75, 1);
    this._clearColorBuffer = true;
    this._clearDepth = 1;
    this._clearDepthBuffer = true;
    this._clearStencil = 0;
    this._clearStencilBuffer = true;
    this._cullingMask = 0xFFFFFFFF;
    this._cullFaces = true;
    this._farClip = 1000;
    this._flipFaces = false;
    this._fov = 45;
    this._frustumCulling = false;
    this._horizontalFov = false;
    this._layers = [LAYERID_WORLD, LAYERID_DEPTH, LAYERID_SKYBOX, LAYERID_UI, LAYERID_IMMEDIATE];
    this._nearClip = 0.1;
    this._orthoHeight = 10;
    this._projection = PROJECTION_PERSPECTIVE;
    this._rect = new Vec4(0, 0, 1, 1);
    this._scissorRect = new Vec4(0, 0, 1, 1);

    this._renderDepthRequests = 0;

    this._projMat = new Mat4();
    this._projMatDirty = true;
    this._projMatSkybox = new Mat4(); // projection matrix used by skybox rendering shader is always perspective
    this._viewMat = new Mat4();
    this._viewMatDirty = true;
    this._viewProjMat = new Mat4();
    this._viewProjMatDirty = true;

    this.frustum = new Frustum(this._projMat, this._viewMat);

    this._node = null;

    this.vrDisplay = null;
}

Object.defineProperty(Camera.prototype, 'aspectRatio', {
    get: function () {
        return this._aspectRatio;
    },
    set: function (v) {
        if (this._aspectRatio !== v) {
            this._aspectRatio = v;
            this._projMatDirty = true;
        }
    }
});

Object.defineProperty(Camera.prototype, 'aspectRatioMode', {
    get: function () {
        return this._aspectRatioMode;
    },
    set: function (newValue) {
        if (this._aspectRatioMode !== v) {
            this._aspectRatioMode = newValue;
            this._projMatDirty = true;
        }
    }
});

Object.defineProperty(Camera.prototype, "calculateProjection", {
    get: function () {
        return this._calculateProjection;
    },
    set: function (newValue) {
        this._calculateProjection = newValue;
        this._projMatDirty = true;
    }
});

Object.defineProperty(Camera.prototype, "calculateTransform", {
    get: function () {
        return this._calculateTransform;
    },
    set: function (newValue) {
        this._calculateTransform = newValue;
    }
});

Object.defineProperty(Camera.prototype, 'clearColor', {
    get: function () {
        return this._clearColor;
    },
    set: function (newValue) {
        this._clearColor.copy(newValue);
    }
});

Object.defineProperty(Camera.prototype, 'clearColorBuffer', {
    get: function () {
        return this._clearColorBuffer;
    },
    set: function (newValue) {
        this._clearColorBuffer = newValue;
    }
});

Object.defineProperty(Camera.prototype, 'clearDepth', {
    get: function () {
        return this._clearDepth;
    },
    set: function (newValue) {
        this._clearDepth = newValue;
    }
});

Object.defineProperty(Camera.prototype, 'clearDepthBuffer', {
    get: function () {
        return this._clearDepthBuffer;
    },
    set: function (newValue) {
        this._clearDepthBuffer = newValue;
    }
});

Object.defineProperty(Camera.prototype, 'clearStencil', {
    get: function () {
        return this._clearStencil;
    },
    set: function (newValue) {
        this._clearStencil = newValue;
    }
});

Object.defineProperty(Camera.prototype, 'clearStencilBuffer', {
    get: function () {
        return this._clearStencilBuffer;
    },
    set: function (newValue) {
        this._clearStencilBuffer = newValue;
    }
});

Object.defineProperty(Camera.prototype, 'cullingMask', {
    get: function () {
        return this._cullingMask;
    },
    set: function (newValue) {
        this._cullingMask = newValue;
    }
});

Object.defineProperty(Camera.prototype, 'cullFaces', {
    get: function () {
        return this._cullFaces;
    },
    set: function (newValue) {
        this._cullFaces = newValue;
    }
});

Object.defineProperty(Camera.prototype, 'farClip', {
    get: function () {
        return this._farClip;
    },
    set: function (v) {
        if (this._farClip !== v) {
            this._farClip = v;
            this._projMatDirty = true;
        }
    }
});

Object.defineProperty(Camera.prototype, 'flipFaces', {
    get: function () {
        return this._flipFaces;
    },
    set: function (newValue) {
        this._flipFaces = newValue;
    }
});

Object.defineProperty(Camera.prototype, 'fov', {
    get: function () {
        return this._fov;
    },
    set: function (v) {
        if (this._fov !== v) {
            this._fov = v;
            this._projMatDirty = true;
        }
    }
});

Object.defineProperty(Camera.prototype, 'frustumCulling', {
    get: function () {
        return this._frustumCulling;
    },
    set: function (newValue) {
        this._frustumCulling = newValue;
    }
});

Object.defineProperty(Camera.prototype, 'horizontalFov', {
    get: function () {
        return this._horizontalFov;
    },
    set: function (v) {
        if (this._horizontalFov !== v) {
            this._horizontalFov = v;
            this._projMatDirty = true;
        }
    }
});

Object.defineProperty(Camera.prototype, 'layers', {
    get: function () {
        return this._layers;
    },
    set: function (newValue) {
        this._layers = newValue.slice(0);
    }
});


Object.defineProperty(Camera.prototype, 'nearClip', {
    get: function () {
        return this._nearClip;
    },
    set: function (v) {
        if (this._nearClip !== v) {
            this._nearClip = v;
            this._projMatDirty = true;
        }
    }
});

Object.defineProperty(Camera.prototype, 'node', {
    get: function () {
        return this._node;
    },
    set: function (newValue) {
        this._node = newValue;
    }
});

Object.defineProperty(Camera.prototype, 'orthoHeight', {
    get: function () {
        return this._orthoHeight;
    },
    set: function (v) {
        if (this._orthoHeight !== v) {
            this._orthoHeight = v;
            this._projMatDirty = true;
        }
    }
});

Object.defineProperty(Camera.prototype, 'projection', {
    get: function () {
        return this._projection;
    },
    set: function (v) {
        if (this._projection !== v) {
            this._projection = v;
            this._projMatDirty = true;
        }
    }
});

Object.defineProperty(Camera.prototype, 'rect', {
    get: function () {
        return this._rect;
    },
    set: function (newValue) {
        this._rect.copy(newValue);
    }
});

Object.defineProperty(Camera.prototype, 'scissorRect', {
    get: function () {
        return this._scissorRect;
    },
    set: function (newValue) {
        this._scissorRect.copy(newValue);
    }
});

Object.assign(Camera.prototype, {
    /**
     * @private
     * @function
     * @name pc.Camera#clone
     * @description Creates a duplicate of the camera.
     * @returns {pc.Camera} A cloned Camera.
     */
    clone: function () {
        return new this.constructor().copy(this);
    },

    copy: function(other) {
        this.aspectRatio = other.aspectRatio;
        this.aspectRatioMode = other.aspectRatioMode;
        this.clearColor = other.clearColor;
        this.clearColorBuffer = other.clearColorBuffer;
        this.clearDepth = other.clearDepth;
        this.clearDepthBuffer = other.clearDepthBuffer;
        this.clearStencil = other.clearStencil;
        this.clearStencilBuffer = other.clearStencilBuffer;
        this.cullFaces = other.cullFaces;
        this.farClip = other.farClip;
        this.flipFaces = other.flipFaces;
        this.fov = other.fov;
        this.frustumCulling = other.frustumCulling;
        this.horizontalFov = other.horizontalFov;
        this.nearClip = other.nearClip;
        this.orthoHeight = other.orthoHeight;
        this.projection = other.projection;
        this.rect = other.rect;
        this.scissorRect = other.scissorRect;
    },

    /**
     * @private
     * @function
     * @name pc.Camera#worldToScreen
     * @description Convert a point from 3D world space to 2D canvas pixel space.
     * @param {pc.Vec3} worldCoord - The world space coordinate to transform.
     * @param {number} cw - The width of PlayCanvas' canvas element.
     * @param {number} ch - The height of PlayCanvas' canvas element.
     * @param {pc.Vec3} [screenCoord] - 3D vector to receive screen coordinate result.
     * @returns {pc.Vec3} The screen space coordinate.
     */
    worldToScreen: function (worldCoord, cw, ch, screenCoord) {
        if (screenCoord === undefined) {
            screenCoord = new Vec3();
        }

        if (this._projMatDirty || this._viewMatDirty || this._viewProjMatDirty) {
            var projMat = this.getProjectionMatrix();
            var viewMat = this.getViewMatrix();
            this._viewProjMat.mul2(projMat, viewMat);
            this._viewProjMatDirty = false;
        }
        this._viewProjMat.transformPoint(worldCoord, screenCoord);

        // calculate w co-coord
        var vpm = this._viewProjMat.data;
        var w = worldCoord.x * vpm[3] +
                worldCoord.y * vpm[7] +
                worldCoord.z * vpm[11] +
                           1 * vpm[15];

        screenCoord.x = (screenCoord.x / w + 1) * 0.5 * cw;
        screenCoord.y = (1 - screenCoord.y / w) * 0.5 * ch;

        return screenCoord;
    },

    /**
     * @private
     * @function
     * @name pc.Camera#screenToWorld
     * @description Convert a point from 2D canvas pixel space to 3D world space.
     * @param {number} x - X coordinate on PlayCanvas' canvas element.
     * @param {number} y - Y coordinate on PlayCanvas' canvas element.
     * @param {number} z - The distance from the camera in world space to create the new point.
     * @param {number} cw - The width of PlayCanvas' canvas element.
     * @param {number} ch - The height of PlayCanvas' canvas element.
     * @param {pc.Vec3} [worldCoord] - 3D vector to receive world coordinate result.
     * @returns {pc.Vec3} The world space coordinate.
     */
    screenToWorld: function (x, y, z, cw, ch, worldCoord) {
        if (worldCoord === undefined) {
            worldCoord = new Vec3();
        }

        if (this._projMatDirty || this._viewMatDirty || this._viewProjMatDirty) {
            var projMat = this.getProjectionMatrix();
            var viewMat = this.getViewMatrix();
            this._viewProjMat.mul2(projMat, viewMat);
            this._viewProjMatDirty = false;
        }
        _invViewProjMat.copy(this._viewProjMat).invert();

        if (this._projection === PROJECTION_PERSPECTIVE) {
            // Calculate the screen click as a point on the far plane of the
            // normalized device coordinate 'box' (z=1)
            _far.set(x / cw * 2 - 1, (ch - y) / ch * 2 - 1, 1);

            // Transform to world space
            _invViewProjMat.transformPoint(_far, _farW);

            var w = _far.x * _invViewProjMat.data[3] +
                    _far.y * _invViewProjMat.data[7] +
                    _far.z * _invViewProjMat.data[11] +
                    _invViewProjMat.data[15];

            _farW.scale(1 / w);

            var alpha = z / this._farClip;
            worldCoord.lerp(this._node.getPosition(), _farW, alpha);
        } else {
            // Calculate the screen click as a point on the far plane of the
            // normalized device coordinate 'box' (z=1)
            var range = this._farClip - this._nearClip;
            _deviceCoord.set(x / cw, (ch - y) / ch, z / range);
            _deviceCoord.scale(2);
            _deviceCoord.sub(Vec3.ONE);

            // Transform to world space
            _invViewProjMat.transformPoint(_deviceCoord, worldCoord);
        }

        return worldCoord;
    },

    _evaluateProjectionMatrix: function () {
        if (this._projMatDirty) {
            if (this._projection === PROJECTION_PERSPECTIVE) {
                this._projMat.setPerspective(this._fov, this._aspectRatio, this._nearClip, this._farClip, this._horizontalFov);
                this._projMatSkybox.copy(this._projMat);
            } else {
                var y = this._orthoHeight;
                var x = y * this._aspectRatio;
                this._projMat.setOrtho(-x, x, -y, y, this._nearClip, this._farClip);
                this._projMatSkybox.setPerspective(this._fov, this._aspectRatio, this._nearClip, this._farClip);
            }

            this._projMatDirty = false;
        }
    },

    /**
     * @private
     * @function
     * @name pc.Camera#getProjectionMatrix
     * @description Retrieves the projection matrix for the specified camera.
     * @returns {pc.Mat4} The camera's projection matrix.
     */
    getProjectionMatrix: function () {
        this._evaluateProjectionMatrix();
        return this._projMat;
    },

    getProjectionMatrixSkybox: function () {
        this._evaluateProjectionMatrix();
        return this._projMatSkybox;
    },

    /**
     * @private
     * @function
     * @name pc.Camera#getViewMatrix
     * @description Retrieves the view matrix for the specified camera based on the entity world transformation.
     * @returns {pc.Mat4} The camera's view matrix.
     */
    getViewMatrix: function () {
        if (this._viewMatDirty) {
            var wtm = this._node.getWorldTransform();
            this._viewMat.copy(wtm).invert();
            this._viewMatDirty = false;
        }
        return this._viewMat;
    },

    requestDepthMap: function () {
        this._renderDepthRequests++;
    },

    releaseDepthMap: function () {
        this._renderDepthRequests--;
    }
});

export { Camera };
