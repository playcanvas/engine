import { Plane } from './plane.js';

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
     * @private
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
     * Updates the frustum shape based on the supplied 4x4 matrix.
     *
     * @param {import('../math/mat4.js').Mat4} matrix - The matrix describing the shape of the
     * frustum.
     * @example
     * // Create a perspective projection matrix
     * const projMat = pc.Mat4();
     * projMat.setPerspective(45, 16 / 9, 1, 1000);
     *
     * // Create a frustum shape that is represented by the matrix
     * const frustum = new pc.Frustum();
     * frustum.setFromMat4(projMat);
     */
    setFromMat4(matrix) {
        const vpm = matrix.data;
        const planes = this.planes;

        const setPlane = (plane, a, b, c, d) => {
            plane.normal.set(vpm[3] + a * vpm[0], vpm[7] + b * vpm[4], vpm[11] + c * vpm[8]);
            plane.distance = vpm[15] + d * vpm[12];
            plane.normalize();
        };

        // Extract the numbers for the planes
        setPlane(planes[0], -1, -1, -1, -1); // RIGHT
        setPlane(planes[1], 1, 1, 1, 1);     // LEFT
        setPlane(planes[2], 1, 1, 1, 1);     // BOTTOM
        setPlane(planes[3], -1, -1, -1, -1); // TOP
        setPlane(planes[4], -1, -1, -1, -1); // FAR
        setPlane(planes[5], 1, 1, 1, 1);     // NEAR
    }

    /**
     * Tests whether a point is inside the frustum. Note that points lying in a frustum plane are
     * considered to be outside the frustum.
     *
     * @param {import('../math/vec3.js').Vec3} point - The point to test.
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
     * @param {import('./bounding-sphere.js').BoundingSphere} sphere - The sphere to test.
     * @returns {number} 0 if the bounding sphere is outside the frustum, 1 if it intersects the
     * frustum and 2 if it is contained by the frustum.
     */
    containsSphere(sphere) {
        const { center, radius } = sphere;

        let c = 0;
        for (let p = 0; p < 6; p++) {
            const { normal, distance } = this.planes[p];
            const d = normal.dot(center) + distance;
            if (d <= -radius)
                return 0;
            if (d > radius)
                c++;
        }

        return (c === 6) ? 2 : 1;
    }
}

export { Frustum };
