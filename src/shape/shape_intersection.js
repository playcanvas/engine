/**
 * @name pc.shape.intersection
 * @namespace Contains functions for determining intersections between geometrical primitives
 */
pc.shape.intersection = function () {
    return {
        
        /**
         * @name pc.shape.intersection.aabbAabb
         * @function
         * @description Test whether two Axis-aligned bounding boxes intersect.
         * @param a {pc.shape.Aabb} First bounding box
         * @param b {pc.shape.Aabb} Second bounding box
         * @returns {Boolean} True if there is an intersection
         */
        aabbAabb: function (a,b) {
            var aMax = a.getMax();
            var aMin = a.getMin();
            var bMax = b.getMax();
            var bMin = b.getMin();
            
            return (aMin[0] <= bMax[0]) && (aMax[0] >= bMin[0]) &&
            (aMin[1] <= bMax[1]) && (aMax[1] >= bMin[1]) &&
            (aMin[2] <= bMax[2]) && (aMax[2] >= bMin[2]);
        },
        
        /**
         * Intersection test between a ray and an AABB
         * @param {Vec3} rayOrigin The origin of the ray
         * @param {Vec3} rayDir The length vector of the ray
         * @param {Aabb} aabb The AABB to test against
         * @return {Boolean} True if intersection occurs
         */
        rayAabb: function (rayOrigin, rayDir, aabb) {
            var diff = pc.math.vec3.create(),
            absDiff,
            absDir,
            cross = pc.math.vec3.create(),
            prod  = pc.math.vec3.create(),
            i;
                
            pc.math.vec3.subtract(rayOrigin, aabb.center, diff);
            absDiff = pc.math.vec3.create(Math.abs(diff[0]), Math.abs(diff[1]), Math.abs(diff[2]));
            
            pc.math.vec3.multiply(diff, rayDir, prod);
            
            for (i = 0; i < 3; ++i) {
                if (absDiff[i] > aabb.halfExtents[i] && prod[i] >= 0) {
                    return false;
                }
            }
            
            absDir = pc.math.vec3.create(Math.abs(rayDir[0]), Math.abs(rayDir[1]), Math.abs(rayDir[2]));
            pc.math.vec3.cross(rayDir, diff, cross);
            cross[0] = Math.abs(cross[0]);
            cross[1] = Math.abs(cross[1]);
            cross[2] = Math.abs(cross[2]);
            
            if (cross[0] > aabb.halfExtents[1]*absDir[2] + aabb.halfExtents[2]*absDir[1]) {
                return false;
            }
            if (cross[1] > aabb.halfExtents[0]*absDir[2] + aabb.halfExtents[2]*absDir[0]) {
                return false;
            }
            if (cross[2] > aabb.halfExtents[0]*absDir[1] + aabb.halfExtents[1]*absDir[0]) {
                return false;
            }
        
            return true;
        },
        
        /**
         * Intersection test between a ray and a Sphere
         * @param {Vec3} rayOrigin The origin point of the ray
         * @param {Vec3} rayDir The length vector of the ray
         * @param {Sphere} sphere The Sphere to test against
         * @param {Object} result The results object. result.success is true if an intersection occured, results.t is the fraction along the ray the intersection occured at (0-1)
         * @return {Boolean} True if intersection occurs
         */
        raySphere: function (rayOrigin, rayDir, sphere, result) {
            var diff = pc.math.vec3.create();
            var a = 0;
            var b = 0;
            var c = 0;
            var discr = 0;
            result = result || {};
            
            pc.math.vec3.subtract(rayOrigin, sphere.center, diff);
            if (pc.math.vec3.dot(diff, diff) < sphere.radius * sphere.radius ) {
                // starts inside sphere
                result.success = true;
                result.t = 0;
                return true;
            }
        
            a = pc.math.vec3.dot(rayDir, rayDir);
            b = 2 * pc.math.vec3.dot(rayDir, diff);
            c = pc.math.vec3.dot(sphere.center, sphere.center);
            c += pc.math.vec3.dot(rayOrigin, rayOrigin);
            c -= 2 * pc.math.vec3.dot(sphere.center, rayOrigin);
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
         * @param {Vec3} rayOrigin The origin point of the ray
         * @param {Vec3} rayDir The direction vector of the ray
         * @param {Object} t The triangle to test against
         * @param {Vec3} intersection The intersection point
         * @return {Number} 0 if disjoint (no intersection), 1 if intersection found and 2 if ray is in plane of triangle
         */
        rayTriangle: function (rayOrigin, rayDir, t, intersection) {
            var w0 = pc.math.vec3.create();
            pc.math.vec3.sub(rayOrigin, t.v0, w0);
            var a = -pc.math.vec3.dot(t.n, w0);
            var b = pc.math.vec3.dot(t.n, rayDir);
            if (Math.fabs(b) < 0.00000001) {     // ray is parallel to triangle plane
                if (a === 0)                // ray lies in triangle plane
                    return 2;
                else return 0;             // ray disjoint from plane
            }
        
            // get intersect point of ray with triangle plane
            var r = a / b;
            if (r < 0.0)                   // ray goes away from triangle
                return 0;                  // => no intersect
            // for a segment, also test if (r > 1.0) => no intersect
        
            var fromOrigin = pc.math.vec3.create();
            pc.math.vec3.scale(rayDir, r, fromOrigin);
            pc.math.vec3.add(rayOrigin, fromOrigin, intersection);
        
            // is I inside T?
            var w = pc.math.vec3.create();
            pc.math.vec3.sub(intersection, t.v0, w);
            var wu = pc.math.vec3.dot(w, t.u);
            var wv = pc.math.vec3.dot(w, t.v);
        
            // get and test parametric coords
            var s = (t.uv * wv - t.vv * wu) / t.d;
            if (s < 0.0 || s > 1.0)        // I is outside T
                return 0;
            var t = (t.uv * wu - t.uu * wv) / t.d;
            if (t < 0.0 || (s + t) > 1.0)  // I is outside T
                return 0;
        
            return 1;                      // I is in T
        }
    };
}();

