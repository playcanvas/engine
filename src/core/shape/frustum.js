import { Plane } from './plane.js';
import { Vec3 } from '../math/vec3.js';

/**
 * @import { BoundingSphere } from './bounding-sphere.js'
 * @import { Mat4 } from '../math/mat4.js'
 */

// temporaries for three-plane intersection
const _c23 = new Vec3();
const _c31 = new Vec3();
const _c12 = new Vec3();
const _corner = new Vec3();

/**
 * Intersects three planes and writes the intersection point to out.
 *
 * @param {Plane} p1 - The first plane.
 * @param {Plane} p2 - The second plane.
 * @param {Plane} p3 - The third plane.
 * @param {Vec3} out - The intersection point.
 * @returns {boolean} False when the planes do not intersect in a single finite point.
 */
function intersectPlanes(p1, p2, p3, out) {
    _c23.cross(p2.normal, p3.normal);
    const denom = p1.normal.dot(_c23);
    if (Math.abs(denom) < 1e-6) {
        return false;
    }
    _c31.cross(p3.normal, p1.normal);
    _c12.cross(p1.normal, p2.normal);
    const invDenom = -1.0 / denom;
    out.set(
        (p1.distance * _c23.x + p2.distance * _c31.x + p3.distance * _c12.x) * invDenom,
        (p1.distance * _c23.y + p2.distance * _c31.y + p3.distance * _c12.y) * invDenom,
        (p1.distance * _c23.z + p2.distance * _c31.z + p3.distance * _c12.z) * invDenom
    );
    return isFinite(out.x) && isFinite(out.y) && isFinite(out.z);
}

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
        const d = matrix.data;
        const m00 = d[0], m01 = d[1], m02 = d[2], m03 = d[3];
        const m10 = d[4], m11 = d[5], m12 = d[6], m13 = d[7];
        const m20 = d[8], m21 = d[9], m22 = d[10], m23 = d[11];
        const m30 = d[12], m31 = d[13], m32 = d[14], m33 = d[15];
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
     * Expands this frustum to also contain another frustum. The other frustum's 8 corner points
     * are computed, and each of this frustum's planes is pushed outwards just far enough to
     * contain them all. The result is a conservative convex volume that contains both frustums.
     * This is useful for multi-view rendering such as stereo XR, where culling should keep
     * objects visible in any view.
     *
     * Note: keeping each plane's orientation makes this correct for arbitrary frusta, including
     * the asymmetric per-eye projections of XR headsets, where matching planes of the two eyes
     * have different normals and a per-plane "outermost" selection would wrongly cut into the
     * combined volume at a distance.
     *
     * @param {Frustum} other - The other frustum to add.
     * @returns {Frustum} Self for chaining.
     */
    add(other) {
        const planes = this.planes;
        const op = other.planes;

        // The 8 corners of the other frustum: intersections of (FAR|NEAR) x (RIGHT|LEFT) x
        // (BOTTOM|TOP) plane triplets - see the plane order in setFromMat4.
        for (let zi = 4; zi <= 5; zi++) {
            for (let xi = 0; xi <= 1; xi++) {
                for (let yi = 2; yi <= 3; yi++) {
                    if (intersectPlanes(op[zi], op[xi], op[yi], _corner)) {
                        // push out any plane the corner is behind, so it ends up on the plane
                        for (let p = 0; p < 6; p++) {
                            const plane = planes[p];
                            const d = plane.normal.dot(_corner) + plane.distance;
                            if (d < 0) {
                                plane.distance -= d;
                            }
                        }
                    }
                }
            }
        }
        return this;
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
