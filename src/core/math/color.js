import { math } from './math.js';

/**
 * An RGBA color.
 *
 * Each color component is a floating point value in the range 0 to 1. The `r` (red), `g` (green)
 * and `b` (blue) components define a color in RGB color space. The `a` (alpha) component defines
 * transparency. An alpha of 1 is fully opaque. An alpha of 0 is fully transparent.
 *
 * @category Math
 */
class Color {
    /**
     * The red component of the color.
     *
     * @type {number}
     */
    r;

    /**
     * The green component of the color.
     *
     * @type {number}
     */
    g;

    /**
     * The blue component of the color.
     *
     * @type {number}
     */
    b;

    /**
     * The alpha component of the color.
     *
     * @type {number}
     */
    a;

    /**
     * Create a new Color object.
     *
     * @param {number|number[]} [r] - The value of the red component (0-1). Defaults to 0. If r is
     * an array of length 3 or 4, the array will be used to populate all components.
     * @param {number} [g] - The value of the green component (0-1). Defaults to 0.
     * @param {number} [b] - The value of the blue component (0-1). Defaults to 0.
     * @param {number} [a] - The value of the alpha component (0-1). Defaults to 1.
     */
    constructor(r = 0, g = 0, b = 0, a = 1) {
        const length = r.length;
        if (length === 3 || length === 4) {
            this.r = r[0];
            this.g = r[1];
            this.b = r[2];
            this.a = r[3] ?? 1;
        } else {
            this.r = r;
            this.g = g;
            this.b = b;
            this.a = a;
        }
    }

    /**
     * Returns a clone of the specified color.
     *
     * @returns {this} A duplicate color object.
     */
    clone() {
        /** @type {this} */
        const cstr = this.constructor;
        return new cstr(this.r, this.g, this.b, this.a);
    }

    /**
     * Copies the contents of a source color to a destination color.
     *
     * @param {Color} rhs - A color to copy to the specified color.
     * @returns {Color} Self for chaining.
     * @example
     * const src = new pc.Color(1, 0, 0, 1);
     * const dst = new pc.Color();
     *
     * dst.copy(src);
     *
     * console.log("The two colors are " + (dst.equals(src) ? "equal" : "different"));
     */
    copy(rhs) {
        this.r = rhs.r;
        this.g = rhs.g;
        this.b = rhs.b;
        this.a = rhs.a;

        return this;
    }

    /**
     * Reports whether two colors are equal.
     *
     * @param {Color} rhs - The color to compare to the specified color.
     * @returns {boolean} True if the colors are equal and false otherwise.
     * @example
     * const a = new pc.Color(1, 0, 0, 1);
     * const b = new pc.Color(1, 1, 0, 1);
     * console.log("The two colors are " + (a.equals(b) ? "equal" : "different"));
     */
    equals(rhs) {
        return this.r === rhs.r && this.g === rhs.g && this.b === rhs.b && this.a === rhs.a;
    }

    /**
     * Assign values to the color components, including alpha.
     *
     * @param {number} r - The value for red (0-1).
     * @param {number} g - The value for blue (0-1).
     * @param {number} b - The value for green (0-1).
     * @param {number} [a] - The value for the alpha (0-1), defaults to 1.
     * @returns {Color} Self for chaining.
     */
    set(r, g, b, a = 1) {
        this.r = r;
        this.g = g;
        this.b = b;
        this.a = a;

        return this;
    }

    /**
     * Returns the result of a linear interpolation between two specified colors.
     *
     * @param {Color} lhs - The color to interpolate from.
     * @param {Color} rhs - The color to interpolate to.
     * @param {number} alpha - The value controlling the point of interpolation. Between 0 and 1,
     * the linear interpolant will occur on a straight line between lhs and rhs. Outside of this
     * range, the linear interpolant will occur on a ray extrapolated from this line.
     * @returns {Color} Self for chaining.
     * @example
     * const a = new pc.Color(0, 0, 0);
     * const b = new pc.Color(1, 1, 0.5);
     * const r = new pc.Color();
     *
     * r.lerp(a, b, 0);   // r is equal to a
     * r.lerp(a, b, 0.5); // r is 0.5, 0.5, 0.25
     * r.lerp(a, b, 1);   // r is equal to b
     */
    lerp(lhs, rhs, alpha) {
        this.r = lhs.r + alpha * (rhs.r - lhs.r);
        this.g = lhs.g + alpha * (rhs.g - lhs.g);
        this.b = lhs.b + alpha * (rhs.b - lhs.b);
        this.a = lhs.a + alpha * (rhs.a - lhs.a);

        return this;
    }

    /**
     * Converts the color from gamma to linear color space.
     *
     * @param {Color} [src] - The color to convert to linear color space. If not set, the operation
     * is done in place.
     * @returns {Color} Self for chaining.
     */
    linear(src = this) {
        this.r = Math.pow(src.r, 2.2);
        this.g = Math.pow(src.g, 2.2);
        this.b = Math.pow(src.b, 2.2);
        this.a = src.a;
        return this;
    }

    /**
     * Converts the color from linear to gamma color space.
     *
     * @param {Color} [src] - The color to convert to gamma color space. If not set, the operation is
     * done in place.
     * @returns {Color} Self for chaining.
     */
    gamma(src = this) {
        this.r = Math.pow(src.r, 1 / 2.2);
        this.g = Math.pow(src.g, 1 / 2.2);
        this.b = Math.pow(src.b, 1 / 2.2);
        this.a = src.a;
        return this;
    }

    /**
     * Multiplies RGB elements of a Color by a number. Note that the alpha value is left unchanged.
     *
     * @param {number} scalar - The number to multiply by.
     * @returns {Color} Self for chaining.
     */
    mulScalar(scalar) {
        this.r *= scalar;
        this.g *= scalar;
        this.b *= scalar;
        return this;
    }

    /**
     * Set the values of the color from a string representation '#11223344' or '#112233'.
     *
     * @param {string} hex - A string representation in the format '#RRGGBBAA' or '#RRGGBB'. Where
     * RR, GG, BB, AA are red, green, blue and alpha values. This is the same format used in
     * HTML/CSS.
     * @returns {Color} Self for chaining.
     */
    fromString(hex) {
        const i = parseInt(hex.replace('#', '0x'), 16);
        let bytes;
        if (hex.length > 7) {
            bytes = math.intToBytes32(i);
        } else {
            bytes = math.intToBytes24(i);
            bytes[3] = 255;
        }

        this.set(bytes[0] / 255, bytes[1] / 255, bytes[2] / 255, bytes[3] / 255);

        return this;
    }

    /**
     * Converts the color to string form. The format is '#RRGGBBAA', where RR, GG, BB, AA are the
     * red, green, blue and alpha values. When the alpha value is not included (the default), this
     * is the same format as used in HTML/CSS.
     *
     * @param {boolean} alpha - If true, the output string will include the alpha value.
     * @returns {string} The color in string form.
     * @example
     * const c = new pc.Color(1, 1, 1);
     * // Outputs #ffffffff
     * console.log(c.toString());
     */
    toString(alpha) {
        let s = '#' + ((1 << 24) + (Math.round(this.r * 255) << 16) + (Math.round(this.g * 255) << 8) + Math.round(this.b * 255)).toString(16).slice(1);
        if (alpha === true) {
            const a = Math.round(this.a * 255).toString(16);
            if (this.a < 16 / 255) {
                s += '0' + a;
            } else {
                s += a;
            }

        }

        return s;
    }

    /**
     * A constant color set to black [0, 0, 0, 1].
     *
     * @type {Color}
     * @readonly
     */
    static BLACK = Object.freeze(new Color(0, 0, 0, 1));

    /**
     * A constant color set to blue [0, 0, 1, 1].
     *
     * @type {Color}
     * @readonly
     */
    static BLUE = Object.freeze(new Color(0, 0, 1, 1));

    /**
     * A constant color set to cyan [0, 1, 1, 1].
     *
     * @type {Color}
     * @readonly
     */
    static CYAN = Object.freeze(new Color(0, 1, 1, 1));

    /**
     * A constant color set to gray [0.5, 0.5, 0.5, 1].
     *
     * @type {Color}
     * @readonly
     */
    static GRAY = Object.freeze(new Color(0.5, 0.5, 0.5, 1));

    /**
     * A constant color set to green [0, 1, 0, 1].
     *
     * @type {Color}
     * @readonly
     */
    static GREEN = Object.freeze(new Color(0, 1, 0, 1));

    /**
     * A constant color set to magenta [1, 0, 1, 1].
     *
     * @type {Color}
     * @readonly
     */
    static MAGENTA = Object.freeze(new Color(1, 0, 1, 1));

    /**
     * A constant color set to red [1, 0, 0, 1].
     *
     * @type {Color}
     * @readonly
     */
    static RED = Object.freeze(new Color(1, 0, 0, 1));

    /**
     * A constant color set to white [1, 1, 1, 1].
     *
     * @type {Color}
     * @readonly
     */
    static WHITE = Object.freeze(new Color(1, 1, 1, 1));

    /**
     * A constant color set to yellow [1, 1, 0, 1].
     *
     * @type {Color}
     * @readonly
     */
    static YELLOW = Object.freeze(new Color(1, 1, 0, 1));
}

export { Color };
