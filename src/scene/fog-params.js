import { Color } from '../core/math/color.js';
import { FOG_NONE } from './constants.js';

/**
 * Fog parameters.
 *
 * @category Graphics
 */
class FogParams {
    /**
     * The type of fog used by the scene. Can be:
     *
     * - {@link FOG_NONE}
     * - {@link FOG_LINEAR}
     * - {@link FOG_EXP}
     * - {@link FOG_EXP2}
     *
     * Defaults to {@link FOG_NONE}.
     *
     * @type {string}
     */
    type = FOG_NONE;

    /**
     * The color of the fog (if enabled), specified in sRGB color space. Defaults to black (0, 0, 0).
     *
     * @type {Color}
     */
    color = new Color(0, 0, 0);

    /**
     * The density of the fog (if enabled). This property is only valid if the fog property is set
     * to {@link FOG_EXP} or {@link FOG_EXP2}. Defaults to 0.
     *
     * @type {number}
     */
    density = 0;

    /**
     * The distance from the viewpoint where linear fog begins. This property is only valid if the
     * fog property is set to {@link FOG_LINEAR}. Defaults to 1.
     *
     * @type {number}
     */
    start = 1;

    /**
     * The distance from the viewpoint where linear fog reaches its maximum. This property is only
     * valid if the fog property is set to {@link FOG_LINEAR}. Defaults to 1000.
     *
     * @type {number}
     */
    end = 1000;
}

export { FogParams };
