import { Mat4 } from '../math/mat4.js';
import { Vec3 } from '../math/vec3.js';

import { BoundingBox } from './bounding-box.js';
import { BoundingSphere } from './bounding-sphere.js';
import { Ray } from './ray.js';

const tmpRay = new Ray();
const tmpVec3 = new Vec3();
const tmpSphere = new BoundingSphere();
const tmpMat4 = new Mat4();

/**
 * Oriented Box.
 *
 * @category Math
 */
class OrientedBox {
    /**
     * @type {Vec3}
     * @private
     */
    halfExtents = new Vec3(0.5, 0.5, 0.5);

    /**
     * @type {Mat4}
     * @private
     */
    _modelTransform;

    /**
     * @type {Mat4}
     * @private
     */
    _worldTransform;

    /**
     * @type {BoundingBox}
     * @private
     */
    _aabb;

    /**
     * Create a new OrientedBox instance.
     *
     * @param {Mat4} [worldTransform] - Transform that has the orientation and position of the box.
     * Scale is assumed to be one. Defaults to identity matrix.
     * @param {Vec3} [halfExtents] - Half the distance across the box in each local axis. Defaults
     * to (0.5, 0.5, 0.5).
     */
    constructor(worldTransform = new Mat4(), halfExtents) {

        if (halfExtents) {
            this.halfExtents.copy(halfExtents);
        }

        this._modelTransform = worldTransform.clone().invert();
        this._worldTransform = worldTransform.clone();
        this._aabb = new BoundingBox(new Vec3(), this.halfExtents);
    }

    /**
     * Sets the world transform of the OBB.
     *
     * @type {Mat4}
     */
    set worldTransform(value) {
        this._worldTransform.copy(value);
        this._modelTransform.copy(value).invert();
    }

    /**
     * Gets the world transform of the OBB.
     *
     * @type {Mat4}
     */
    get worldTransform() {
        return this._worldTransform;
    }

    /**
     * Test if a ray intersects with the OBB.
     *
     * @param {Ray} ray - Ray to test against (direction must be normalized).
     * @param {Vec3} [point] - If there is an intersection, the intersection point will be copied
     * into here.
     * @returns {boolean} True if there is an intersection.
     */
    intersectsRay(ray, point) {
        this._modelTransform.transformPoint(ray.origin, tmpRay.origin);
        this._modelTransform.transformVector(ray.direction, tmpRay.direction);

        if (point) {
            const result = this._aabb._intersectsRay(tmpRay, point);
            tmpMat4.copy(this._modelTransform).invert().transformPoint(point, point);
            return result;
        }

        return this._aabb._fastIntersectsRay(tmpRay);
    }

    /**
     * Test if a point is inside a OBB.
     *
     * @param {Vec3} point - Point to test.
     * @returns {boolean} True if the point is inside the OBB and false otherwise.
     */
    containsPoint(point) {
        this._modelTransform.transformPoint(point, tmpVec3);
        return this._aabb.containsPoint(tmpVec3);
    }

    /**
     * Test if a Bounding Sphere is overlapping, enveloping, or inside this OBB.
     *
     * @param {BoundingSphere} sphere - Bounding Sphere to test.
     * @returns {boolean} True if the Bounding Sphere is overlapping, enveloping or inside this OBB
     * and false otherwise.
     */
    intersectsBoundingSphere(sphere) {
        this._modelTransform.transformPoint(sphere.center, tmpSphere.center);
        tmpSphere.radius = sphere.radius;

        if (this._aabb.intersectsBoundingSphere(tmpSphere)) {
            return true;
        }

        return false;
    }
}

export { OrientedBox };
