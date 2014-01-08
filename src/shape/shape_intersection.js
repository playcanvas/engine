/**
 * @name pc.shape.intersection
 * @namespace Contains functions for determining intersections between geometrical primitives
 */
pc.shape.intersection = function () {
    return {
        
        /**
         * @private
         * @function
         * @name pc.shape.intersection.aabbAabb
         * @description Test whether two Axis-aligned bounding boxes intersect.
         * @param {pc.shape.Aabb} a First bounding box
         * @param {pc.shape.Aabb} b Second bounding box
         * @returns {Boolean} True if there is an intersection
         */
        aabbAabb: function (a, b) {
            var aMax = a.getMax();
            var aMin = a.getMin();
            var bMax = b.getMax();
            var bMin = b.getMin();
            
            return (aMin[0] <= bMax[0]) && (aMax[0] >= bMin[0]) &&
            (aMin[1] <= bMax[1]) && (aMax[1] >= bMin[1]) &&
            (aMin[2] <= bMax[2]) && (aMax[2] >= bMin[2]);
        },
        
        /**
         * @function
         * @name pc.shape.intersection.rayAabb
         * @description Intersection test between a ray and an AABB
         * @param {pc.Vec3} rayOrigin The origin of the ray
         * @param {pc.Vec3} rayDir The length vector of the ray
         * @param {pc.shape.Aabb} aabb The AABB to test against
         * @returns {Boolean} True if intersection occurs
         */
        rayAabb: function (rayOrigin, rayDir, aabb) {
            var diff = new pc.Vec3(),
                absDiff,
                absDir,
                cross = new pc.Vec3(),
                prod  = new pc.Vec3(),
                i;

            diff.sub2(rayOrigin, aabb.center);
            absDiff = new pc.Vec3(Math.abs(diff.x), Math.abs(diff.y), Math.abs(diff.z));
            
            prod.mul2(diff, rayDir);
            
            if (absDiff.x > aabb.halfExtents.x && prod.x >= 0) {
                return false;
            }
            if (absDiff.y > aabb.halfExtents.y && prod.y >= 0) {
                return false;
            }
            if (absDiff.z > aabb.halfExtents.z && prod.z >= 0) {
                return false;
            }
            
            absDir = new pc.Vec3(Math.abs(rayDir.x), Math.abs(rayDir.y), Math.abs(rayDir.z));
            cross.cross(rayDir, diff);
            cross.set(Math.abs(cross.x), Math.abs(cross.y), Math.abs(cross.z));
            
            if (cross.x > aabb.halfExtents.y*absDir.z + aabb.halfExtents.z*absDir.y) {
                return false;
            }
            if (cross.y > aabb.halfExtents.x*absDir.z + aabb.halfExtents.z*absDir.x) {
                return false;
            }
            if (cross.z > aabb.halfExtents.x*absDir.y + aabb.halfExtents.y*absDir.x) {
                return false;
            }
        
            return true;
        },
        
        /**
         * @function
         * @name pc.shape.intersection.raySphere
         * @description Intersection test between a ray and a Sphere
         * @param {pc.Vec3} rayOrigin The origin point of the ray
         * @param {pc.Vec3} rayDir The length vector of the ray
         * @param {pc.shape.Sphere} sphere The Sphere to test against
         * @param {Object} result The results object. result.success is true if an intersection occured, results.t is the fraction along the ray the intersection occured at (0-1)
         * @returns {Boolean} True if intersection occurs
         */
        raySphere: function (rayOrigin, rayDir, sphere, result) {
            var diff = new pc.Vec3();
            var a = 0;
            var b = 0;
            var c = 0;
            var discr = 0;
            result = result || {};

            diff.sub2(rayOrigin, sphere.center);
            if (diff.dot(diff) < sphere.radius * sphere.radius ) {
                // starts inside sphere
                result.success = true;
                result.t = 0;
                return true;
            }

            a = rayDir.dot(rayDir);
            b = 2 * rayDir.dot(diff);
            c = sphere.center.dot(sphere.center);
            c += rayOrigin.dot(rayOrigin);
            c -= 2 * sphere.center.dot(rayOrigin);
            c -= sphere.radius * sphere.radius;

            discr = (b * b) - (4 * a * c);
            if (discr < 0) {
                result.success = false;
                result.t = 0;
                return false;
            }

            result.success = true;
            result.t = (-b - Math.sqrt(discr)) / (2 * a);

            return true;
        },

        /**
         * Intersection test between a ray and a triangle
         * @param {pc.Vec3} rayOrigin The origin point of the ray
         * @param {pc.Vec3} rayDir The direction vector of the ray
         * @param {Object} t The triangle to test against
         * @param {Vec3} intersection The intersection point
         * @returns {Number} 0 if disjoint (no intersection), 1 if intersection found and 2 if ray is in plane of triangle
         */
        rayTriangle: function (rayOrigin, rayDir, t, intersection) {
            var w0 = rayOrigin.clone().sub(t.v0);
            var a = -t.n.dot(w0);
            var b = t.n.dot(rayDir);
            if (Math.fabs(b) < 0.00000001) {     // ray is parallel to triangle plane
                if (a === 0)               // ray lies in triangle plane
                    return 2;
                else return 0;             // ray disjoint from plane
            }

            // get intersect point of ray with triangle plane
            var r = a / b;
            if (r < 0)                     // ray goes away from triangle
                return 0;                  // => no intersect
            // for a segment, also test if (r > 1.0) => no intersect

            var fromOrigin = rayDir.clone().scale(r);
            intersection.add2(rayOrigin, fromOrigin);

            // is I inside T?
            var w = new pc.Vec3().sub2(intersection, t.v0);
            var wu = w.dot(t.u);
            var wv = w.dot(t.v);

            // get and test parametric coords
            var s = (t.uv * wv - t.vv * wu) / t.d;
            if (s < 0 || s > 1)        // I is outside T
                return 0;
            var t = (t.uv * wu - t.uu * wv) / t.d;
            if (t < 0 || (s + t) > 1)  // I is outside T
                return 0;

            return 1;                  // I is in T
        }
    };
}();