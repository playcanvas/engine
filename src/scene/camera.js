import { Color } from '../core/math/color.js';
import { Mat4 } from '../core/math/mat4.js';
import { Vec3 } from '../core/math/vec3.js';
import { Vec4 } from '../core/math/vec4.js';
import { math } from '../core/math/math.js';

import { Frustum } from '../core/shape/frustum.js';

import {
    ASPECT_AUTO, PROJECTION_PERSPECTIVE,
    LAYERID_WORLD, LAYERID_DEPTH, LAYERID_SKYBOX, LAYERID_UI, LAYERID_IMMEDIATE
} from './constants.js';
import { RenderPassColorGrab } from './graphics/render-pass-color-grab.js';
import { RenderPassDepthGrab } from './graphics/render-pass-depth-grab.js';

// pre-allocated temp variables
const _deviceCoord = new Vec3();
const _halfSize = new Vec3();
const _point = new Vec3();
const _invViewProjMat = new Mat4();
const _frustumPoints = [new Vec3(), new Vec3(), new Vec3(), new Vec3(), new Vec3(), new Vec3(), new Vec3(), new Vec3()];

/**
 * A camera.
 *
 * @ignore
 */
class Camera {
    /**
     * @type {import('./shader-pass.js').ShaderPassInfo|null}
     */
    shaderPassInfo = null;

    /**
     * @type {RenderPassColorGrab|null}
     */
    renderPassColorGrab = null;

    /**
     * @type {import('../platform/graphics/render-pass.js').RenderPass|null}
     */
    renderPassDepthGrab = null;

    /**
     * The rendering parameters.
     *
     * @type {import('./renderer/rendering-params.js').RenderingParams|null}
     */
    renderingParams = null;

    /**
     * Render passes used to render this camera. If empty, the camera will render using the default
     * render passes.
     *
     * @type {import('../platform/graphics/render-pass.js').RenderPass[]}
     */
    renderPasses = [];

    /** @type {number} */
    jitter = 0;

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
        this._aperture = 16.0;
        this._shutter = 1.0 / 1000.0;
        this._sensitivity = 1000;

        this._projMat = new Mat4();
        this._projMatDirty = true;
        this._projMatSkybox = new Mat4(); // projection matrix used by skybox rendering shader is always perspective
        this._viewMat = new Mat4();
        this._viewMatDirty = true;
        this._viewProjMat = new Mat4();
        this._viewProjMatDirty = true;

        // storage of actual matrices used by the shaders, needed by TAA
        this._shaderMatricesVersion = 0;
        this._viewProjInverse = new Mat4();     // inverse view projection matrix from the current frame
        this._viewProjCurrent = null;           // view projection matrix from the current frame
        this._viewProjPrevious = new Mat4();    // view projection matrix from the previous frame
        this._jitters = [0, 0, 0, 0];            // jitter values for TAA, 0-1 - current frame, 2-3 - previous frame

        this.frustum = new Frustum();

        // Set by XrManager
        this._xr = null;
        this._xrProperties = {
            horizontalFov: this._horizontalFov,
            fov: this._fov,
            aspectRatio: this._aspectRatio,
            farClip: this._farClip,
            nearClip: this._nearClip
        };
    }

    destroy() {

        this.renderPassColorGrab?.destroy();
        this.renderPassColorGrab = null;

        this.renderPassDepthGrab?.destroy();
        this.renderPassDepthGrab = null;

        this.renderPasses.length = 0;
    }

    /**
     * Store camera matrices required by TAA. Only update them once per frame.
     */
    _storeShaderMatrices(viewProjMat, jitterX, jitterY, renderVersion) {
        if (this._shaderMatricesVersion !== renderVersion) {
            this._shaderMatricesVersion = renderVersion;

            this._viewProjPrevious.copy(this._viewProjCurrent ?? viewProjMat);
            this._viewProjCurrent ??= new Mat4();
            this._viewProjCurrent.copy(viewProjMat);
            this._viewProjInverse.invert(viewProjMat);

            this._jitters[2] = this._jitters[0];
            this._jitters[3] = this._jitters[1];
            this._jitters[0] = jitterX;
            this._jitters[1] = jitterY;
        }
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
        return (this.xr?.active) ? this._xrProperties.aspectRatio : this._aspectRatio;
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
        return (this.xr?.active) ? this._xrProperties.farClip : this._farClip;
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
        return (this.xr?.active) ? this._xrProperties.fov : this._fov;
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
        return (this.xr?.active) ? this._xrProperties.horizontalFov : this._horizontalFov;
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
        return (this.xr?.active) ? this._xrProperties.nearClip : this._nearClip;
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

    set aperture(newValue) {
        this._aperture = newValue;
    }

    get aperture() {
        return this._aperture;
    }

    set sensitivity(newValue) {
        this._sensitivity = newValue;
    }

    get sensitivity() {
        return this._sensitivity;
    }

    set shutter(newValue) {
        this._shutter = newValue;
    }

    get shutter() {
        return this._shutter;
    }

    set xr(newValue) {
        if (this._xr !== newValue) {
            this._xr = newValue;
            this._projMatDirty = true;
        }
    }

    get xr() {
        return this._xr;
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
        // We aren't using the getters and setters because there is additional logic
        // around using WebXR in the getters for these properties so that functions
        // like screenToWorld work correctly with other systems like the UI input
        // system
        this._aspectRatio = other._aspectRatio;
        this._farClip = other._farClip;
        this._fov = other._fov;
        this._horizontalFov = other._horizontalFov;
        this._nearClip = other._nearClip;

        this._xrProperties.aspectRatio = other._xrProperties.aspectRatio;
        this._xrProperties.farClip = other._xrProperties.farClip;
        this._xrProperties.fov = other._xrProperties.fov;
        this._xrProperties.horizontalFov = other._xrProperties.horizontalFov;
        this._xrProperties.nearClip = other._xrProperties.nearClip;

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
        this.flipFaces = other.flipFaces;
        this.frustumCulling = other.frustumCulling;
        this.layers = other.layers;
        this.orthoHeight = other.orthoHeight;
        this.projection = other.projection;
        this.rect = other.rect;
        this.renderTarget = other.renderTarget;
        this.scissorRect = other.scissorRect;
        this.aperture = other.aperture;
        this.shutter = other.shutter;
        this.sensitivity = other.sensitivity;

        this.shaderPassInfo = other.shaderPassInfo;
        this.jitter = other.jitter;

        this._projMatDirty = true;

        return this;
    }

    _enableRenderPassColorGrab(device, enable) {
        if (enable) {
            if (!this.renderPassColorGrab) {
                this.renderPassColorGrab = new RenderPassColorGrab(device);
            }
        } else {
            this.renderPassColorGrab?.destroy();
            this.renderPassColorGrab = null;
        }
    }

    _enableRenderPassDepthGrab(device, renderer, enable) {
        if (enable) {
            if (!this.renderPassDepthGrab) {
                this.renderPassDepthGrab = new RenderPassDepthGrab(device, this);
            }
        } else {
            this.renderPassDepthGrab?.destroy();
            this.renderPassDepthGrab = null;
        }
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
        const range = this.farClip - this.nearClip;
        _deviceCoord.set(x / cw, (ch - y) / ch, z / range);
        _deviceCoord.mulScalar(2);
        _deviceCoord.sub(Vec3.ONE);

        if (this._projection === PROJECTION_PERSPECTIVE) {

            // calculate half width and height at the near clip plane
            Mat4._getPerspectiveHalfSize(_halfSize, this.fov, this.aspectRatio, this.nearClip, this.horizontalFov);

            // scale by normalized screen coordinates
            _halfSize.x *= _deviceCoord.x;
            _halfSize.y *= _deviceCoord.y;

            // transform to world space
            const invView = this._node.getWorldTransform();
            _halfSize.z = -this.nearClip;
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
                this._projMat.setPerspective(this.fov, this.aspectRatio, this.nearClip, this.farClip, this.horizontalFov);
                this._projMatSkybox.copy(this._projMat);
            } else {
                const y = this._orthoHeight;
                const x = y * this.aspectRatio;
                this._projMat.setOrtho(-x, x, -y, y, this.nearClip, this.farClip);
                this._projMatSkybox.setPerspective(this.fov, this.aspectRatio, this.nearClip, this.farClip);
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
            const screenViewHeight = Math.tan((this.fov / 2) * math.DEG_TO_RAD);

            // The ratio of the geometry's screen size compared to the actual size of the screen
            return Math.min(sphereViewHeight / screenViewHeight, 1);

        }

        // ortho
        return math.clamp(sphere.radius / this._orthoHeight, 0, 1);
    }

    /**
     * Returns an array of corners of the frustum of the camera in the local coordinate system of the camera.
     *
     * @param {number} [near] - Near distance for the frustum points. Defaults to the near clip distance of the camera.
     * @param {number} [far] - Far distance for the frustum points. Defaults to the far clip distance of the camera.
     * @returns {Vec3[]} - An array of corners, using a global storage space.
     */
    getFrustumCorners(near = this.nearClip, far = this.farClip) {

        const fov = this.fov * Math.PI / 180.0;
        let y = this._projection === PROJECTION_PERSPECTIVE ? Math.tan(fov / 2.0) * near : this._orthoHeight;
        let x = y * this.aspectRatio;

        const points = _frustumPoints;
        points[0].x = x;
        points[0].y = -y;
        points[0].z = -near;
        points[1].x = x;
        points[1].y = y;
        points[1].z = -near;
        points[2].x = -x;
        points[2].y = y;
        points[2].z = -near;
        points[3].x = -x;
        points[3].y = -y;
        points[3].z = -near;

        if (this._projection === PROJECTION_PERSPECTIVE) {
            y = Math.tan(fov / 2.0) * far;
            x = y * this.aspectRatio;
        }
        points[4].x = x;
        points[4].y = -y;
        points[4].z = -far;
        points[5].x = x;
        points[5].y = y;
        points[5].z = -far;
        points[6].x = -x;
        points[6].y = y;
        points[6].z = -far;
        points[7].x = -x;
        points[7].y = -y;
        points[7].z = -far;

        return points;
    }

    /**
     * Sets XR camera properties that should be derived physical camera in {@link XrManager}.
     *
     * @param {object} [properties] - Properties object.
     * @param {number} [properties.aspectRatio] - Aspect ratio.
     * @param {number} [properties.farClip] - Far clip.
     * @param {number} [properties.fov] - Field of view.
     * @param {boolean} [properties.horizontalFov] - Enable horizontal field of view.
     * @param {number} [properties.nearClip] - Near clip.
     */
    setXrProperties(properties) {
        Object.assign(this._xrProperties, properties);
        this._projMatDirty = true;
    }
}

export { Camera };
