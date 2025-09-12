import { Color } from '../../core/math/color.js';

export const COLOR_RED = Object.freeze(new Color(1, 0.3, 0.3));
export const COLOR_GREEN = Object.freeze(new Color(0.3, 1, 0.3));
export const COLOR_BLUE = Object.freeze(new Color(0.3, 0.3, 1));
export const COLOR_YELLOW = Object.freeze(new Color(1, 1, 0.5));
export const COLOR_GRAY = Object.freeze(new Color(0.5, 0.5, 0.5, 0.5));

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
