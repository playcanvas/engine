/**
 * @name pc.math
 * @namespace
 * @description Math API
 */
//namespace pc.math { // TypeScript, not supported yet
export namespace pc_math {
    /**
     * @name pc.math.DEG_TO_RAD
     * @description Conversion factor between degrees and radians
     * @type f32
     * @example
     * // Convert 180 degrees to pi radians
     * var rad = 180 * pc.math.DEG_TO_RAD;
     */
    export const DEG_TO_RAD: f32 = Mathf.PI / 180.0;

    /**
     * @name pc.math.RAD_TO_DEG
     * @description Conversion factor between degrees and radians
     * @type f32
     * @example
     * // Convert pi radians to 180 degrees
     * var deg = Math.PI * pc.math.RAD_TO_DEG;
     */
    export const RAD_TO_DEG: f32 = 180.0 / Mathf.PI;

    /**
     * @function
     * @name pc.math.clamp
     * @description Clamp a number between min and max inclusive.
     * @param {f32} value Number to clamp
     * @param {f32} min Min value
     * @param {f32} max Max value
     * @returns {f32} The clamped value
     */
    export function clamp(value: f32, min: f32, max: f32): f32 {
        if (value >= max)
			return max;
        if (value <= min)
			return min;
        return value;
    }
}
