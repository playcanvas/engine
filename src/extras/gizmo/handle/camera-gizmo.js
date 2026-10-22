import { math } from '../../../core/math/math.js';
import { Mat4 } from '../../../core/math/mat4.js';
import { Quat } from '../../../core/math/quat.js';
import { Vec3 } from '../../../core/math/vec3.js';
import { PROJECTION_PERSPECTIVE } from '../../../scene/constants.js';
import { HandleGizmo } from './handle-gizmo.js';

/**
 * @import { CameraComponent } from '../../../framework/components/camera/component.js'
 * @import { Entity } from '../../../framework/entity.js'
 * @import { Layer } from '../../../scene/layer.js'
 * @import { GizmoHandle } from './handle-gizmo.js'
 */

const tmpM = new Mat4();
const tmpV1 = new Vec3();
const tmpV2 = new Vec3();
const tmpV3 = new Vec3();
const tmpV4 = new Vec3();
const tmpV5 = new Vec3();
const tmpV6 = new Vec3();
const tmpQ1 = new Quat();
const corners = Array.from({ length: 8 }, () => new Vec3());

const NEAR = [0, 1, 1, 2, 2, 3, 3, 0];
const FAR = [4, 5, 5, 6, 6, 7, 7, 4];
const SIDES = [0, 4, 1, 5, 2, 6, 3, 7];

const CONE_TO_VIEW = new Quat().setFromEulerAngles(90, 0, 0);

const FRUSTUM_HALF_SIDE = 0.5 * Math.SQRT1_2;
const TRIANGLE_BASE = 0.5 * Math.sqrt(3);
const TRIANGLE_HEIGHT = 0.75;

const MIN_CLIP = 1e-3;

/**
 * Draws the view frustum of each attached camera entity, with a triangle marking its up direction.
 * Handles drag the near and far clip planes and the field of view or orthographic height. The
 * camera viewing the gizmo is skipped.
 *
 * ```javascript
 * const layer = Gizmo.createLayer(app, 'Overlays', undefined, true);
 * const gizmo = new CameraGizmo(cameraComponent, layer);
 * gizmo.attach([otherCameraEntity]);
 * ```
 *
 * Relevant Engine API examples:
 *
 * - [Camera Gizmo](https://playcanvas.github.io/#/gizmos/camera)
 *
 * @category Gizmo
 */
class CameraGizmo extends HandleGizmo {
    /**
     * Creates a new CameraGizmo object.
     *
     * @param {CameraComponent} camera - The camera component.
     * @param {Layer} layer - The render layer.
     * @example
     * const gizmo = new CameraGizmo(camera, layer);
     */
    constructor(camera, layer) {
        super(camera, layer, 'gizmo:camera');
    }

    /**
     * Places the frustum of a camera.
     *
     * @param {Entity} entity - The camera entity.
     * @private
     */
    _draw(entity) {
        const renderer = this._renderer;
        const camera = /** @type {CameraComponent} */ (entity.camera);
        const { nearClip: near, farClip: far } = camera;
        const perspective = camera.projection === PROJECTION_PERSPECTIVE;
        const position = entity.getPosition();

        // frustum corners ignore the entity scale
        const rotation = entity.getRotation();
        tmpM.setTRS(position, rotation, Vec3.ONE);
        const points = camera.camera.getFrustumCorners();
        const nearX = 0.5 * (points[0].x - points[3].x);
        const nearY = 0.5 * (points[1].y - points[0].y);
        const farX = 0.5 * (points[4].x - points[7].x);
        const farY = 0.5 * (points[5].y - points[4].y);

        // the up marker spans the middle 40% of the near top edge
        const triangle = tmpV1.set(0.8 * nearX / TRIANGLE_BASE, 1e-3 * nearY, 0.6 * nearY / TRIANGLE_HEIGHT);
        const top = tmpM.transformPoint(tmpV6.set(0.5 * (points[1].x + points[2].x), points[1].y + 0.25 * triangle.z, -near), tmpV6);

        for (let i = 0; i < 8; i++) {
            tmpM.transformPoint(points[i], corners[i]);
        }

        const nearCenter = tmpM.transformPoint(tmpV3.set(0, 0, -near), tmpV3);
        const farCenter = tmpM.transformPoint(tmpV4.set(0, 0, -far), tmpV4);
        if (this._theme.fill.a > 0) {
            const center = tmpV5.lerp(nearCenter, farCenter, 0.5);
            if (perspective) {
                const size = tmpV2.set(farX / FRUSTUM_HALF_SIDE, far - near, farY / FRUSTUM_HALF_SIDE);
                renderer.cone('frustum', center, tmpQ1.copy(rotation).mul(CONE_TO_VIEW), size, 1, true, nearX / farX);
            } else {
                renderer.box(center, rotation, tmpV2.set(2 * farX, 2 * farY, far - near));
            }
        }

        for (let i = 0; i < FAR.length; i += 2) {
            renderer.line(corners[FAR[i]], corners[FAR[i + 1]], 0.8, 0.85);
        }
        for (let i = 0; i < SIDES.length; i += 2) {
            renderer.line(corners[SIDES[i]], corners[SIDES[i + 1]], 0.7, 0.7);
        }
        for (let i = 0; i < NEAR.length; i += 2) {
            renderer.line(corners[NEAR[i]], corners[NEAR[i + 1]], 1.1);
        }
        renderer.cone('triangle', top, tmpQ1.copy(rotation).mul(CONE_TO_VIEW), triangle, 0.9, false);

        // the view axis, colored while a clip handle is active
        const axis = this._active(entity, 'nearClip', 0) ? this._theme.secondary :
            this._active(entity, 'farClip', 0) ? this._theme.primary : null;
        renderer.dashed(nearCenter, farCenter, axis ? 1 : 0.55, axis ? 1 : 0.6, axis);
        this._icon('camera', position, entity);

        if (!this._detailed(farCenter, farY)) {
            return;
        }

        // the view handle sits on the far edge the field of view spans
        const forward = entity.forward;
        if (this._handle(nearCenter, this._theme.secondary, entity, 'nearClip', 0, position, forward, false, false)) {
            this._readoutAt(nearCenter, 'N', this._theme.secondary, near);
        }
        if (this._handle(farCenter, this._theme.primary, entity, 'farClip', 0, position, forward, false, false)) {
            this._readoutAt(farCenter, 'F', this._theme.primary, far);
        }
        const horizontal = perspective && camera.horizontalFov;
        const edge = horizontal ? tmpV5.lerp(corners[4], corners[5], 0.5) : tmpV5.lerp(corners[5], corners[6], 0.5);
        if (this._handle(edge, this._theme.tertiary, entity, perspective ? 'fov' : 'orthoHeight', 0, farCenter, horizontal ? entity.right : entity.up)) {
            if (perspective) {
                this._readoutAt(edge, 'θ', this._theme.tertiary, camera.fov, '°');
            } else {
                this._readoutAt(edge, 'h', this._theme.tertiary, camera.orthoHeight);
            }
        }
    }

    /**
     * Places the frustums of the attached cameras.
     *
     * @protected
     * @override
     */
    _drawShapes() {
        for (let i = 0; i < this.nodes.length; i++) {
            const entity = /** @type {Entity} */ (this.nodes[i]);
            const { camera } = entity;
            if (entity.enabled && camera?.enabled && camera !== this._camera) {
                this._draw(entity);
            }
        }
    }

    /**
     * Edits the clip range, field of view or orthographic height of the dragged camera.
     *
     * @param {GizmoHandle} handle - The dragged handle.
     * @param {Vec3} point - Where the handle is dragged to.
     * @protected
     * @override
     */
    _moveHandle(handle, point) {
        const camera = /** @type {CameraComponent} */ (/** @type {Entity} */ (handle.node).camera);
        const dist = tmpV1.sub2(point, handle.origin).dot(handle.dir);
        switch (handle.name) {
            case 'nearClip': {
                camera.nearClip = math.clamp(this._snapLength(dist), MIN_CLIP, camera.farClip - MIN_CLIP);
                break;
            }
            case 'farClip': {
                camera.farClip = Math.max(this._snapLength(dist), camera.nearClip + MIN_CLIP);
                break;
            }
            case 'fov': {
                camera.fov = math.clamp(this._snapAngle(2 * Math.atan2(dist, camera.farClip) * math.RAD_TO_DEG), 1, 179);
                break;
            }
            case 'orthoHeight': {
                camera.orthoHeight = Math.max(this._snapLength(dist), MIN_CLIP);
                break;
            }
        }
    }
}

export { CameraGizmo };
