pc.extend(pc, function () {
    var tmpVecA = new pc.Vec3();
    var tmpVecB = new pc.Vec3();
    var tmpVecC = new pc.Vec3();
    var tmpVecD = new pc.Vec3();
    var tmpVecE = new pc.Vec3();
    var tmpVecF = new pc.Vec3();

    /**
     * @name pc.BoundingBox
     * @description Create a new axis-aligned bounding box
     * @class Axis-Aligned Bounding Box
     * @param {pc.Vec3} center - center of box
     * @param {pc.Vec3} halfExtents - half the distance across the box in each axis
     */
    var BoundingBox = function BoundingBox(center, halfExtents) {
        this.center = center || new pc.Vec3(0, 0, 0);
        this.halfExtents = halfExtents || new pc.Vec3(0.5, 0.5, 0.5);
        this._min = new pc.Vec3();
        this._max = new pc.Vec3();
    };

    BoundingBox.prototype = {

        /**
         * @function
         * @name pc.BoundingBox#add
         * @description Combines two bounding boxes into one, enclosing both
         * @param {pc.BoundingBox} other Bounding box to add
         */
        add: function (other) {
            var tc = this.center.data;
            var tcx = tc[0];
            var tcy = tc[1];
            var tcz = tc[2];
            var th = this.halfExtents.data;
            var thx = th[0];
            var thy = th[1];
            var thz = th[2];
            var tminx = tcx - thx;
            var tmaxx = tcx + thx;
            var tminy = tcy - thy;
            var tmaxy = tcy + thy;
            var tminz = tcz - thz;
            var tmaxz = tcz + thz;

            var oc = other.center.data;
            var ocx = oc[0];
            var ocy = oc[1];
            var ocz = oc[2];
            var oh = other.halfExtents.data;
            var ohx = oh[0];
            var ohy = oh[1];
            var ohz = oh[2];
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

            tc[0] = (tminx + tmaxx) * 0.5;
            tc[1] = (tminy + tmaxy) * 0.5;
            tc[2] = (tminz + tmaxz) * 0.5;
            th[0] = (tmaxx - tminx) * 0.5;
            th[1] = (tmaxy - tminy) * 0.5;
            th[2] = (tmaxz - tminz) * 0.5;
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
         * @param {pc.BoundingBox} other Bounding box to test against
         * @returns {Boolean} True if there is an intersection
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

        intersectsRay: function (ray) {
            var diff = tmpVecA;
            var cross = tmpVecB;
            var prod = tmpVecC;
            var absDiff = tmpVecD;
            var absDir = tmpVecE;
            var rayDir = tmpVecF.copy(ray.direction).normalize();
            var i;

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

            if (cross.x > this.halfExtents.y*absDir.z + this.halfExtents.z*absDir.y)
                return false;

            if (cross.y > this.halfExtents.x*absDir.z + this.halfExtents.z*absDir.x)
                return false;

            if (cross.z > this.halfExtents.x*absDir.y + this.halfExtents.y*absDir.x)
                return false;

            return true;
        },

        setMinMax: function (min, max) {
            this.center.add2(max, min).scale(0.5);
            this.halfExtents.sub2(max, min).scale(0.5);
        },

        /**
         * @function
         * @name pc.BoundingBox#getMin
         * @description Return the minimum corner of the AABB.
         * @returns {pc.Vec3} minimum corner
         */
        getMin: function () {
            return this._min.copy(this.center).sub(this.halfExtents);
        },

        /**
         * @function
         * @name pc.BoundingBox#getMax
         * @description Return the maximum corner of the AABB.
         * @returns {pc.Vec3} maximum corner
         */
        getMax: function () {
            return this._max.copy(this.center).add(this.halfExtents);
        },

        /**
         * @function
         * @name pc.BoundingBox#containsPoint
         * @description Test if a point is inside a AABB
         * @param {pc.Vec3} point Point to test
         * @returns {Boolean} true if the point is inside the AABB and false otherwise
         */
        containsPoint: function (point) {
            var min = this.getMin();
            var max = this.getMax();
            var i;

            for (i = 0; i < 3; ++i) {
                if (point.data[i] < min.data[i] || point.data[i] > max.data[i])
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
            var ac = aabb.center.data;
            var ar = aabb.halfExtents.data;

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
                m[12] + mx0 * ac[0] + mx1 * ac[1] + mx2 * ac[2],
                m[13] + my0 * ac[0] + my1 * ac[1] + my2 * ac[2],
                m[14] + mz0 * ac[0] + mz1 * ac[1] + mz2 * ac[2]
            );

            br.set(
                mx0a * ar[0] + mx1a * ar[1] + mx2a * ar[2],
                my0a * ar[0] + my1a * ar[1] + my2a * ar[2],
                mz0a * ar[0] + mz1a * ar[1] + mz2a * ar[2]
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
        }
    };

    return {
        BoundingBox: BoundingBox
    };
}());
