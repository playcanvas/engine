pc.extend(pc, function () {
    var transformedRay = new pc.Ray();
    var transformedPoint = new pc.Vec3();
    var transformedBoundingSphere = new pc.BoundingSphere();

    /**
     * @name pc.OrientatedBox
     * @description Create a new orientated box.
     * @class Orientated Box.
     * @param {pc.Mat4} [worldTransform] Transform that has the orientation and position of the box. Scale is assumed to be one.
     * @param {pc.Vec3} [halfExtents] Half the distance across the box in each local axis. The constructor takes a reference of this parameter.
     */
    var OrientatedBox = function OrientatedBox(worldTransform, halfExtents) {
        this.halfExtents = halfExtents || new pc.Vec3(0.5, 0.5, 0.5);

        this._worldTransform = worldTransform || new pc.Mat4();
        this._modelTransform = this._worldTransform.clone().invert();
        this._aabb = new pc.BoundingBox(new pc.Vec3(), this.halfExtents);
    };

    OrientatedBox.prototype = {
        /**
         * @function
         * @name pc.OrientatedBox#intersectsRay
         * @description Test if a ray intersects with the OBB.
         * @param {pc.Ray} ray Ray to test against (direction must be normalized).
         * @param {pc.Vec3} [point] If there is an intersection, the intersection point will be copied into here.
         * @returns {Boolean} True if there is an intersection.
         */
        intersectsRay: function (ray, point) {
            this._modelTransform.transformPoint(ray.origin, transformedRay.origin);
            this._modelTransform.transformVector(ray.direction, transformedRay.direction);

            if (point) {
                var result = this._aabb._intersectsRay(transformedRay, point);
                this._worldTransform.transformPoint(point, point);
                return result;
            } else {
                return this._aabb._fastIntersectsRay(transformedRay);
            }
        },

        /**
         * @function
         * @name pc.OrientatedBox#containsPoint
         * @description Test if a point is inside a OBB.
         * @param {pc.Vec3} point Point to test.
         * @returns {Boolean} true if the point is inside the OBB and false otherwise.
         */
        containsPoint: function (point) {
            this._modelTransform.transformPoint(point, transformedPoint);
            return this._aabb.containsPoint(transformedPoint);
        },

        /**
         * @function
         * @name pc.OrientatedBox#intersectsBoundingSphere
         * @description Test if a Bounding Sphere is inside a OBB.
         * @param {pc.BoundingSphere} sphere Bounding Sphere to test.
         * @returns {Boolean} true if the Bounding Sphere is inside the OBB and false otherwise.
         */
        intersectsBoundingSphere: function (sphere) {
            this._modelTransform.transformPoint(sphere.center, transformedBoundingSphere.center);
            transformedBoundingSphere.radius = sphere.radius;

            if (this._aabb.intersectsBoundingSphere(transformedBoundingSphere)) {
                return true;
            }

            return false;
        }
    };

    /**
     * @field
     * @type Number
     * @name pc.OrientatedBox#worldTransform
     * @description The world transform of the OBB.
    */
    Object.defineProperty(OrientatedBox.prototype, 'worldTransform', {
        get: function () {
            return this._worldTransform;
        },
        set: function (value) {
            this._worldTransform = value;
            this._modelTransform.copy(this._worldTransform).invert();
        }
    });

    return {
        OrientatedBox: OrientatedBox
    };
}());
