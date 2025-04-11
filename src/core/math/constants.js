/**
 * A linear interpolation scheme.
 *
 * @category Math
 */
export const CURVE_LINEAR = 0;

/**
 * A smooth step interpolation scheme.
 *
 * @category Math
 */
export const CURVE_SMOOTHSTEP = 1;

/**
 * Cardinal spline interpolation scheme. For a Catmull-Rom spline, specify a curve tension of 0.5.
 *
 * @category Math
 */
export const CURVE_SPLINE = 4;

/**
 * A stepped interpolator that does not perform any blending.
 *
 * @category Math
 */
export const CURVE_STEP = 5;
