pc.extend(pc, function () {
    var tmpVecA = new pc.Vec3();
    var tmpVecB = new pc.Vec3();
    var tmpVecC = new pc.Vec3();
    var tmpVecD = new pc.Vec3();

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
        this.center = center || new pc.Vec3(0, 0, 0);
        this.radius = radius === undefined ? 0.5 : radius;
    }

    BoundingSphere.prototype = {
        containsPoint: function(point) {
            var lenSq = tmpVecA.sub2(point, this.center).lengthSq();
            var r = this.radius;
            return lenSq < r * r;
        },

        compute: function (vertices) {
            var i;
            var numVerts = vertices.length / 3;

            var vertex = tmpVecA;
            var avgVertex = tmpVecB;
            var sum = tmpVecC;

            // FIRST PASS:
            // Find the "average vertex", which is the sphere's center...

            for (i = 0; i < numVerts; i++) {
                vertex.set(vertices[ i * 3 ], vertices[ i * 3 + 1 ], vertices[ i * 3 + 2 ]);
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
            var centerToVert = tmpVecD;

            for (i = 0; i < numVerts; i++) {
                vertex.set(vertices[ i * 3 ], vertices[ i * 3 + 1 ], vertices[ i * 3 + 2 ]);

                centerToVert.sub2(vertex, this.center);
                maxDistSq = Math.max(centerToVert.lengthSq(), maxDistSq);
            }

            this.radius = Math.sqrt(maxDistSq);
        },

        intersectRay: function (ray) {
            var m = tmpVecA.copy(ray.origin).sub(this.center);
            var b = m.dot(tmpVecB.copy(ray.direction).normalize());
            var c = m.dot(m) - this.radius * this.radius;

            // exit if ray's origin outside of sphere (c > 0) and ray pointing away from s (b > 0)
            if (c > 0 && b > 0)
                return null;

            var discr = b * b - c;
            // a negative discriminant corresponds to ray missing sphere
            if (discr < 0)
                return null;

            // ray intersects sphere, compute smallest t value of intersection
            var t = Math.abs(-b - Math.sqrt(discr));

            // if t is negative, ray started inside sphere so clamp t to zero
            return ray.direction.clone().scale(t).add(ray.origin);
        }
    };

    return {
        BoundingSphere: BoundingSphere
    };
}());
