import { Color } from '../math/color.js';
import { Mat4 } from '../math/mat4.js';
import { Vec3 } from '../math/vec3.js';
import { Vec4 } from '../math/vec4.js';
import { math } from '../math/math.js';

import { Frustum } from '../shape/frustum.js';

import {
    ASPECT_AUTO, PROJECTION_PERSPECTIVE,
    LAYERID_WORLD, LAYERID_DEPTH, LAYERID_SKYBOX, LAYERID_UI, LAYERID_IMMEDIATE
} from './constants.js';

// pre-allocated temp variables
const _deviceCoord = new Vec3();
const _halfSize = new Vec3();
const _point = new Vec3();
const _invViewProjMat = new Mat4();

/**
 * A camera.
 *
 * @ignore
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
        this._layersSet = new Set(this._layers);
        this._nearClip = 0.1;
        this._node = null;
        this._orthoHeight = 10;
        this._projection = PROJECTION_PERSPECTIVE;
        this._rect = new Vec4(0, 0, 1, 1);
        this._renderTarget = null;
        this._scissorRect = new Vec4(0, 0, 1, 1);
        this._scissorRectClear = false; // by default rect is used when clearing. this allows scissorRect to be used when clearing.
        this._aperture = 1.4;
        this._shutter = 1;
        this._sensitivity = 100;

        this._projMat = new Mat4();
        this._projMatDirty = true;
        this._projMatSkybox = new Mat4(); // projection matrix used by skybox rendering shader is always perspective
        this._viewMat = new Mat4();
        this._viewMatDirty = true;
        this._viewProjMat = new Mat4();
        this._viewProjMatDirty = true;

        this.frustum = new Frustum();
    }

    /**
     * True if the camera clears the full render target. (viewport / scissor are full size)
     */
    get fullSizeClearRect() {

        const rect = this._scissorRectClear ? this.scissorRect : this._rect;
        return rect.x === 0 && rect.y === 0 && rect.z === 1 && rect.w === 1;
    }

    set aspectRatio(newValue) {
        if (this._aspectRatio !== newValue) {
            this._aspectRatio = newValue;
            this._projMatDirty = true;
        }
    }

    get aspectRatio() {
        return this._aspectRatio;
    }

    set aspectRatioMode(newValue) {
        if (this._aspectRatioMode !== newValue) {
            this._aspectRatioMode = newValue;
            this._projMatDirty = true;
        }
    }

    get aspectRatioMode() {
        return this._aspectRatioMode;
    }

    set calculateProjection(newValue) {
        this._calculateProjection = newValue;
        this._projMatDirty = true;
    }

    get calculateProjection() {
        return this._calculateProjection;
    }

    set calculateTransform(newValue) {
        this._calculateTransform = newValue;
    }

    get calculateTransform() {
        return this._calculateTransform;
    }

    set clearColor(newValue) {
        this._clearColor.copy(newValue);
    }

    get clearColor() {
        return this._clearColor;
    }

    set clearColorBuffer(newValue) {
        this._clearColorBuffer = newValue;
    }

    get clearColorBuffer() {
        return this._clearColorBuffer;
    }

    set clearDepth(newValue) {
        this._clearDepth = newValue;
    }

    get clearDepth() {
        return this._clearDepth;
    }

    set clearDepthBuffer(newValue) {
        this._clearDepthBuffer = newValue;
    }

    get clearDepthBuffer() {
        return this._clearDepthBuffer;
    }

    set clearStencil(newValue) {
        this._clearStencil = newValue;
    }

    get clearStencil() {
        return this._clearStencil;
    }

    set clearStencilBuffer(newValue) {
        this._clearStencilBuffer = newValue;
    }

    get clearStencilBuffer() {
        return this._clearStencilBuffer;
    }

    set cullingMask(newValue) {
        this._cullingMask = newValue;
    }

    get cullingMask() {
        return this._cullingMask;
    }

    set cullFaces(newValue) {
        this._cullFaces = newValue;
    }

    get cullFaces() {
        return this._cullFaces;
    }

    set farClip(newValue) {
        if (this._farClip !== newValue) {
            this._farClip = newValue;
            this._projMatDirty = true;
        }
    }

    get farClip() {
        return this._farClip;
    }

    set flipFaces(newValue) {
        this._flipFaces = newValue;
    }

    get flipFaces() {
        return this._flipFaces;
    }

    set fov(newValue) {
        if (this._fov !== newValue) {
            this._fov = newValue;
            this._projMatDirty = true;
        }
    }

    get fov() {
        return this._fov;
    }

    set frustumCulling(newValue) {
        this._frustumCulling = newValue;
    }

    get frustumCulling() {
        return this._frustumCulling;
    }

    set horizontalFov(newValue) {
        if (this._horizontalFov !== newValue) {
            this._horizontalFov = newValue;
            this._projMatDirty = true;
        }
    }

    get horizontalFov() {
        return this._horizontalFov;
    }

    set layers(newValue) {
        this._layers = newValue.slice(0);
        this._layersSet = new Set(this._layers);
    }

    get layers() {
        return this._layers;
    }

    get layersSet() {
        return this._layersSet;
    }

    set nearClip(newValue) {
        if (this._nearClip !== newValue) {
            this._nearClip = newValue;
            this._projMatDirty = true;
        }
    }

    get nearClip() {
        return this._nearClip;
    }

    set node(newValue) {
        this._node = newValue;
    }

    get node() {
        return this._node;
    }

    set orthoHeight(newValue) {
        if (this._orthoHeight !== newValue) {
            this._orthoHeight = newValue;
            this._projMatDirty = true;
        }
    }

    get orthoHeight() {
        return this._orthoHeight;
    }

    set projection(newValue) {
        if (this._projection !== newValue) {
            this._projection = newValue;
            this._projMatDirty = true;
        }
    }

    get projection() {
        return this._projection;
    }

    get projectionMatrix() {
        this._evaluateProjectionMatrix();
        return this._projMat;
    }

    set rect(newValue) {
        this._rect.copy(newValue);
    }

    get rect() {
        return this._rect;
    }

    set renderTarget(newValue) {
        this._renderTarget = newValue;
    }

    get renderTarget() {
        return this._renderTarget;
    }

    set scissorRect(newValue) {
        this._scissorRect.copy(newValue);
    }

    get scissorRect() {
        return this._scissorRect;
    }

    get viewMatrix() {
        if (this._viewMatDirty) {
            const wtm = this._node.getWorldTransform();
            this._viewMat.copy(wtm).invert();
            this._viewMatDirty = false;
        }
        return this._viewMat;
    }

    /**
     * Creates a duplicate of the camera.
     *
     * @returns {Camera} A cloned Camera.
     */
    clone() {
        return new Camera().copy(this);
    }

    /**
     * Copies one camera to another.
     *
     * @param {Camera} other - Camera to copy.
     * @returns {Camera} Self for chaining.
     */
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
        this.aperture = other.aperture;
        this.shutter = other.shutter;
        this.sensitivity = other.sensitivity;
        return this;
    }

    _updateViewProjMat() {
        if (this._projMatDirty || this._viewMatDirty || this._viewProjMatDirty) {
            this._viewProjMat.mul2(this.projectionMatrix, this.viewMatrix);
            this._viewProjMatDirty = false;
        }
    }

    /**
     * Convert a point from 3D world space to 2D canvas pixel space.
     *
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
        const vpm = this._viewProjMat.data;
        const w = worldCoord.x * vpm[3] +
                worldCoord.y * vpm[7] +
                worldCoord.z * vpm[11] +
                           1 * vpm[15];

        screenCoord.x = (screenCoord.x / w + 1) * 0.5 * cw;
        screenCoord.y = (1 - screenCoord.y / w) * 0.5 * ch;

        return screenCoord;
    }

    /**
     * Convert a point from 2D canvas pixel space to 3D world space.
     *
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
        const range = this._farClip - this._nearClip;
        _deviceCoord.set(x / cw, (ch - y) / ch, z / range);
        _deviceCoord.mulScalar(2);
        _deviceCoord.sub(Vec3.ONE);

        if (this._projection === PROJECTION_PERSPECTIVE) {

            // calculate half width and height at the near clip plane
            Mat4._getPerspectiveHalfSize(_halfSize, this._fov, this._aspectRatio, this._nearClip, this._horizontalFov);

            // scale by normalized screen coordinates
            _halfSize.x *= _deviceCoord.x;
            _halfSize.y *= _deviceCoord.y;

            // transform to world space
            const invView = this._node.getWorldTransform();
            _halfSize.z = -this._nearClip;
            invView.transformPoint(_halfSize, _point);

            // point along camera->_point ray at distance z from the camera
            const cameraPos = this._node.getPosition();
            worldCoord.sub2(_point, cameraPos);
            worldCoord.normalize();
            worldCoord.mulScalar(z);
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
                const y = this._orthoHeight;
                const x = y * this._aspectRatio;
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

    getExposure() {
        const ev100 = Math.log2((this._aperture * this._aperture) / this._shutter * 100.0 / this._sensitivity);
        return 1.0 / (Math.pow(2.0, ev100) * 1.2);
    }

    // returns estimated size of the sphere on the screen in range of [0..1]
    // 0 - infinitely small, 1 - full screen or larger
    getScreenSize(sphere) {

        if (this._projection === PROJECTION_PERSPECTIVE) {

            // camera to sphere distance
            const distance = this._node.getPosition().distance(sphere.center);

            // if we're inside the sphere
            if (distance < sphere.radius) {
                return 1;
            }

            // The view-angle of the bounding sphere rendered on screen
            const viewAngle = Math.asin(sphere.radius / distance);

            // This assumes the near clipping plane is at a distance of 1
            const sphereViewHeight = Math.tan(viewAngle);

            // The size of (half) the screen if the near clipping plane is at a distance of 1
            const screenViewHeight = Math.tan((this._fov / 2) * math.DEG_TO_RAD);

            // The ratio of the geometry's screen size compared to the actual size of the screen
            return Math.min(sphereViewHeight / screenViewHeight, 1);

        }

        // ortho
        return math.clamp(sphere.radius / this._orthoHeight, 0, 1);
    }
}

export { Camera };
