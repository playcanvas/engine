/**
 * A linear interpolation scheme.
 *
 * @type {number}
 * @category Math
 */
export const CURVE_LINEAR = 0;

/**
 * A smooth step interpolation scheme.
 *
 * @type {number}
 * @category Math
 */
export const CURVE_SMOOTHSTEP = 1;

/**
 * Cardinal spline interpolation scheme. For a Catmull-Rom spline, specify a curve tension of 0.5.
 *
 * @type {number}
 * @category Math
 */
export const CURVE_SPLINE = 4;

/**
 * A stepped interpolator that does not perform any blending.
 *
 * @type {number}
 * @category Math
 */
export const CURVE_STEP = 5;
