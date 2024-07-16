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

export const color4from3 = (color, a) => {
    return new Color(color.r, color.g, color.b, a);
};
