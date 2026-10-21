import { math } from '../../core/math/math.js';
import { Mat4 } from '../../core/math/mat4.js';
import { Quat } from '../../core/math/quat.js';
import { Vec3 } from '../../core/math/vec3.js';
import { PROJECTION_PERSPECTIVE } from '../../scene/constants.js';
import { COLOR_AMBER, COLOR_CYAN, COLOR_MAGENTA } from './color.js';
import { HelperGizmo } from './helper-gizmo.js';

/**
 * @import { CameraComponent } from '../../framework/components/camera/component.js'
 * @import { Entity } from '../../framework/entity.js'
 * @import { Layer } from '../../scene/layer.js'
 * @import { HelperHandle } from './helper-gizmo.js'
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
 * Draws the view frustum of each attached camera entity: a bold near plane with a filled triangle
 * on its top edge that shows the camera's up direction, lighter sides and far plane, a faint
 * volume and a dashed view axis. Once the frustum is large enough on screen, handles drag the
 * near and far clip planes and the field of view, or the orthographic height, each showing its
 * value while hovered. Entities without an enabled camera component are skipped, as is the camera
 * viewing the gizmo.
 *
 * ```javascript
 * const layer = new Layer({ name: 'Helpers', transparentSortMode: SORTMODE_MANUAL });
 * app.scene.layers.push(layer);
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
class CameraGizmo extends HelperGizmo {
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
        const shapes = this._shapes;
        const camera = /** @type {CameraComponent} */ (entity.camera);
        const { nearClip: near, farClip: far } = camera;
        const perspective = camera.projection === PROJECTION_PERSPECTIVE;
        const position = entity.getPosition();
        if (this.iconOnly) {
            this._icon('camera', position, entity);
            return;
        }

        // the corners are in the camera's space, which ignores the entity scale
        const rotation = entity.getRotation();
        tmpM.setTRS(position, rotation, Vec3.ONE);
        const points = camera.camera.getFrustumCorners();
        const nearX = 0.5 * (points[0].x - points[3].x);
        const nearY = 0.5 * (points[1].y - points[0].y);
        const farX = 0.5 * (points[4].x - points[7].x);
        const farY = 0.5 * (points[5].y - points[4].y);

        // the up marker, its base on the middle 40% of the near top edge, flattened onto the plane
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
                shapes.cone('frustum', center, tmpQ1.copy(rotation).mul(CONE_TO_VIEW), size, 1, true, nearX / farX);
            } else {
                shapes.box(center, rotation, tmpV2.set(2 * farX, 2 * farY, far - near));
            }
        }

        // far plane and sides, then the bold near plane and its up marker
        for (let i = 0; i < FAR.length; i += 2) {
            shapes.line(corners[FAR[i]], corners[FAR[i + 1]], 0.8, 0.85);
        }
        for (let i = 0; i < SIDES.length; i += 2) {
            shapes.line(corners[SIDES[i]], corners[SIDES[i + 1]], 0.7, 0.7);
        }
        for (let i = 0; i < NEAR.length; i += 2) {
            shapes.line(corners[NEAR[i]], corners[NEAR[i + 1]], 1.1);
        }
        shapes.cone('triangle', top, tmpQ1.copy(rotation).mul(CONE_TO_VIEW), triangle, 0.9, false);

        // the near and far handles slide along the view axis, colored while one is active
        const axis = this._active(entity, 'nearClip', 0) ? COLOR_CYAN :
            this._active(entity, 'farClip', 0) ? COLOR_AMBER : null;
        shapes.dashed(nearCenter, farCenter, axis ? 1 : 0.55, axis ? 1 : 0.6, axis);
        this._icon('camera', position, entity);

        if (!this._detailed(farCenter, farY)) {
            return;
        }

        // the view handle sits on the far edge the field of view is measured across
        const forward = entity.forward;
        if (this._handle(nearCenter, COLOR_CYAN, entity, 'nearClip', 0, position, forward, false, false)) {
            this._readoutAt(nearCenter, 'N', COLOR_CYAN, near);
        }
        if (this._handle(farCenter, COLOR_AMBER, entity, 'farClip', 0, position, forward, false, false)) {
            this._readoutAt(farCenter, 'F', COLOR_AMBER, far);
        }
        const horizontal = perspective && camera.horizontalFov;
        const edge = horizontal ? tmpV5.lerp(corners[4], corners[5], 0.5) : tmpV5.lerp(corners[5], corners[6], 0.5);
        if (this._handle(edge, COLOR_MAGENTA, entity, perspective ? 'fov' : 'orthoHeight', 0, farCenter, horizontal ? entity.right : entity.up)) {
            if (perspective) {
                this._readoutAt(edge, 'θ', COLOR_MAGENTA, camera.fov, '°');
            } else {
                this._readoutAt(edge, 'h', COLOR_MAGENTA, camera.orthoHeight);
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
     * Edits the clip range, field of view or orthographic height of the dragged handle's camera.
     *
     * @param {HelperHandle} handle - The dragged handle.
     * @param {Vec3} point - Where the handle is dragged to.
     * @protected
     * @override
     */
    _moveHandle(handle, point) {
        const camera = /** @type {CameraComponent} */ (/** @type {Entity} */ (handle.node).camera);
        const dist = tmpV1.sub2(point, handle.origin).dot(handle.dir);
        switch (handle.name) {
            case 'nearClip': {
                camera.nearClip = math.clamp(dist, MIN_CLIP, camera.farClip - MIN_CLIP);
                break;
            }
            case 'farClip': {
                camera.farClip = Math.max(dist, camera.nearClip + MIN_CLIP);
                break;
            }
            case 'fov': {
                camera.fov = math.clamp(2 * Math.atan2(dist, camera.farClip) * math.RAD_TO_DEG, 1, 179);
                break;
            }
            case 'orthoHeight': {
                camera.orthoHeight = Math.max(dist, MIN_CLIP);
                break;
            }
        }
    }
}

export { CameraGizmo };
