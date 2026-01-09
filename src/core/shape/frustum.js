import { Plane } from './plane.js';

/**
 * @import { BoundingSphere } from './bounding-sphere.js'
 * @import { Mat4 } from '../math/mat4.js'
 * @import { Vec3 } from '../math/vec3.js'
 */

/**
 * A frustum is a shape that defines the viewing space of a camera. It can be used to determine
 * visibility of points and bounding spheres. Typically, you would not create a Frustum shape
 * directly, but instead query {@link CameraComponent#frustum}.
 *
 * @category Math
 */
class Frustum {
    /**
     * The six planes that make up the frustum.
     *
     * @type {Plane[]}
     */
    planes = [];

    /**
     * Create a new Frustum instance.
     *
     * @example
     * const frustum = new pc.Frustum();
     */
    constructor() {
        for (let i = 0; i < 6; i++) {
            this.planes[i] = new Plane();
        }
    }

    /**
     * Returns a clone of the specified frustum.
     *
     * @returns {Frustum} A duplicate frustum.
     * @example
     * const frustum = new pc.Frustum();
     * const clone = frustum.clone();
     */
    clone() {
        /** @type {this} */
        const cstr = this.constructor;
        return new cstr().copy(this);
    }

    /**
     * Copies the contents of a source frustum to a destination frustum.
     *
     * @param {Frustum} src - A source frustum to copy to the destination frustum.
     * @returns {Frustum} Self for chaining.
     * @example
     * const src = entity.camera.frustum;
     * const dst = new pc.Frustum();
     * dst.copy(src);
     */
    copy(src) {
        for (let i = 0; i < 6; i++) {
            this.planes[i].copy(src.planes[i]);
        }
        return this;
    }

    /**
     * Updates the frustum shape based on the supplied 4x4 matrix.
     *
     * @param {Mat4} matrix - The matrix describing the shape of the frustum.
     * @example
     * // Create a perspective projection matrix
     * const projection = new pc.Mat4();
     * projection.setPerspective(45, 16 / 9, 1, 1000);
     *
     * // Create a frustum shape that is represented by the matrix
     * const frustum = new pc.Frustum();
     * frustum.setFromMat4(projection);
     */
    setFromMat4(matrix) {
        const [
            m00, m01, m02, m03,
            m10, m11, m12, m13,
            m20, m21, m22, m23,
            m30, m31, m32, m33
        ] = matrix.data;
        const planes = this.planes;

        planes[0].set(m03 - m00, m13 - m10, m23 - m20, m33 - m30).normalize(); // RIGHT
        planes[1].set(m03 + m00, m13 + m10, m23 + m20, m33 + m30).normalize(); // LEFT
        planes[2].set(m03 + m01, m13 + m11, m23 + m21, m33 + m31).normalize(); // BOTTOM
        planes[3].set(m03 - m01, m13 - m11, m23 - m21, m33 - m31).normalize(); // TOP
        planes[4].set(m03 - m02, m13 - m12, m23 - m22, m33 - m32).normalize(); // FAR
        planes[5].set(m03 + m02, m13 + m12, m23 + m22, m33 + m32).normalize(); // NEAR
    }

    /**
     * Tests whether a point is inside the frustum. Note that points lying in a frustum plane are
     * considered to be outside the frustum.
     *
     * @param {Vec3} point - The point to test.
     * @returns {boolean} True if the point is inside the frustum, false otherwise.
     */
    containsPoint(point) {
        for (let p = 0; p < 6; p++) {
            const { normal, distance } = this.planes[p];
            if (normal.dot(point) + distance <= 0) {
                return false;
            }
        }
        return true;
    }

    /**
     * Tests whether a bounding sphere intersects the frustum. If the sphere is outside the
     * frustum, zero is returned. If the sphere intersects the frustum, 1 is returned. If the
     * sphere is completely inside the frustum, 2 is returned. Note that a sphere touching a
     * frustum plane from the outside is considered to be outside the frustum.
     *
     * @param {BoundingSphere} sphere - The sphere to test.
     * @returns {number} 0 if the bounding sphere is outside the frustum, 1 if it intersects the
     * frustum and 2 if it is contained by the frustum.
     */
    containsSphere(sphere) {
        const { center, radius } = sphere;

        let c = 0;
        for (let p = 0; p < 6; p++) {
            const { normal, distance } = this.planes[p];
            const d = normal.dot(center) + distance;
            if (d <= -radius) {
                return 0;
            }
            if (d > radius) {
                c++;
            }
        }

        return (c === 6) ? 2 : 1;
    }
}

export { Frustum };
