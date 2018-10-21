Object.assign(pc, function () {
    var tmpVecA = new pc.Vec3();
    var tmpVecB = new pc.Vec3();
    var tmpVecC = new pc.Vec3();
    var tmpVecD = new pc.Vec3();
    var tmpVecE = new pc.Vec3();

    /**
     * @constructor
     * @name pc.BoundingBox
     * @description Create a new axis-aligned bounding box.
     * @classdesc Axis-Aligned Bounding Box.
     * @param {pc.Vec3} [center] Center of box. The constructor takes a reference of this parameter.
     * @param {pc.Vec3} [halfExtents] Half the distance across the box in each axis. The constructor takes a reference of this parameter.
     */
    var BoundingBox = function BoundingBox(center, halfExtents) {
        this.center = center || new pc.Vec3(0, 0, 0);
        this.halfExtents = halfExtents || new pc.Vec3(0.5, 0.5, 0.5);
        this._min = new pc.Vec3();
        this._max = new pc.Vec3();
    };

    Object.assign(BoundingBox.prototype, {

        /**
         * @function
         * @name pc.BoundingBox#add
         * @description Combines two bounding boxes into one, enclosing both.
         * @param {pc.BoundingBox} other Bounding box to add.
         */
        add: function (other) {
            var tc = this.center;
            var tcx = tc.x;
            var tcy = tc.y;
            var tcz = tc.z;
            var th = this.halfExtents;
            var thx = th.x;
            var thy = th.y;
            var thz = th.z;
            var tminx = tcx - thx;
            var tmaxx = tcx + thx;
            var tminy = tcy - thy;
            var tmaxy = tcy + thy;
            var tminz = tcz - thz;
            var tmaxz = tcz + thz;

            var oc = other.center;
            var ocx = oc.x;
            var ocy = oc.y;
            var ocz = oc.z;
            var oh = other.halfExtents;
            var ohx = oh.x;
            var ohy = oh.y;
            var ohz = oh.z;
            var ominx = ocx - ohx;
            var omaxx = ocx + ohx;
            var ominy = ocy - ohy;
            var omaxy = ocy + ohy;
            var ominz = ocz - ohz;
            var omaxz = ocz + ohz;

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
        },

        copy: function (src) {
            this.center.copy(src.center);
            this.halfExtents.copy(src.halfExtents);
            this.type = src.type;
        },

        clone: function () {
            return new pc.BoundingBox(this.center.clone(), this.halfExtents.clone());
        },

        /**
         * @function
         * @name pc.BoundingBox#intersects
         * @description Test whether two axis-aligned bounding boxes intersect.
         * @param {pc.BoundingBox} other Bounding box to test against.
         * @returns {Boolean} True if there is an intersection.
         */
        intersects: function (other) {
            var aMax = this.getMax();
            var aMin = this.getMin();
            var bMax = other.getMax();
            var bMin = other.getMin();

            return (aMin.x <= bMax.x) && (aMax.x >= bMin.x) &&
                   (aMin.y <= bMax.y) && (aMax.y >= bMin.y) &&
                   (aMin.z <= bMax.z) && (aMax.z >= bMin.z);
        },

        _intersectsRay: function (ray, point) {
            var tMin = tmpVecA.copy(this.getMin()).sub(ray.origin);
            var tMax = tmpVecB.copy(this.getMax()).sub(ray.origin);
            var dir = ray.direction;

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

            var realMin = tmpVecC.set(Math.min(tMin.x, tMax.x), Math.min(tMin.y, tMax.y), Math.min(tMin.z, tMax.z));
            var realMax = tmpVecD.set(Math.max(tMin.x, tMax.x), Math.max(tMin.y, tMax.y), Math.max(tMin.z, tMax.z));

            var minMax = Math.min(Math.min(realMax.x, realMax.y), realMax.z);
            var maxMin = Math.max(Math.max(realMin.x, realMin.y), realMin.z);

            var intersects = minMax >= maxMin && maxMin >= 0;

            if (intersects)
                point.copy(ray.direction).scale(maxMin).add(ray.origin);

            return intersects;
        },

        _fastIntersectsRay: function (ray) {
            var diff = tmpVecA;
            var cross = tmpVecB;
            var prod = tmpVecC;
            var absDiff = tmpVecD;
            var absDir = tmpVecE;
            var rayDir = ray.direction;

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
        },

        /**
         * @function
         * @name pc.BoundingBox#intersectsRay
         * @description Test if a ray intersects with the AABB.
         * @param {pc.Ray} ray Ray to test against (direction must be normalized).
         * @param {pc.Vec3} [point] If there is an intersection, the intersection point will be copied into here.
         * @returns {Boolean} True if there is an intersection.
         */
        intersectsRay: function (ray, point) {
            if (point) {
                return this._intersectsRay(ray, point);
            }

            return this._fastIntersectsRay(ray);
        },

        setMinMax: function (min, max) {
            this.center.add2(max, min).scale(0.5);
            this.halfExtents.sub2(max, min).scale(0.5);
        },

        /**
         * @function
         * @name pc.BoundingBox#getMin
         * @description Return the minimum corner of the AABB.
         * @returns {pc.Vec3} minimum corner.
         */
        getMin: function () {
            return this._min.copy(this.center).sub(this.halfExtents);
        },

        /**
         * @function
         * @name pc.BoundingBox#getMax
         * @description Return the maximum corner of the AABB.
         * @returns {pc.Vec3} maximum corner.
         */
        getMax: function () {
            return this._max.copy(this.center).add(this.halfExtents);
        },

        /**
         * @function
         * @name pc.BoundingBox#containsPoint
         * @description Test if a point is inside a AABB.
         * @param {pc.Vec3} point Point to test.
         * @returns {Boolean} true if the point is inside the AABB and false otherwise.
         */
        containsPoint: function (point) {
            var min = this.getMin();
            var max = this.getMax();

            if (point.x < min.x || point.x > max.x ||
                point.y < min.y || point.y > max.y ||
                point.z < min.z || point.z > max.z) {
                return false;
            }

            return true;
        },

        /**
         * @function
         * @name pc.BoundingBox#setFromTransformedAabb
         * @description Set an AABB to enclose the specified AABB if it were to be
         * transformed by the specified 4x4 matrix.
         * @param {pc.BoundingBox} aabb Box to transform and enclose
         * @param {pc.Mat4} m Transformation matrix to apply to source AABB.
         */
        setFromTransformedAabb: function (aabb, m) {
            var bc = this.center;
            var br = this.halfExtents;
            var ac = aabb.center;
            var ar = aabb.halfExtents;

            m = m.data;
            var mx0 = m[0];
            var mx1 = m[4];
            var mx2 = m[8];
            var my0 = m[1];
            var my1 = m[5];
            var my2 = m[9];
            var mz0 = m[2];
            var mz1 = m[6];
            var mz2 = m[10];

            var mx0a = Math.abs(mx0);
            var mx1a = Math.abs(mx1);
            var mx2a = Math.abs(mx2);
            var my0a = Math.abs(my0);
            var my1a = Math.abs(my1);
            var my2a = Math.abs(my2);
            var mz0a = Math.abs(mz0);
            var mz1a = Math.abs(mz1);
            var mz2a = Math.abs(mz2);

            bc.set(
                m[12] + mx0 * ac.x + mx1 * ac.y + mx2 * ac.z,
                m[13] + my0 * ac.x + my1 * ac.y + my2 * ac.z,
                m[14] + mz0 * ac.x + mz1 * ac.y + mz2 * ac.z
            );

            br.set(
                mx0a * ar.x + mx1a * ar.y + mx2a * ar.z,
                my0a * ar.x + my1a * ar.y + my2a * ar.z,
                mz0a * ar.x + mz1a * ar.y + mz2a * ar.z
            );
        },

        compute: function (vertices) {
            var min = tmpVecA.set(vertices[0], vertices[1], vertices[2]);
            var max = tmpVecB.set(vertices[0], vertices[1], vertices[2]);
            var numVerts = vertices.length / 3;

            for (var i = 1; i < numVerts; i++) {
                var x = vertices[i * 3 + 0];
                var y = vertices[i * 3 + 1];
                var z = vertices[i * 3 + 2];
                if (x < min.x) min.x = x;
                if (y < min.y) min.y = y;
                if (z < min.z) min.z = z;
                if (x > max.x) max.x = x;
                if (y > max.y) max.y = y;
                if (z > max.z) max.z = z;
            }

            this.setMinMax(min, max);
        },

        /**
         * @function
         * @name pc.BoundingBox#intersectsBoundingSphere
         * @description Test if a Bounding Sphere is overlapping, enveloping, or inside this AABB.
         * @param {pc.BoundingSphere} sphere Bounding Sphere to test.
         * @returns {Boolean} true if the Bounding Sphere is overlapping, enveloping, or inside the AABB and false otherwise.
         */
        intersectsBoundingSphere: function (sphere) {
            var sq = this._distanceToBoundingSphereSq(sphere);
            if (sq <= sphere.radius * sphere.radius) {
                return true;
            }

            return false;
        },

        _distanceToBoundingSphereSq: function (sphere) {
            var boxMin = this.getMin();
            var boxMax = this.getMax();

            var sq = 0;
            var axis = ['x', 'y', 'z'];

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
    });

    return {
        BoundingBox: BoundingBox
    };
}());
