/**
 * @constant
 * @type {number}
 * @name pc.CURVE_LINEAR
 * @description A linear interpolation scheme.
 */
export const CURVE_LINEAR = 0;
/**
 * @constant
 * @type {number}
 * @name pc.CURVE_SMOOTHSTEP
 * @description A smooth step interpolation scheme.
 */
export const CURVE_SMOOTHSTEP = 1;
/**
 * @deprecated
 * @constant
 * @type {number}
 * @name pc.CURVE_CATMULL
 * @description A Catmull-Rom spline interpolation scheme. This interpolation scheme is deprecated. Use CURVE_SPLINE instead.
 */
export const CURVE_CATMULL = 2;
/**
 * @deprecated
 * @constant
 * @type {number}
 * @name pc.CURVE_CARDINAL
 * @description A cardinal spline interpolation scheme. This interpolation scheme is deprecated. Use CURVE_SPLINE instead.
 */
export const CURVE_CARDINAL = 3;
/**
 * @constant
 * @type {number}
 * @name pc.CURVE_SPLINE
 * @description Cardinal spline interpolation scheme. For Catmull-Rom, specify curve tension 0.5.
 */
export const CURVE_SPLINE = 4;
/**
 * @constant
 * @type {number}
 * @name pc.CURVE_STEP
 * @description A stepped interpolator, free from the shackles of blending.
 */
export const CURVE_STEP = 5;
