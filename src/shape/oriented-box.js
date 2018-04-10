pc.extend(pc, function () {
    var tmpRay = new pc.Ray();
    var tmpVec3 = new pc.Vec3();
    var tmpSphere = new pc.BoundingSphere();
    var tmpMat4 = new pc.Mat4();

    /**
     * @constructor
     * @name pc.OrientedBox
     * @description Create a new oriented box.
     * @classdesc Oriented Box.
     * @property {pc.Mat4} [worldTransform] Transform that has the orientation and position of the box. Scale is assumed to be one.
     * @property {pc.Vec3} [halfExtents] Half the distance across the box in each local axis.
     * @param {pc.Mat4} [worldTransform] Transform that has the orientation and position of the box. Scale is assumed to be one.
     * @param {pc.Vec3} [halfExtents] Half the distance across the box in each local axis. The constructor takes a reference of this parameter.
     */
    var OrientedBox = function OrientedBox(worldTransform, halfExtents) {
        this._aabb = new pc.BoundingBox();
        this._modelTransform = new pc.Mat4();
        this.halfExtents = halfExtents || new pc.Vec3(0.5, 0.5, 0.5);
        this.worldTransform = worldTransform || tmpMat4.setIdentity();
    };

    OrientedBox.prototype = {
        /**
         * @function
         * @name pc.OrientedBox#intersectsRay
         * @description Test if a ray intersects with the OBB.
         * @param {pc.Ray} ray Ray to test against (direction must be normalized).
         * @param {pc.Vec3} [point] If there is an intersection, the intersection point will be copied into here.
         * @returns {Boolean} True if there is an intersection.
         */
        intersectsRay: function (ray, point) {
            this._modelTransform.transformPoint(ray.origin, tmpRay.origin);
            this._modelTransform.transformVector(ray.direction, tmpRay.direction);

            if (point) {
                var result = this._aabb._intersectsRay(tmpRay, point);
                tmpMat4.copy(this._modelTransform).invert().transformPoint(point, point);
                return result;
            } else {
                return this._aabb._fastIntersectsRay(tmpRay);
            }
        },

        /**
         * @function
         * @name pc.OrientedBox#containsPoint
         * @description Test if a point is inside a OBB.
         * @param {pc.Vec3} point Point to test.
         * @returns {Boolean} true if the point is inside the OBB and false otherwise.
         */
        containsPoint: function (point) {
            this._modelTransform.transformPoint(point, tmpVec3);
            return this._aabb.containsPoint(tmpVec3);
        },

        /**
         * @function
         * @name pc.OrientedBox#intersectsBoundingBox
         * @description Test if a Bounding Box is overlapping, enveloping, or inside this OBB.
         * @param {pc.BoundingBox} boundingBox Bounding Box to test.
         * @returns {Boolean} true if the Bounding Box is overlapping, enveloping or inside this OBB and false otherwise.
         */
        intersectsBoundingBox: function (boundingBox) {
            var obb = new pc.OrientedBox();
            obb._aabb.center = boundingBox.center;
            obb.halfExtents = boundingBox.halfExtents;
            return this.intersectsOrientedBox(obb);
        },

        _getCorners: function (obb) {
            var center = obb._aabb.center;
            var halfExtents = obb.halfExtents;
            var x = obb.worldTransform.getX().scale(halfExtents.x);
            var y = obb.worldTransform.getY().scale(halfExtents.y);
            var z = obb.worldTransform.getZ().scale(halfExtents.z);
            var corners = [ ];
            corners.push(center.clone().sub(x).sub(y).sub(z));
            corners.push(center.clone().sub(x).sub(y).add(z));
            corners.push(center.clone().sub(x).add(y).sub(z));
            corners.push(center.clone().sub(x).add(y).add(z));
            corners.push(center.clone().add(x).sub(y).sub(z));
            corners.push(center.clone().add(x).sub(y).add(z));
            corners.push(center.clone().add(x).add(y).sub(z));
            corners.push(center.clone().add(x).add(y).add(z));
            return corners;
        },

        _getInterval: function (corners, axis) {
            var i;
            var interval = [ ];
            var projection = axis.dot(corners[0]);
            interval.push(projection);
            interval.push(projection);
            for (i = 1; i < 8; i++) {
                projection = axis.dot(corners[i]);
                if (projection < interval[0]) {
                    interval[0] = projection;
                }
                else if (projection > interval[1]) {
                    interval[1] = projection;
                }
            }
            return interval;
        },

        /**
         * @function
         * @name pc.OrientedBox#intersectsOrientedBox
         * @description Test if an Oriented Box is overlapping, enveloping, or inside this OBB.
         * @param {pc.OrientedBox} orientedBox Oriented Box to test.
         * @returns {Boolean} true if the Oriented Box is overlapping, enveloping or inside this OBB and false otherwise.
         */
        intersectsOrientedBox: function (orientedBox) {
            var i;
            var aInterval;
            var bInterval;
            var axes = [ ];
            var aCorners = this._getCorners(this);
            var bCorners = this._getCorners(orientedBox);
            axes.push(this.worldTransform.getX());
            axes.push(this.worldTransform.getY());
            axes.push(this.worldTransform.getZ());
            axes.push(orientedBox.worldTransform.getX());
            axes.push(orientedBox.worldTransform.getY());
            axes.push(orientedBox.worldTransform.getZ());
            for (i = 0; i < 3; i++) {
                axes.push((new pc.Vec3).cross(axes[i + 3], axes[0]));
                axes.push((new pc.Vec3).cross(axes[i + 3], axes[1]));
                axes.push((new pc.Vec3).cross(axes[i + 3], axes[2]));
            }
            for (i = 0; i < axes.length; i++) {
                aInterval = this._getInterval(aCorners, axes[i]);
                bInterval = this._getInterval(bCorners, axes[i]);
                if ((bInterval[0] > aInterval[1]) || (aInterval[0] > bInterval[1])) {
                    return false;
                }
            }
            return true;
        },

        /**
         * @function
         * @name pc.OrientedBox#intersectsBoundingSphere
         * @description Test if a Bounding Sphere is overlapping, enveloping, or inside this OBB.
         * @param {pc.BoundingSphere} sphere Bounding Sphere to test.
         * @returns {Boolean} true if the Bounding Sphere is overlapping, enveloping or inside this OBB and false otherwise.
         */
        intersectsBoundingSphere: function (sphere) {
            this._modelTransform.transformPoint(sphere.center, tmpSphere.center);
            tmpSphere.radius = sphere.radius;

            if (this._aabb.intersectsBoundingSphere(tmpSphere)) {
                return true;
            }

            return false;
        }
    };

    Object.defineProperty(OrientedBox.prototype, 'halfExtents', {
        get: function () {
            return this._halfExtents;
        },
        set: function (value) {
            this._halfExtents = value;
            this._aabb.halfExtents = value;
        }
    });

    Object.defineProperty(OrientedBox.prototype, 'worldTransform', {
        get: function () {
            return this._worldTransform;
        },
        set: function (value) {
            this._worldTransform = value;
            this._modelTransform.copy(value).invert();
            this._modelTransform.transformPoint(new pc.Vec3(), this._aabb.center);
        }
    });

    return {
        OrientedBox: OrientedBox
    };
}());
