pc.extend(pc, function() {
    /**
     * @name pc.Ray
     * @class An infinite ray
     * @description Creates a new infinite ray starting at a given origin and pointing in a given direction.
     * @example
     * // Create a new ray starting at the position of this entity and pointing down
     * // the entity's negative Z axis
     * var ray = new pc.Ray(this.entity.getPosition(), this.entity.forward);
     * @param {pc.Vec3} [origin] The starting point of the ray. The constructor takes a reference of this parameter.
     * Defaults to the origin (0, 0, 0).
     * @param {pc.Vec3} [direction] The direction of the ray. The constructor takes a reference of this parameter.
     * Defaults to a direction down the world negative Z axis (0, 0, -1).
     */
    var Ray = function Ray(origin, direction) {
        this.origin = origin || new pc.Vec3(0, 0, 0);
        this.direction = direction || new pc.Vec3(0, 0, -1);
    };

    Ray.prototype.intersectTriangle = (function() {
        var diff = new pc.Vec3();
        var edge1 = new pc.Vec3();
        var edge2 = new pc.Vec3();
        var normal = new pc.Vec3();

        return function intersectTriangle(a, b, c, backfaceCulling, res) {
            res = (res === undefined) ? new pc.Vec3() : res;
            edge1.sub2(b, a);
            edge2.sub2(c, a);
            normal.cross(edge1, edge2);

            var DdN = this.direction.dot(normal);
            var sign;

            if (DdN > 0) {
                if (backfaceCulling) return null;
                sign = 1;
            } else if (DdN < 0) {
                sign = -1;
                DdN = -DdN;
            } else {
                return null;
            }

            diff.sub2(this.origin, a);

            var DdQxE2 = sign * this.direction.dot(edge2.cross(diff, edge2));

            if (DdQxE2 < 0) return null;

            var DdE1xQ = sign * this.direction.dot(edge1.cross(edge1, diff));

            if (DdE1xQ < 0) return null;
            if (DdQxE2 + DdE1xQ > DdN) return null;

            var QdN = -sign * diff.dot(normal);

            if (QdN < 0) return null;

            return res.copy(this.direction).scale(QdN / DdN).add(this.origin);
        };
    })();

    return {
        Ray: Ray
    };
}());
