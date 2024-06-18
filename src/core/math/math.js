/**
 * Math API.
 *
 * @namespace
 * @category Math
 */
const math = {
    /**
     * Conversion factor between degrees and radians.
     *
     * @type {number}
     */
    DEG_TO_RAD: Math.PI / 180,

    /**
     * Conversion factor between degrees and radians.
     *
     * @type {number}
     */
    RAD_TO_DEG: 180 / Math.PI,

    /**
     * Clamp a number between min and max inclusive.
     *
     * @param {number} value - Number to clamp.
     * @param {number} min - Min value.
     * @param {number} max - Max value.
     * @returns {number} The clamped value.
     */
    clamp(value, min, max) {
        if (value >= max) return max;
        if (value <= min) return min;
        return value;
    },

    /**
     * Convert an 24 bit integer into an array of 3 bytes.
     *
     * @param {number} i - Number holding an integer value.
     * @returns {number[]} An array of 3 bytes.
     * @example
     * // Set bytes to [0x11, 0x22, 0x33]
     * const bytes = pc.math.intToBytes24(0x112233);
     */
    intToBytes24(i) {
        const r = (i >> 16) & 0xff;
        const g = (i >> 8) & 0xff;
        const b = (i) & 0xff;

        return [r, g, b];
    },

    /**
     * Convert an 32 bit integer into an array of 4 bytes.
     *
     * @param {number} i - Number holding an integer value.
     * @returns {number[]} An array of 4 bytes.
     * @example
     * // Set bytes to [0x11, 0x22, 0x33, 0x44]
     * const bytes = pc.math.intToBytes32(0x11223344);
     */
    intToBytes32(i) {
        const r = (i >> 24) & 0xff;
        const g = (i >> 16) & 0xff;
        const b = (i >> 8) & 0xff;
        const a = (i) & 0xff;

        return [r, g, b, a];
    },

    /**
     * Convert 3 8 bit Numbers into a single unsigned 24 bit Number.
     *
     * @param {number} r - A single byte (0-255).
     * @param {number} g - A single byte (0-255).
     * @param {number} b - A single byte (0-255).
     * @returns {number} A single unsigned 24 bit Number.
     * @example
     * // Set result1 to 0x112233 from an array of 3 values
     * const result1 = pc.math.bytesToInt24([0x11, 0x22, 0x33]);
     *
     * // Set result2 to 0x112233 from 3 discrete values
     * const result2 = pc.math.bytesToInt24(0x11, 0x22, 0x33);
     */
    bytesToInt24(r, g, b) {
        if (r.length) {
            b = r[2];
            g = r[1];
            r = r[0];
        }
        return ((r << 16) | (g << 8) | b);
    },

    /**
     * Convert 4 1-byte Numbers into a single unsigned 32bit Number.
     *
     * @param {number} r - A single byte (0-255).
     * @param {number} g - A single byte (0-255).
     * @param {number} b - A single byte (0-255).
     * @param {number} a - A single byte (0-255).
     * @returns {number} A single unsigned 32bit Number.
     * @example
     * // Set result1 to 0x11223344 from an array of 4 values
     * const result1 = pc.math.bytesToInt32([0x11, 0x22, 0x33, 0x44]);
     *
     * // Set result2 to 0x11223344 from 4 discrete values
     * const result2 = pc.math.bytesToInt32(0x11, 0x22, 0x33, 0x44);
     */
    bytesToInt32(r, g, b, a) {
        if (r.length) {
            a = r[3];
            b = r[2];
            g = r[1];
            r = r[0];
        }

        // Why ((r << 24)>>>0)?
        // << operator uses signed 32 bit numbers, so 128<<24 is negative.
        // >>> used unsigned so >>>0 converts back to an unsigned.
        // See https://stackoverflow.com/questions/1908492/unsigned-integer-in-javascript
        return ((r << 24) | (g << 16) | (b << 8) | a) >>> 0;
    },

    /**
     * Calculates the linear interpolation of two numbers.
     *
     * @param {number} a - Number to linearly interpolate from.
     * @param {number} b - Number to linearly interpolate to.
     * @param {number} alpha - The value controlling the result of interpolation. When alpha is 0,
     * a is returned. When alpha is 1, b is returned. Between 0 and 1, a linear interpolation
     * between a and b is returned. alpha is clamped between 0 and 1.
     * @returns {number} The linear interpolation of two numbers.
     */
    lerp(a, b, alpha) {
        return a + (b - a) * math.clamp(alpha, 0, 1);
    },

    /**
     * Calculates the linear interpolation of two angles ensuring that interpolation is correctly
     * performed across the 360 to 0 degree boundary. Angles are supplied in degrees.
     *
     * @param {number} a - Angle (in degrees) to linearly interpolate from.
     * @param {number} b - Angle (in degrees) to linearly interpolate to.
     * @param {number} alpha - The value controlling the result of interpolation. When alpha is 0,
     * a is returned. When alpha is 1, b is returned. Between 0 and 1, a linear interpolation
     * between a and b is returned. alpha is clamped between 0 and 1.
     * @returns {number} The linear interpolation of two angles.
     */
    lerpAngle(a, b, alpha) {
        if (b - a > 180) {
            b -= 360;
        }
        if (b - a < -180) {
            b += 360;
        }
        return math.lerp(a, b, math.clamp(alpha, 0, 1));
    },

    /**
     * Returns true if argument is a power-of-two and false otherwise.
     *
     * @param {number} x - Number to check for power-of-two property.
     * @returns {boolean} true if power-of-two and false otherwise.
     */
    powerOfTwo(x) {
        return ((x !== 0) && !(x & (x - 1)));
    },

    /**
     * Returns the next power of 2 for the specified value.
     *
     * @param {number} val - The value for which to calculate the next power of 2.
     * @returns {number} The next power of 2.
     */
    nextPowerOfTwo(val) {
        val--;
        val |= (val >> 1);
        val |= (val >> 2);
        val |= (val >> 4);
        val |= (val >> 8);
        val |= (val >> 16);
        val++;
        return val;
    },

    /**
     * Returns the nearest (smaller or larger) power of 2 for the specified value.
     *
     * @param {number} val - The value for which to calculate the nearest power of 2.
     * @returns {number} The nearest power of 2.
     */
    nearestPowerOfTwo(val) {
        return Math.pow(2, Math.round(Math.log(val) / Math.log(2)));
    },

    /**
     * Return a pseudo-random number between min and max. The number generated is in the range
     * [min, max), that is inclusive of the minimum but exclusive of the maximum.
     *
     * @param {number} min - Lower bound for range.
     * @param {number} max - Upper bound for range.
     * @returns {number} Pseudo-random number between the supplied range.
     */
    random(min, max) {
        const diff = max - min;
        return Math.random() * diff + min;
    },

    /**
     * The function interpolates smoothly between two input values based on a third one that should
     * be between the first two. The returned value is clamped between 0 and 1.
     *
     * The slope (i.e. derivative) of the smoothstep function starts at 0 and ends at 0. This makes
     * it easy to create a sequence of transitions using smoothstep to interpolate each segment
     * rather than using a more sophisticated or expensive interpolation technique.
     *
     * See https://en.wikipedia.org/wiki/Smoothstep for more details.
     *
     * @param {number} min - The lower bound of the interpolation range.
     * @param {number} max - The upper bound of the interpolation range.
     * @param {number} x - The value to interpolate.
     * @returns {number} The smoothly interpolated value clamped between zero and one.
     */
    smoothstep(min, max, x) {
        if (x <= min) return 0;
        if (x >= max) return 1;

        x = (x - min) / (max - min);

        return x * x * (3 - 2 * x);
    },

    /**
     * An improved version of the {@link math.smoothstep} function which has zero 1st and 2nd order
     * derivatives at t=0 and t=1.
     *
     * See https://en.wikipedia.org/wiki/Smoothstep#Variations for more details.
     *
     * @param {number} min - The lower bound of the interpolation range.
     * @param {number} max - The upper bound of the interpolation range.
     * @param {number} x - The value to interpolate.
     * @returns {number} The smoothly interpolated value clamped between zero and one.
     */
    smootherstep(min, max, x) {
        if (x <= min) return 0;
        if (x >= max) return 1;

        x = (x - min) / (max - min);

        return x * x * x * (x * (x * 6 - 15) + 10);
    },

    /**
     * Rounds a number up to nearest multiple.
     *
     * @param {number} numToRound - The number to round up.
     * @param {number} multiple - The multiple to round up to.
     * @returns {number} A number rounded up to nearest multiple.
     */
    roundUp(numToRound, multiple) {
        if (multiple === 0)
            return numToRound;
        return Math.ceil(numToRound / multiple) * multiple;
    },

    /**
     * Checks whether a given number resides between two other given numbers.
     *
     * @param {number} num - The number to check the position of.
     * @param {number} a - The first upper or lower threshold to check between.
     * @param {number} b - The second upper or lower threshold to check between.
     * @param {boolean} inclusive - If true, a num param which is equal to a or b will return true.
     * @returns {boolean} true if between or false otherwise.
     * @ignore
     */
    between(num, a, b, inclusive) {
        const min = Math.min(a, b);
        const max = Math.max(a, b);
        return inclusive ? num >= min && num <= max : num > min && num < max;
    }
};

export { math };
