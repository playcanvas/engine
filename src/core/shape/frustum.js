/**
 * A frustum is a shape that defines the viewing space of a camera. It can be used to determine
 * visibility of points and bounding spheres. Typically, you would not create a Frustum shape
 * directly, but instead query {@link CameraComponent#frustum}.
 */
class Frustum {
    planes = [];

    /**
     * Create a new Frustum instance.
     *
     * @example
     * const frustum = new pc.Frustum();
     */
    constructor() {
        for (let i = 0; i < 6; i++)
            this.planes[i] = [];
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

        let plane;
        const planes = this.planes;

        // Extract the numbers for the RIGHT plane
        plane = planes[0];
        plane[0] = vpm[3] - vpm[0];
        plane[1] = vpm[7] - vpm[4];
        plane[2] = vpm[11] - vpm[8];
        plane[3] = vpm[15] - vpm[12];
        // Normalize the result
        let t = Math.sqrt(plane[0] * plane[0] + plane[1] * plane[1] + plane[2] * plane[2]);
        plane[0] /= t;
        plane[1] /= t;
        plane[2] /= t;
        plane[3] /= t;

        // Extract the numbers for the LEFT plane
        plane = planes[1];
        plane[0] = vpm[3] + vpm[0];
        plane[1] = vpm[7] + vpm[4];
        plane[2] = vpm[11] + vpm[8];
        plane[3] = vpm[15] + vpm[12];
        // Normalize the result
        t = Math.sqrt(plane[0] * plane[0] + plane[1] * plane[1] + plane[2] * plane[2]);
        plane[0] /= t;
        plane[1] /= t;
        plane[2] /= t;
        plane[3] /= t;

        // Extract the BOTTOM plane
        plane = planes[2];
        plane[0] = vpm[3] + vpm[1];
        plane[1] = vpm[7] + vpm[5];
        plane[2] = vpm[11] + vpm[9];
        plane[3] = vpm[15] + vpm[13];
        // Normalize the result
        t = Math.sqrt(plane[0] * plane[0] + plane[1] * plane[1] + plane[2] * plane[2]);
        plane[0] /= t;
        plane[1] /= t;
        plane[2] /= t;
        plane[3] /= t;

        // Extract the TOP plane
        plane = planes[3];
        plane[0] = vpm[3] - vpm[1];
        plane[1] = vpm[7] - vpm[5];
        plane[2] = vpm[11] - vpm[9];
        plane[3] = vpm[15] - vpm[13];
        // Normalize the result
        t = Math.sqrt(plane[0] * plane[0] + plane[1] * plane[1] + plane[2] * plane[2]);
        plane[0] /= t;
        plane[1] /= t;
        plane[2] /= t;
        plane[3] /= t;

        // Extract the FAR plane
        plane = planes[4];
        plane[0] = vpm[3] - vpm[2];
        plane[1] = vpm[7] - vpm[6];
        plane[2] = vpm[11] - vpm[10];
        plane[3] = vpm[15] - vpm[14];
        // Normalize the result
        t = Math.sqrt(plane[0] * plane[0] + plane[1] * plane[1] + plane[2] * plane[2]);
        plane[0] /= t;
        plane[1] /= t;
        plane[2] /= t;
        plane[3] /= t;

        // Extract the NEAR plane
        plane = planes[5];
        plane[0] = vpm[3] + vpm[2];
        plane[1] = vpm[7] + vpm[6];
        plane[2] = vpm[11] + vpm[10];
        plane[3] = vpm[15] + vpm[14];
        // Normalize the result
        t = Math.sqrt(plane[0] * plane[0] + plane[1] * plane[1] + plane[2] * plane[2]);
        plane[0] /= t;
        plane[1] /= t;
        plane[2] /= t;
        plane[3] /= t;
    }

    /**
     * Tests whether a point is inside the frustum. Note that points lying in a frustum plane are
     * considered to be outside the frustum.
     *
     * @param {import('../math/vec3.js').Vec3} point - The point to test.
     * @returns {boolean} True if the point is inside the frustum, false otherwise.
     */
    containsPoint(point) {
        let p, plane;
        for (p = 0; p < 6; p++) {
            plane = this.planes[p];
            if (plane[0] * point.x + plane[1] * point.y + plane[2] * point.z + plane[3] <= 0) {
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
        let c = 0;
        let d;
        let p;

        const sr = sphere.radius;
        const sc = sphere.center;
        const scx = sc.x;
        const scy = sc.y;
        const scz = sc.z;
        const planes = this.planes;
        let plane;

        for (p = 0; p < 6; p++) {
            plane = planes[p];
            d = plane[0] * scx + plane[1] * scy + plane[2] * scz + plane[3];
            if (d <= -sr)
                return 0;
            if (d > sr)
                c++;
        }

        return (c === 6) ? 2 : 1;
    }
}

export { Frustum };
