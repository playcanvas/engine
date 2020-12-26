import { Vec3 } from '../math/vec3.js';

const tmpVecA = new Vec3();
const tmpVecB = new Vec3();
const tmpVecC = new Vec3();
const tmpVecD = new Vec3();
const tmpVecE = new Vec3();

/**
 * @class
 * @name pc.BoundingBox
 * @description Create a new axis-aligned bounding box.
 * @classdesc Axis-Aligned Bounding Box.
 * @param {pc.Vec3} [center] - Center of box. The constructor takes a reference of this parameter.
 * @param {pc.Vec3} [halfExtents] - Half the distance across the box in each axis. The constructor takes a reference of this parameter.
 * @property {pc.Vec3} center Center of box.
 * @property {pc.Vec3} halfExtents Half the distance across the box in each axis.
 */
class BoundingBox {
    constructor(center = new Vec3(0, 0, 0), halfExtents = new Vec3(0.5, 0.5, 0.5)) {
        this.center = center;
        this.halfExtents = halfExtents;
        this._min = new Vec3();
        this._max = new Vec3();
    }

    /**
     * @function
     * @name pc.BoundingBox#add
     * @description Combines two bounding boxes into one, enclosing both.
     * @param {pc.BoundingBox} other - Bounding box to add.
     */
    add(other) {
        const tc = this.center;
        const tcx = tc.x;
        const tcy = tc.y;
        const tcz = tc.z;
        const th = this.halfExtents;
        const thx = th.x;
        const thy = th.y;
        const thz = th.z;
        let tminx = tcx - thx;
        let tmaxx = tcx + thx;
        let tminy = tcy - thy;
        let tmaxy = tcy + thy;
        let tminz = tcz - thz;
        let tmaxz = tcz + thz;

        const oc = other.center;
        const ocx = oc.x;
        const ocy = oc.y;
        const ocz = oc.z;
        const oh = other.halfExtents;
        const ohx = oh.x;
        const ohy = oh.y;
        const ohz = oh.z;
        const ominx = ocx - ohx;
        const omaxx = ocx + ohx;
        const ominy = ocy - ohy;
        const omaxy = ocy + ohy;
        const ominz = ocz - ohz;
        const omaxz = ocz + ohz;

        if (ominx < tminx) tminx = ominx;
        if (omaxx > tmaxx) tmaxx = omaxx;
        if (ominy < tminy) tminy = ominy;
        if (omaxy > tmaxy) tmaxy = omaxy;
        if (ominz < tminz) tminz = ominz;
        if (omaxz > tmaxz) tmaxz = omaxz;

        tc.x = (tminx + tmaxx) * 0.5;
        tc.y = (tminy + tmaxy) * 0.5;
        tc.z = (tminz + tmaxz) * 0.5;
        th.x = (tmaxx - tminx) * 0.5;
        th.y = (tmaxy - tminy) * 0.5;
        th.z = (tmaxz - tminz) * 0.5;
    }

    /**
     * @function
     * @name pc.BoundingBox#copy
     * @description Copies the contents of a source AABB.
     * @param {pc.BoundingBox} src - The AABB to copy from.
     */
    copy(src) {
        this.center.copy(src.center);
        this.halfExtents.copy(src.halfExtents);
        this.type = src.type;
    }

    /**
     * @function
     * @name pc.BoundingBox#clone
     * @description Returns a clone of the AABB
     * @returns {pc.BoundingBox} A duplicate AABB.
     */
    clone() {
        return new BoundingBox(this.center.clone(), this.halfExtents.clone());
    }

    /**
     * @function
     * @name pc.BoundingBox#intersects
     * @description Test whether two axis-aligned bounding boxes intersect.
     * @param {pc.BoundingBox} other - Bounding box to test against.
     * @returns {boolean} True if there is an intersection.
     */
    intersects(other) {
        const aMax = this.getMax();
        const aMin = this.getMin();
        const bMax = other.getMax();
        const bMin = other.getMin();

        return (aMin.x <= bMax.x) && (aMax.x >= bMin.x) &&
               (aMin.y <= bMax.y) && (aMax.y >= bMin.y) &&
               (aMin.z <= bMax.z) && (aMax.z >= bMin.z);
    }

    _intersectsRay(ray, point) {
        const tMin = tmpVecA.copy(this.getMin()).sub(ray.origin);
        const tMax = tmpVecB.copy(this.getMax()).sub(ray.origin);
        const dir = ray.direction;

        // Ensure that we are not dividing it by zero
        if (dir.x === 0) {
            tMin.x = tMin.x < 0 ? -Number.MAX_VALUE : Number.MAX_VALUE;
            tMax.x = tMax.x < 0 ? -Number.MAX_VALUE : Number.MAX_VALUE;
        } else {
            tMin.x /= dir.x;
            tMax.x /= dir.x;
        }
        if (dir.y === 0) {
            tMin.y = tMin.y < 0 ? -Number.MAX_VALUE : Number.MAX_VALUE;
            tMax.y = tMax.y < 0 ? -Number.MAX_VALUE : Number.MAX_VALUE;
        } else {
            tMin.y /= dir.y;
            tMax.y /= dir.y;
        }
        if (dir.z === 0) {
            tMin.z = tMin.z < 0 ? -Number.MAX_VALUE : Number.MAX_VALUE;
            tMax.z = tMax.z < 0 ? -Number.MAX_VALUE : Number.MAX_VALUE;
        } else {
            tMin.z /= dir.z;
            tMax.z /= dir.z;
        }

        const realMin = tmpVecC.set(Math.min(tMin.x, tMax.x), Math.min(tMin.y, tMax.y), Math.min(tMin.z, tMax.z));
        const realMax = tmpVecD.set(Math.max(tMin.x, tMax.x), Math.max(tMin.y, tMax.y), Math.max(tMin.z, tMax.z));

        const minMax = Math.min(Math.min(realMax.x, realMax.y), realMax.z);
        const maxMin = Math.max(Math.max(realMin.x, realMin.y), realMin.z);

        const intersects = minMax >= maxMin && maxMin >= 0;

        if (intersects)
            point.copy(ray.direction).scale(maxMin).add(ray.origin);

        return intersects;
    }

    _fastIntersectsRay(ray) {
        const diff = tmpVecA;
        const cross = tmpVecB;
        const prod = tmpVecC;
        const absDiff = tmpVecD;
        const absDir = tmpVecE;
        const rayDir = ray.direction;

        diff.sub2(ray.origin, this.center);
        absDiff.set(Math.abs(diff.x), Math.abs(diff.y), Math.abs(diff.z));

        prod.mul2(diff, rayDir);

        if (absDiff.x > this.halfExtents.x && prod.x >= 0)
            return false;

        if (absDiff.y > this.halfExtents.y && prod.y >= 0)
            return false;

        if (absDiff.z > this.halfExtents.z && prod.z >= 0)
            return false;

        absDir.set(Math.abs(rayDir.x), Math.abs(rayDir.y), Math.abs(rayDir.z));
        cross.cross(rayDir, diff);
        cross.set(Math.abs(cross.x), Math.abs(cross.y), Math.abs(cross.z));

        if (cross.x > this.halfExtents.y * absDir.z + this.halfExtents.z * absDir.y)
            return false;

        if (cross.y > this.halfExtents.x * absDir.z + this.halfExtents.z * absDir.x)
            return false;

        if (cross.z > this.halfExtents.x * absDir.y + this.halfExtents.y * absDir.x)
            return false;

        return true;
    }

    /**
     * @function
     * @name pc.BoundingBox#intersectsRay
     * @description Test if a ray intersects with the AABB.
     * @param {pc.Ray} ray - Ray to test against (direction must be normalized).
     * @param {pc.Vec3} [point] - If there is an intersection, the intersection point will be copied into here.
     * @returns {boolean} True if there is an intersection.
     */
    intersectsRay(ray, point) {
        if (point) {
            return this._intersectsRay(ray, point);
        }

        return this._fastIntersectsRay(ray);
    }

    /**
     * @function
     * @name pc.BoundingBox#setMinMax
     * @description Sets the minimum and maximum corner of the AABB.
     * Using this function is faster than assigning min and max separately.
     * @param {pc.Vec3} min - The minimum corner of the AABB.
     * @param {pc.Vec3} max - The maximum corner of the AABB.
     */
    setMinMax(min, max) {
        this.center.add2(max, min).scale(0.5);
        this.halfExtents.sub2(max, min).scale(0.5);
    }

    /**
     * @function
     * @name pc.BoundingBox#getMin
     * @description Return the minimum corner of the AABB.
     * @returns {pc.Vec3} Minimum corner.
     */
    getMin() {
        return this._min.copy(this.center).sub(this.halfExtents);
    }

    /**
     * @function
     * @name pc.BoundingBox#getMax
     * @description Return the maximum corner of the AABB.
     * @returns {pc.Vec3} Maximum corner.
     */
    getMax() {
        return this._max.copy(this.center).add(this.halfExtents);
    }

    /**
     * @function
     * @name pc.BoundingBox#containsPoint
     * @description Test if a point is inside a AABB.
     * @param {pc.Vec3} point - Point to test.
     * @returns {boolean} True if the point is inside the AABB and false otherwise.
     */
    containsPoint(point) {
        const min = this.getMin();
        const max = this.getMax();

        if (point.x < min.x || point.x > max.x ||
            point.y < min.y || point.y > max.y ||
            point.z < min.z || point.z > max.z) {
            return false;
        }

        return true;
    }

    /**
     * @function
     * @name pc.BoundingBox#setFromTransformedAabb
     * @description Set an AABB to enclose the specified AABB if it were to be
     * transformed by the specified 4x4 matrix.
     * @param {pc.BoundingBox} aabb - Box to transform and enclose.
     * @param {pc.Mat4} m - Transformation matrix to apply to source AABB.
     */
    setFromTransformedAabb(aabb, m) {
        const ac = aabb.center;
        const ar = aabb.halfExtents;

        const d = m.data;
        const mx0 = d[0];
        const mx1 = d[4];
        const mx2 = d[8];
        const my0 = d[1];
        const my1 = d[5];
        const my2 = d[9];
        const mz0 = d[2];
        const mz1 = d[6];
        const mz2 = d[10];

        this.center.set(
            d[12] + mx0 * ac.x + mx1 * ac.y + mx2 * ac.z,
            d[13] + my0 * ac.x + my1 * ac.y + my2 * ac.z,
            d[14] + mz0 * ac.x + mz1 * ac.y + mz2 * ac.z
        );

        this.halfExtents.set(
            Math.abs(mx0) * ar.x + Math.abs(mx1) * ar.y + Math.abs(mx2) * ar.z,
            Math.abs(my0) * ar.x + Math.abs(my1) * ar.y + Math.abs(my2) * ar.z,
            Math.abs(mz0) * ar.x + Math.abs(mz1) * ar.y + Math.abs(mz2) * ar.z
        );
    }

    /**
     * @function
     * @name pc.BoundingBox#compute
     * @description Compute the size of the AABB to encapsulate all specified vertices.
     * @param {number[]|Float32Array} vertices - The vertices used to compute the new size for the AABB.
     * @param {number} [numVerts] - Number of vertices to use from the beginning of vertices array. All vertices are used if not specified.
     */
    compute(vertices, numVerts) {
        numVerts = numVerts === undefined ? vertices.length / 3 : numVerts;
        if (numVerts > 0) {
            const min = tmpVecA.set(vertices[0], vertices[1], vertices[2]);
            const max = tmpVecB.set(vertices[0], vertices[1], vertices[2]);

            for (let i = 1; i < numVerts; i++) {
                const x = vertices[i * 3 + 0];
                const y = vertices[i * 3 + 1];
                const z = vertices[i * 3 + 2];
                if (x < min.x) min.x = x;
                if (y < min.y) min.y = y;
                if (z < min.z) min.z = z;
                if (x > max.x) max.x = x;
                if (y > max.y) max.y = y;
                if (z > max.z) max.z = z;
            }

            this.setMinMax(min, max);
        }
    }

    /**
     * @function
     * @name pc.BoundingBox#intersectsBoundingSphere
     * @description Test if a Bounding Sphere is overlapping, enveloping, or inside this AABB.
     * @param {pc.BoundingSphere} sphere - Bounding Sphere to test.
     * @returns {boolean} True if the Bounding Sphere is overlapping, enveloping, or inside the AABB and false otherwise.
     */
    intersectsBoundingSphere(sphere) {
        const sq = this._distanceToBoundingSphereSq(sphere);
        if (sq <= sphere.radius * sphere.radius) {
            return true;
        }

        return false;
    }

    _distanceToBoundingSphereSq(sphere) {
        const boxMin = this.getMin();
        const boxMax = this.getMax();

        let sq = 0;
        const axis = ['x', 'y', 'z'];

        for (var i = 0; i < 3; ++i) {
            var out = 0;
            var pn = sphere.center[axis[i]];
            var bMin = boxMin[axis[i]];
            var bMax = boxMax[axis[i]];
            var val = 0;

            if (pn < bMin) {
                val = (bMin - pn);
                out += val * val;
            }

            if (pn > bMax) {
                val = (pn - bMax);
                out += val * val;
            }

            sq += out;
        }

        return sq;
    }

    _expand(expandMin, expandMax) {
        tmpVecA.add2(this.getMin(), expandMin);
        tmpVecB.add2(this.getMax(), expandMax);
        this.setMinMax(tmpVecA, tmpVecB);
    }
}

export { BoundingBox };
