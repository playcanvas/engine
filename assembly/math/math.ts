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
     * @type number
     * @example
     * // Convert 180 degrees to pi radians
     * var rad = 180 * pc.math.DEG_TO_RAD;
     */
    export const DEG_TO_RAD: number = Math.PI / 180.0;

    /**
     * @name pc.math.RAD_TO_DEG
     * @description Conversion factor between degrees and radians
     * @type number
     * @example
     * // Convert pi radians to 180 degrees
     * var deg = Math.PI * pc.math.RAD_TO_DEG;
     */
    export const RAD_TO_DEG: number = 180.0 / Math.PI;

    /**
     * @function
     * @name pc.math.clamp
     * @description Clamp a number between min and max inclusive.
     * @param {number} value Number to clamp
     * @param {number} min Min value
     * @param {number} max Max value
     * @returns {number} The clamped value
     */
    export function clamp(value: number, min: number, max: number): number {
        if (value >= max)
            return max;
        if (value <= min)
            return min;
        return value;
    }
}
