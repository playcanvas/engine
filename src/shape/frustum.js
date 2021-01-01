/**
 * @class
 * @name pc.Frustum
 * @classdesc A frustum is a shape that defines the viewing space of a camera. It can be
 * used to determine visibility of points and bounding spheres. Typically, you would not
 * create a Frustum shape directly, but instead query {@link pc.CameraComponent#frustum}.
 * @description Creates a new frustum shape.
 * @example
 * var frustum = new pc.Frustum();
 */
class Frustum {
    constructor() {
        this.planes = [];
        for (var i = 0; i < 6; i++)
            this.planes[i] = [];
    }

    /**
     * @function
     * @name pc.Frustum#setFromMat4
     * @description Updates the frustum shape based on the supplied 4x4 matrix.
     * @param {pc.Mat4} matrix - The matrix describing the shape of the frustum.
     * @example
     * // Create a perspective projection matrix
     * var projMat = pc.Mat4();
     * projMat.setPerspective(45, 16 / 9, 1, 1000);
     *
     * // Create a frustum shape that is represented by the matrix
     * var frustum = new pc.Frustum();
     * frustum.setFromMat4(projMat);
     */
    setFromMat4(matrix) {
        var vpm = matrix.data;

        var plane;
        var planes = this.planes;

        // Extract the numbers for the RIGHT plane
        plane = planes[0];
        plane[0] = vpm[3] - vpm[0];
        plane[1] = vpm[7] - vpm[4];
        plane[2] = vpm[11] - vpm[8];
        plane[3] = vpm[15] - vpm[12];
        // Normalize the result
        var t = Math.sqrt(plane[0] * plane[0] + plane[1] * plane[1] + plane[2] * plane[2]);
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
     * @function
     * @name pc.Frustum#containsPoint
     * @description Tests whether a point is inside the frustum. Note that points lying in a frustum plane are
     * considered to be outside the frustum.
     * @param {pc.Vec3} point - The point to test.
     * @returns {boolean} True if the point is inside the frustum, false otherwise.
     */
    containsPoint(point) {
        var p, plane;
        for (p = 0; p < 6; p++) {
            plane = this.planes[p];
            if (plane[0] * point.x + plane[1] * point.y + plane[2] * point.z + plane[3] <= 0) {
                return false;
            }
        }
        return true;
    }

    /**
     * @function
     * @name pc.Frustum#containsSphere
     * @description Tests whether a bounding sphere intersects the frustum. If the sphere is outside the frustum,
     * zero is returned. If the sphere intersects the frustum, 1 is returned. If the sphere is completely inside
     * the frustum, 2 is returned. Note that a sphere touching a frustum plane from the outside is considered to
     * be outside the frustum.
     * @param {pc.BoundingSphere} sphere - The sphere to test.
     * @returns {number} 0 if the bounding sphere is outside the frustum, 1 if it intersects the frustum and 2 if
     * it is contained by the frustum.
     */
    containsSphere(sphere) {
        var c = 0;
        var d;
        var p;

        var sr = sphere.radius;
        var sc = sphere.center;
        var scx = sc.x;
        var scy = sc.y;
        var scz = sc.z;
        var planes = this.planes;
        var plane;

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
