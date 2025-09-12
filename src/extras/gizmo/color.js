import { Color } from '../../core/math/color.js';

export const COLOR_RED = Object.freeze(new Color(1, 0.3, 0.3));
export const COLOR_GREEN = Object.freeze(new Color(0.3, 1, 0.3));
export const COLOR_BLUE = Object.freeze(new Color(0.3, 0.3, 1));
export const COLOR_YELLOW = Object.freeze(new Color(1, 1, 0.5));
export const COLOR_GRAY = Object.freeze(new Color(0.5, 0.5, 0.5, 0.5));

/**
 * Converts Color4 to Color3.
 *
 * @param {Color} color - Color4
 * @returns {Color} - Color3
 */
export const color3from4  = (color) => {
    return new Color(color.r, color.g, color.b);
};

/**
 * Converts Color3 to Color4.
 *
 * @param {Color} color - Color3
 * @param {number} a - Alpha value for Color4
 * @returns {Color} - Color4
 */
export const color4from3 = (color, a) => {
    return new Color(color.r, color.g, color.b, a);
};

/**
 * Linearly interpolates between two colors.
 *
 * @param {Color} colorA - The starting color.
 * @param {Color} colorB - The ending color.
 * @param {number} t - The interpolation factor (0 to 1).
 * @returns {Color} The interpolated color.
 */
export const colorMix = (colorA, colorB, t) => {
    return new Color(
        colorA.r * (1 - t) + colorB.r * t,
        colorA.g * (1 - t) + colorB.g * t,
        colorA.b * (1 - t) + colorB.b * t,
        colorA.a * (1 - t) + colorB.a * t
    );
};
