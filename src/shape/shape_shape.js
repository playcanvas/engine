/**
 * @name pc.shape
 * @namespace Shape Primitives API
 * @description Create primitive shapes such as spheres and cubes in 3D and check intersection with points, rays and other shapes
 */
pc.shape = function () {
    /**
     * @name pc.shape.Shape
     * @class Base class for geometrical shapes
     */
    var Shape = function Shape() {};
    Shape.prototype = {
        /**
         * @name pc.shape.Shape#containsPoint
         * @description Check to see if the point is inside the shape
         * @param {pc.math.vec3.Vector3} point The point to test
         * @returns {Boolean} True if the point is inside the shape
         * @function
         */
        containsPoint: function (point) {
            throw new Error("Shape hasn't implemented containsPoint");
        }
    };
    return {
        Shape: Shape,
        /**
         * @enum {String}
         * @name pc.shape.Type
         * @description Type names for different shapes
         */
        Type: {
            CAPSULE: "Capsule", // TODO: this should go in shape_capsule.js
            CONE: "Cone", // TODO: this should go in shape_cone.js
            CYLINDER: "Cylinder", // TODO: this should go in shape_cylinder.js

            // 2D shapes
            CIRCLE: "Circle",
            RECT: "Rect"
        }
    };
}();