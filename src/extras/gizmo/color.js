import { Color } from '../../core/math/color.js';

export const COLOR_RED = Object.freeze(new Color(1, 0.3, 0.3));
export const COLOR_GREEN = Object.freeze(new Color(0.3, 1, 0.3));
export const COLOR_BLUE = Object.freeze(new Color(0.3, 0.3, 1));
export const COLOR_YELLOW = Object.freeze(new Color(1, 1, 0.5));
export const COLOR_AMBER = Object.freeze(new Color(1, 0.75, 0.3));
export const COLOR_CYAN = Object.freeze(new Color(0.3, 0.85, 1));
export const COLOR_MAGENTA = Object.freeze(new Color(1, 0.45, 0.9));
export const COLOR_GRAY = Object.freeze(new Color(0.5, 0.5, 0.5, 0.5));
export const COLOR_BACKDROP = Object.freeze(new Color(0.05, 0.055, 0.07, 0.6));

/**
 * Converts Color3 to Color4.
 *
 * @param {Color} color - Color3
 * @param {number} a - The alpha.
 * @returns {Color} - Color4
 */
export const color4from3 = (color, a) => {
    return new Color(color.r, color.g, color.b, a);
};
