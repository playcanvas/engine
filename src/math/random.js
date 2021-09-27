import { math } from './math.js';

// golden angle in radians: PI * (3 - sqrt(5))
const _goldenAngle = 2.399963229728653;

/**
 * @name random
 * @namespace
 * @description Random API.
 */
const random = {

    /**
     * @function
     * @private
     * @name random.circlePoint
     * @description Return a pseudo-random 2D point inside a unit circle with uniform distribution.
     * @param {Vec2} point - the returned generated point.
     */
    circlePoint: function (point) {
        const r = Math.sqrt(Math.random());
        const theta = Math.random() * 2 * Math.PI;
        point.x = r * Math.cos(theta);
        point.y = r * Math.sin(theta);
    },

    /**
     * @function
     * @private
     * @name random.circlePointDeterministic
     * @description Generates evenly distributed deterministic points inside a unit circle using Fermat's spiral and Vogel's method.
     * @param {Vec2} point - the returned generated point.
     * @param {number} index - index of the point to generate, in the range from 0 to numPoints - 1.
     * @param {number} numPoints - the total number of points of the set.
     */
    circlePointDeterministic: function (point, index, numPoints) {
        const theta = index * _goldenAngle;
        const r = Math.sqrt(index) / Math.sqrt(numPoints);

        point.x = r * Math.cos(theta);
        point.y = r * Math.sin(theta);
    },

    /**
     * @function
     * @private
     * @name random.spherePointDeterministic
     * @description Generates evenly distributed deterministic points on a unit sphere using Fibonacci sphere algorithm. It also allows
     * the points to cover only part of the sphere by specifying start and end parameters, representing value from 0 (top of the sphere) and
     * 1 (bottom of the sphere). For example by specifying 0.4 and 0.6 and start and end, a band around the equator would be generated.
     * @param {Vec3} point - the returned generated point.
     * @param {number} index - index of the point to generate, in the range from 0 to numPoints - 1.
     * @param {number} numPoints - the total number of points of the set.
     * @param {number} [start] - Part on the sphere along y axis to start the points, in the range of 0 and 1. Defaults to 0.
     * @param {number} [end] - Part on the sphere along y axis to stop the points, in the range of 0 and 1. Defaults to 1.
     */
    spherePointDeterministic: function (point, index, numPoints, start = 0, end = 1) {

        // y coordinate needs to go from -1 (top) to 1 (bottom) for the full sphere
        // evaluate its vaue for this point and specified start and end
        start = 1 - 2 * start;
        end = 1 - 2 * end;
        const y = math.lerp(start, end, index / numPoints);

        // radius at y
        const radius = Math.sqrt(1 - y * y);

        // golden angle increment
        const theta = _goldenAngle * index;

        point.x = Math.cos(theta) * radius;
        point.y = y;
        point.z = Math.sin(theta) * radius;
    }
};

export { random };
