pc.extend(pc, function () {
    /**
     * @name pc.BoundingSphere
     * @class A bounding sphere is a volume for facilitating fast intersection testing.
     * @description Creates a new bounding sphere.
     * @example
     * // Create a new bounding sphere centered on the origin with a radius of 0.5
     * var sphere = new pc.BoundingSphere();
     * @param {pc.Vec3} [center] The world space coordinate marking the center of the sphere.
     * @param {Number} [radius] The radius of the bounding sphere. Defaults to 0.5.
     */
    function BoundingSphere(center, radius) {
        this.center = (center === undefined) ? new pc.Vec3(0, 0, 0) : center;
        this.radius = (radius === undefined) ? 0.5 : radius;

        // Backwards compatibility
        this.type = "Sphere";
    };

    BoundingSphere.prototype = {
        containsPoint: (function () {
            var centerToPoint = new pc.Vec3();
            return function (point) {
                var lenSq = centerToPoint.sub2(point, this.center).lengthSq();
                var r = this.radius;
                return lenSq < r * r;
            }
        }()),

        compute: function (vertices) {
            var i;
            var numVerts = vertices.length / 3;

            var vertex = new pc.Vec3(0, 0, 0);

            // FIRST PASS:
            // Find the "average vertex", which is the sphere's center...
            var avgVertex = new pc.Vec3(0, 0, 0);
            var sum = new pc.Vec3(0, 0, 0);

            for (i = 0; i < numVerts; i++) {
                vertex.set(vertices[i*3], vertices[i*3+1], vertices[i*3+2]);
                sum.addSelf(vertex);

                // apply a part-result to avoid float-overflows
                if (i % 100 === 0) {
                    sum.scale(1 / numVerts);
                    avgVertex.add(sum);
                    sum.set(0, 0, 0);
                }
            }

            sum.scale(1 / numVerts);
            avgVertex.add(sum);

            this.center.copy(avgVertex);

            // SECOND PASS:
            // Find the maximum (squared) distance of all vertices to the center...
            var maxDistSq = 0;
            var centerToVert = new pc.Vec3(0, 0, 0);

            for (i = 0; i < numVerts; i++) {
                vertex.set(vertices[i*3], vertices[i*3+1], vertices[i*3+2]);

                centerToVert.sub2(vertex, this.center);
                maxDistSq = Math.max(centerToVert.lengthSq(), maxDistSq);
            }

            this.radius = Math.sqrt(maxDistSq);
        },

        intersectRay: function (start, direction) {
            var m = start.clone().sub(this.center);
            var b = m.dot(direction);
            var c = m.dot(m) - this.radius * this.radius;

            // exit if ray's origin outside of sphere (c > 0) and ray pointing away from s (b > 0)
            if (c > 0 && b > 0) {
                return null;
            }

            var discr = b * b - c;
            // a negative discriminant corresponds to ray missing sphere
            if (discr < 0) {
                return null;
            }

            // ray intersects sphere, compute smallest t value of intersection
            t = Math.abs(-b - Math.sqrt(discr));

            // if t is negative, ray started inside sphere so clamp t to zero
            return direction.clone().scale(t).add(start);
        }
    };

    return {
        BoundingSphere: BoundingSphere
    };
}());
