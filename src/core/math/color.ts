import { math } from './math.js';

/**
 * An RGBA color.
 *
 * Each color component is a floating point value in the range 0 to 1. The {@link r} (red),
 * {@link g} (green) and {@link b} (blue) components define a color in RGB color space. The
 * {@link a} (alpha) component defines transparency. An alpha of 1 is fully opaque. An alpha of
 * 0 is fully transparent.
 *
 * @category Math
 */
class Color {
    /**
     * The red component of the color.
     */
    r: number;

    /**
     * The green component of the color.
     */
    g: number;

    /**
     * The blue component of the color.
     */
    b: number;

    /**
     * The alpha component of the color.
     */
    a: number;

    /**
     * Creates a new Color instance.
     *
     * @param r - The r value. Defaults to 0. If r is an array of length 3 or
     * 4, the array will be used to populate all components.
     * @param g - The g value. Defaults to 0.
     * @param b - The b value. Defaults to 0.
     * @param a - The a value. Defaults to 1.
     * @example
     * const c1 = new pc.Color(); // defaults to 0, 0, 0, 1
     * const c2 = new pc.Color(0.1, 0.2, 0.3, 0.4);
     * @example
     * const c = new pc.Color([0.1, 0.2, 0.3, 0.4]);
     */
    constructor(r: number | number[] = 0, g: number = 0, b: number = 0, a: number = 1) {
        if (Array.isArray(r)) {
            const length = r.length;
            if (length === 3 || length === 4) {
                this.r = r[0];
                this.g = r[1];
                this.b = r[2];
                this.a = r[3] ?? 1;
            } else {
                this.r = 0;
                this.g = 0;
                this.b = 0;
                this.a = 1;
            }
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
     * @returns A duplicate color object.
     */
    clone(): this {
        const cstr = this.constructor as new (r: number, g: number, b: number, a: number) => this;
        return new cstr(this.r, this.g, this.b, this.a);
    }

    /**
     * Copies the contents of a source color to a destination color.
     *
     * @param rhs - A color to copy to the specified color.
     * @returns Self for chaining.
     * @example
     * const src = new pc.Color(1, 0, 0, 1);
     * const dst = new pc.Color();
     *
     * dst.copy(src);
     *
     * console.log("The two colors are " + (dst.equals(src) ? "equal" : "different"));
     */
    copy(rhs: Color): Color {
        this.r = rhs.r;
        this.g = rhs.g;
        this.b = rhs.b;
        this.a = rhs.a;

        return this;
    }

    /**
     * Reports whether two colors are equal.
     *
     * @param rhs - The color to compare to the specified color.
     * @returns True if the colors are equal and false otherwise.
     * @example
     * const a = new pc.Color(1, 0, 0, 1);
     * const b = new pc.Color(1, 1, 0, 1);
     * console.log("The two colors are " + (a.equals(b) ? "equal" : "different"));
     */
    equals(rhs: Color): boolean {
        return this.r === rhs.r && this.g === rhs.g && this.b === rhs.b && this.a === rhs.a;
    }

    /**
     * Assign values to the color components, including alpha.
     *
     * @param r - The value for red (0-1).
     * @param g - The value for blue (0-1).
     * @param b - The value for green (0-1).
     * @param a - The value for the alpha (0-1), defaults to 1.
     * @returns Self for chaining.
     */
    set(r: number, g: number, b: number, a: number = 1): Color {
        this.r = r;
        this.g = g;
        this.b = b;
        this.a = a;

        return this;
    }

    /**
     * Returns the result of a linear interpolation between two specified colors.
     *
     * @param lhs - The color to interpolate from.
     * @param rhs - The color to interpolate to.
     * @param alpha - The value controlling the point of interpolation. Between 0 and 1,
     * the linear interpolant will occur on a straight line between lhs and rhs. Outside of this
     * range, the linear interpolant will occur on a ray extrapolated from this line.
     * @returns Self for chaining.
     * @example
     * const a = new pc.Color(0, 0, 0);
     * const b = new pc.Color(1, 1, 0.5);
     * const r = new pc.Color();
     *
     * r.lerp(a, b, 0);   // r is equal to a
     * r.lerp(a, b, 0.5); // r is 0.5, 0.5, 0.25
     * r.lerp(a, b, 1);   // r is equal to b
     */
    lerp(lhs: Color, rhs: Color, alpha: number): Color {
        this.r = lhs.r + alpha * (rhs.r - lhs.r);
        this.g = lhs.g + alpha * (rhs.g - lhs.g);
        this.b = lhs.b + alpha * (rhs.b - lhs.b);
        this.a = lhs.a + alpha * (rhs.a - lhs.a);

        return this;
    }

    /**
     * Converts the color from gamma to linear color space.
     *
     * @param src - The color to convert to linear color space. If not set, the operation
     * is done in place.
     * @returns Self for chaining.
     */
    linear(src: Color = this): Color {
        this.r = Math.pow(src.r, 2.2);
        this.g = Math.pow(src.g, 2.2);
        this.b = Math.pow(src.b, 2.2);
        this.a = src.a;
        return this;
    }

    /**
     * Converts the color from linear to gamma color space.
     *
     * @param src - The color to convert to gamma color space. If not set, the operation is
     * done in place.
     * @returns Self for chaining.
     */
    gamma(src: Color = this): Color {
        this.r = Math.pow(src.r, 1 / 2.2);
        this.g = Math.pow(src.g, 1 / 2.2);
        this.b = Math.pow(src.b, 1 / 2.2);
        this.a = src.a;
        return this;
    }

    /**
     * Multiplies RGB elements of a Color by a number. Note that the alpha value is left unchanged.
     *
     * @param scalar - The number to multiply by.
     * @returns Self for chaining.
     */
    mulScalar(scalar: number): Color {
        this.r *= scalar;
        this.g *= scalar;
        this.b *= scalar;
        return this;
    }

    /**
     * Set the values of the color from a string representation '#11223344' or '#112233'.
     *
     * @param hex - A string representation in the format '#RRGGBBAA' or '#RRGGBB'. Where
     * RR, GG, BB, AA are red, green, blue and alpha values. This is the same format used in
     * HTML/CSS.
     * @returns Self for chaining.
     */
    fromString(hex: string): Color {
        const i = parseInt(hex.replace('#', '0x'), 16);
        let bytes: number[];
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
     * Set the values of the vector from an array.
     *
     * @param arr - The array to set the vector values from.
     * @param offset - The zero-based index at which to start copying elements from the
     * array. Default is 0.
     * @returns Self for chaining.
     * @example
     * const c = new pc.Color();
     * c.fromArray([1, 0, 1, 1]);
     * // c is set to [1, 0, 1, 1]
     */
    fromArray(arr: number[], offset: number = 0): Color {
        this.r = arr[offset] ?? this.r;
        this.g = arr[offset + 1] ?? this.g;
        this.b = arr[offset + 2] ?? this.b;
        this.a = arr[offset + 3] ?? this.a;

        return this;
    }

    /**
     * Converts the color to string form. The format is '#RRGGBBAA', where RR, GG, BB, AA are the
     * red, green, blue and alpha values. When the alpha value is not included (the default), this
     * is the same format as used in HTML/CSS.
     *
     * @param alpha - If true, the output string will include the alpha value.
     * @param asArray - If true, the output will be an array of numbers. Defaults to false.
     * @returns The color in string form.
     * @example
     * const c = new pc.Color(1, 1, 1);
     * // Outputs #ffffffff
     * console.log(c.toString());
     */
    toString(alpha?: boolean, asArray?: boolean): string {

        const { r, g, b, a } = this;

        // If any component exceeds 1 (HDR), return the color as an array
        if (asArray || r > 1 || g > 1 || b > 1) {
            return `${r.toFixed(3)}, ${g.toFixed(3)}, ${b.toFixed(3)}, ${a.toFixed(3)}`;
        }

        let s = `#${((1 << 24) + (Math.round(r * 255) << 16) + (Math.round(g * 255) << 8) + Math.round(b * 255)).toString(16).slice(1)}`;
        if (alpha === true) {
            const aa = Math.round(a * 255).toString(16);
            if (this.a < 16 / 255) {
                s += `0${aa}`;
            } else {
                s += aa;
            }
        }
        return s;
    }

    /**
     * Converts the color to an array.
     *
     * @param arr - The array to populate with the color's number
     * components. If not specified, a new array is created.
     * @param offset - The zero-based index at which to start copying elements to the
     * array. Default is 0.
     * @param alpha - If true, the output array will include the alpha value.
     * @returns The color as an array.
     * @example
     * const c = new pc.Color(1, 1, 1);
     * // Outputs [1, 1, 1, 1]
     * console.log(c.toArray());
     */
    toArray<T extends ArrayLike<number> & { [key: number]: number } = number[]>(arr?: T, offset: number = 0, alpha: boolean = true): T {
        const result = arr || [] as unknown as T;
        result[offset] = this.r;
        result[offset + 1] = this.g;
        result[offset + 2] = this.b;
        if (alpha) {
            result[offset + 3] = this.a;
        }
        return result;
    }

    /**
     * A constant color set to black [0, 0, 0, 1].
     */
    static readonly BLACK = Object.freeze(new Color(0, 0, 0, 1));

    /**
     * A constant color set to blue [0, 0, 1, 1].
     */
    static readonly BLUE = Object.freeze(new Color(0, 0, 1, 1));

    /**
     * A constant color set to cyan [0, 1, 1, 1].
     */
    static readonly CYAN = Object.freeze(new Color(0, 1, 1, 1));

    /**
     * A constant color set to gray [0.5, 0.5, 0.5, 1].
     */
    static readonly GRAY = Object.freeze(new Color(0.5, 0.5, 0.5, 1));

    /**
     * A constant color set to green [0, 1, 0, 1].
     */
    static readonly GREEN = Object.freeze(new Color(0, 1, 0, 1));

    /**
     * A constant color set to magenta [1, 0, 1, 1].
     */
    static readonly MAGENTA = Object.freeze(new Color(1, 0, 1, 1));

    /**
     * A constant color set to red [1, 0, 0, 1].
     */
    static readonly RED = Object.freeze(new Color(1, 0, 0, 1));

    /**
     * A constant color set to white [1, 1, 1, 1].
     */
    static readonly WHITE = Object.freeze(new Color(1, 1, 1, 1));

    /**
     * A constant color set to yellow [1, 1, 0, 1].
     */
    static readonly YELLOW = Object.freeze(new Color(1, 1, 0, 1));
}

export { Color };