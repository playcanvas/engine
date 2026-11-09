import { Color } from '../../core/math/color.js';

// Debug colors per LOD level, shared by LOD colorization and the AABB debug views. LOD n has the
// hue (n % 3) * 120 + floor(n / 3) * 30 degrees: every three levels run red-ish, green-ish,
// blue-ish like the first three, and each following triple turns 30 degrees, so the first color of
// a triple tells which triple it is - red, orange, yellow, lime. Neighboring levels are always at
// least 90 degrees of hue apart, so band edges stand out. The colors multiply the splat color, so
// they stay fully saturated - a darker or paler tint would read as shading or as no tint at all.
// The last three levels are white and grays, and coarser levels share the last color.
const LOD_DEBUG_COLORS = [
    [1, 0, 0],          // 0 red
    [0, 1, 0],          // 1 green
    [0, 0, 1],          // 2 blue
    [1, 0.5, 0],        // 3 orange
    [0, 1, 0.5],        // 4 spring green
    [0.5, 0, 1],        // 5 violet
    [1, 1, 0],          // 6 yellow
    [0, 1, 1],          // 7 cyan
    [1, 0, 1],          // 8 magenta
    [0.5, 1, 0],        // 9 lime
    [0, 0.5, 1],        // 10 azure
    [1, 0, 0.5],        // 11 rose
    [1, 1, 1],          // 12 white
    [0.6, 0.6, 0.6],    // 13 light gray
    [0.3, 0.3, 0.3]     // 14 dark gray
];

/** @type {Color[]|null} */
let _lodDebugColors = null;

/**
 * Returns {@link LOD_DEBUG_COLORS} as Color instances, for the debug wireframes.
 *
 * @returns {Color[]} The colors, indexed with {@link lodDebugColorIndex}.
 * @ignore
 */
const getLodDebugColors = () => {
    _lodDebugColors ??= LOD_DEBUG_COLORS.map(([r, g, b]) => new Color(r, g, b));
    return _lodDebugColors;
};

/**
 * Maps a LOD index to its entry in the LOD debug colors.
 *
 * @param {number} lodIndex - The LOD index.
 * @returns {number} The color index.
 * @ignore
 */
const lodDebugColorIndex = lodIndex => Math.min(lodIndex, LOD_DEBUG_COLORS.length - 1);

export { LOD_DEBUG_COLORS, getLodDebugColors, lodDebugColorIndex };
