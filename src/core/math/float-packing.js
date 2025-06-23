/**
 * @import { Color } from './color.js'
 */

const floatView = new Float32Array(1);
const int32View = new Int32Array(floatView.buffer);

/**
 * Utility static class providing functionality to pack float values to various storage
 * representations.
 *
 * @category Math
 */
class FloatPacking {
    /**
     * Packs a float to a 16-bit half-float representation used by the GPU.
     *
     * @param {number} value - The float value to pack.
     * @returns {number} The packed value.
     */
    static float2Half(value) {
        // based on https://esdiscuss.org/topic/float16array
        // This method is faster than the OpenEXR implementation (very often
        // used, eg. in Ogre), with the additional benefit of rounding, inspired
        // by James Tursa?s half-precision code.
        floatView[0] = value;
        const x = int32View[0];

        let bits = (x >> 16) & 0x8000; // Get the sign
        let m = (x >> 12) & 0x07ff; // Keep one extra bit for rounding
        const e = (x >> 23) & 0xff; // Using int is faster here

        // If zero, or denormal, or exponent underflows too much for a denormal half, return signed zero.
        if (e < 103) {
            return bits;
        }

        // If NaN, return NaN. If Inf or exponent overflow, return Inf.
        if (e > 142) {
            bits |= 0x7c00;

            // If exponent was 0xff and one mantissa bit was set, it means NaN,
            // not Inf, so make sure we set one mantissa bit too.
            bits |= ((e === 255) ? 0 : 1) && (x & 0x007fffff);
            return bits;
        }

        // If exponent underflows but not too much, return a denormal
        if (e < 113) {
            m |= 0x0800;

            // Extra rounding may overflow and set mantissa to 0 and exponent to 1, which is OK.
            bits |= (m >> (114 - e)) + ((m >> (113 - e)) & 1);
            return bits;
        }

        bits |= ((e - 112) << 10) | (m >> 1);

        // Extra rounding. An overflow will set mantissa to 0 and increment the exponent, which is OK.
        bits += m & 1;
        return bits;
    }

    /**
     * Converts bits of a 32-bit float into RGBA8 format and stores the result in a provided color.
     * The float can be reconstructed in shader using the uintBitsToFloat instruction.
     *
     * @param {number} value - The float value to convert.
     * @param {Color} data - The color to store the RGBA8 packed value in.
     *
     * @ignore
     */
    static float2RGBA8(value, data) {
        floatView[0] = value;
        const intBits = int32View[0];
        data.r = ((intBits >> 24) & 0xFF) / 255.0;
        data.g = ((intBits >> 16) & 0xFF) / 255.0;
        data.b = ((intBits >> 8) & 0xFF) / 255.0;
        data.a = (intBits & 0xFF) / 255.0;
    }
}

export { FloatPacking };
