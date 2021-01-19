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
var _halfSize = new Vec3();
var _point = new Vec3();
var _invViewProjMat = new Mat4();

/**
 * @private
 * @class
 * @name Camera
 * @classdesc A camera.
 */
class Camera {
    constructor() {
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
        this._frustumCulling = true;
        this._horizontalFov = false;
        this._layers = [LAYERID_WORLD, LAYERID_DEPTH, LAYERID_SKYBOX, LAYERID_UI, LAYERID_IMMEDIATE];
        this._nearClip = 0.1;
        this._node = null;
        this._orthoHeight = 10;
        this._projection = PROJECTION_PERSPECTIVE;
        this._rect = new Vec4(0, 0, 1, 1);
        this._renderTarget = null;
        this._scissorRect = new Vec4(0, 0, 1, 1);
        this._vrDisplay = null;

        this._projMat = new Mat4();
        this._projMatDirty = true;
        this._projMatSkybox = new Mat4(); // projection matrix used by skybox rendering shader is always perspective
        this._viewMat = new Mat4();
        this._viewMatDirty = true;
        this._viewProjMat = new Mat4();
        this._viewProjMatDirty = true;

        this.frustum = new Frustum();
    }

    get aspectRatio() {
        return this._aspectRatio;
    }

    set aspectRatio(newValue) {
        if (this._aspectRatio !== newValue) {
            this._aspectRatio = newValue;
            this._projMatDirty = true;
        }
    }

    get aspectRatioMode() {
        return this._aspectRatioMode;
    }

    set aspectRatioMode(newValue) {
        if (this._aspectRatioMode !== newValue) {
            this._aspectRatioMode = newValue;
            this._projMatDirty = true;
        }
    }

    get calculateProjection() {
        return this._calculateProjection;
    }

    set calculateProjection(newValue) {
        this._calculateProjection = newValue;
        this._projMatDirty = true;
    }

    get calculateTransform() {
        return this._calculateTransform;
    }

    set calculateTransform(newValue) {
        this._calculateTransform = newValue;
    }

    get clearColor() {
        return this._clearColor;
    }

    set clearColor(newValue) {
        this._clearColor.copy(newValue);
    }

    get clearColorBuffer() {
        return this._clearColorBuffer;
    }

    set clearColorBuffer(newValue) {
        this._clearColorBuffer = newValue;
    }

    get clearDepth() {
        return this._clearDepth;
    }

    set clearDepth(newValue) {
        this._clearDepth = newValue;
    }

    get clearDepthBuffer() {
        return this._clearDepthBuffer;
    }

    set clearDepthBuffer(newValue) {
        this._clearDepthBuffer = newValue;
    }

    get clearStencil() {
        return this._clearStencil;
    }

    set clearStencil(newValue) {
        this._clearStencil = newValue;
    }

    get clearStencilBuffer() {
        return this._clearStencilBuffer;
    }

    set clearStencilBuffer(newValue) {
        this._clearStencilBuffer = newValue;
    }

    get cullingMask() {
        return this._cullingMask;
    }

    set cullingMask(newValue) {
        this._cullingMask = newValue;
    }

    get cullFaces() {
        return this._cullFaces;
    }

    set cullFaces(newValue) {
        this._cullFaces = newValue;
    }

    get farClip() {
        return this._farClip;
    }

    set farClip(newValue) {
        if (this._farClip !== newValue) {
            this._farClip = newValue;
            this._projMatDirty = true;
        }
    }

    get flipFaces() {
        return this._flipFaces;
    }

    set flipFaces(newValue) {
        this._flipFaces = newValue;
    }

    get fov() {
        return this._fov;
    }

    set fov(newValue) {
        if (this._fov !== newValue) {
            this._fov = newValue;
            this._projMatDirty = true;
        }
    }

    get frustumCulling() {
        return this._frustumCulling;
    }

    set frustumCulling(newValue) {
        this._frustumCulling = newValue;
    }

    get horizontalFov() {
        return this._horizontalFov;
    }

    set horizontalFov(newValue) {
        if (this._horizontalFov !== newValue) {
            this._horizontalFov = newValue;
            this._projMatDirty = true;
        }
    }

    get layers() {
        return this._layers;
    }

    set layers(newValue) {
        this._layers = newValue.slice(0);
    }

    get nearClip() {
        return this._nearClip;
    }

    set nearClip(newValue) {
        if (this._nearClip !== newValue) {
            this._nearClip = newValue;
            this._projMatDirty = true;
        }
    }

    get node() {
        return this._node;
    }

    set node(newValue) {
        this._node = newValue;
    }

    get orthoHeight() {
        return this._orthoHeight;
    }

    set orthoHeight(newValue) {
        if (this._orthoHeight !== newValue) {
            this._orthoHeight = newValue;
            this._projMatDirty = true;
        }
    }

    get projection() {
        return this._projection;
    }

    set projection(newValue) {
        if (this._projection !== newValue) {
            this._projection = newValue;
            this._projMatDirty = true;
        }
    }

    get projectionMatrix() {
        this._evaluateProjectionMatrix();
        return this._projMat;
    }

    get rect() {
        return this._rect;
    }

    set rect(newValue) {
        this._rect.copy(newValue);
    }

    get renderTarget() {
        return this._renderTarget;
    }

    set renderTarget(newValue) {
        this._renderTarget = newValue;
    }

    get scissorRect() {
        return this._scissorRect;
    }

    set scissorRect(newValue) {
        this._scissorRect.copy(newValue);
    }

    get viewMatrix() {
        if (this._viewMatDirty) {
            var wtm = this._node.getWorldTransform();
            this._viewMat.copy(wtm).invert();
            this._viewMatDirty = false;
        }
        return this._viewMat;
    }

    get vrDisplay() {
        return this._vrDisplay;
    }

    set vrDisplay(newValue) {
        this._vrDisplay = newValue;
        if (newValue) {
            newValue._camera = this;
        }
    }

    /**
     * @private
     * @function
     * @name Camera#clone
     * @description Creates a duplicate of the camera.
     * @returns {Camera} A cloned Camera.
     */
    clone() {
        return new this.constructor().copy(this);
    }

    copy(other) {
        this.aspectRatio = other.aspectRatio;
        this.aspectRatioMode = other.aspectRatioMode;
        this.calculateProjection = other.calculateProjection;
        this.calculateTransform = other.calculateTransform;
        this.clearColor = other.clearColor;
        this.clearColorBuffer = other.clearColorBuffer;
        this.clearDepth = other.clearDepth;
        this.clearDepthBuffer = other.clearDepthBuffer;
        this.clearStencil = other.clearStencil;
        this.clearStencilBuffer = other.clearStencilBuffer;
        this.cullFaces = other.cullFaces;
        this.cullingMask = other.cullingMask;
        this.farClip = other.farClip;
        this.flipFaces = other.flipFaces;
        this.fov = other.fov;
        this.frustumCulling = other.frustumCulling;
        this.horizontalFov = other.horizontalFov;
        this.layers = other.layers;
        this.nearClip = other.nearClip;
        this.orthoHeight = other.orthoHeight;
        this.projection = other.projection;
        this.rect = other.rect;
        this.renderTarget = other.renderTarget;
        this.scissorRect = other.scissorRect;
        this.vrDisplay = other.vrDisplay;
    }

    _updateViewProjMat() {
        if (this._projMatDirty || this._viewMatDirty || this._viewProjMatDirty) {
            var projMat = this.projectionMatrix;
            var viewMat = this.viewMatrix;
            this._viewProjMat.mul2(projMat, viewMat);
            this._viewProjMatDirty = false;
        }
    }

    /**
     * @private
     * @function
     * @name Camera#worldToScreen
     * @description Convert a point from 3D world space to 2D canvas pixel space.
     * @param {Vec3} worldCoord - The world space coordinate to transform.
     * @param {number} cw - The width of PlayCanvas' canvas element.
     * @param {number} ch - The height of PlayCanvas' canvas element.
     * @param {Vec3} [screenCoord] - 3D vector to receive screen coordinate result.
     * @returns {Vec3} The screen space coordinate.
     */
    worldToScreen(worldCoord, cw, ch, screenCoord = new Vec3()) {
        this._updateViewProjMat();
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
    }

    /**
     * @private
     * @function
     * @name Camera#screenToWorld
     * @description Convert a point from 2D canvas pixel space to 3D world space.
     * @param {number} x - X coordinate on PlayCanvas' canvas element.
     * @param {number} y - Y coordinate on PlayCanvas' canvas element.
     * @param {number} z - The distance from the camera in world space to create the new point.
     * @param {number} cw - The width of PlayCanvas' canvas element.
     * @param {number} ch - The height of PlayCanvas' canvas element.
     * @param {Vec3} [worldCoord] - 3D vector to receive world coordinate result.
     * @returns {Vec3} The world space coordinate.
     */
    screenToWorld(x, y, z, cw, ch, worldCoord = new Vec3()) {

        // Calculate the screen click as a point on the far plane of the normalized device coordinate 'box' (z=1)
        var range = this._farClip - this._nearClip;
        _deviceCoord.set(x / cw, (ch - y) / ch, z / range);
        _deviceCoord.scale(2);
        _deviceCoord.sub(Vec3.ONE);

        if (this._projection === PROJECTION_PERSPECTIVE) {

            // calculate half width and height at the near clip plane
            Mat4._getPerspectiveHalfSize(_halfSize, this._fov, this._aspectRatio, this._nearClip, this._horizontalFov);

            // scale by normalized screen coordinates
            _halfSize.x *= _deviceCoord.x;
            _halfSize.y *= _deviceCoord.y;

            // transform to world space
            var invView = this._node.getWorldTransform();
            _halfSize.z = -this._nearClip;
            invView.transformPoint(_halfSize, _point);

            // point along camera->_point ray at distance z from the camera
            var cameraPos = this._node.getPosition();
            worldCoord.sub2(_point, cameraPos);
            worldCoord.normalize();
            worldCoord.scale(z);
            worldCoord.add(cameraPos);

        } else {

            this._updateViewProjMat();
            _invViewProjMat.copy(this._viewProjMat).invert();

                // Transform to world space
            _invViewProjMat.transformPoint(_deviceCoord, worldCoord);
        }

        return worldCoord;
    }

    _evaluateProjectionMatrix() {
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
    }

    getProjectionMatrixSkybox() {
        this._evaluateProjectionMatrix();
        return this._projMatSkybox;
    }
}

export { Camera };
