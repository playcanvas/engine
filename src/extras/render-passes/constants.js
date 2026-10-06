/**
 * SSAO is disabled.
 *
 * @category Graphics
 */
export const SSAOTYPE_NONE = 'none';

/**
 * SSAO is applied during the lighting calculation stage, allowing it to blend seamlessly with scene
 * lighting. This results in ambient occlusion being more pronounced in areas where direct light is
 * obstructed, enhancing realism.
 *
 * @category Graphics
 */
export const SSAOTYPE_LIGHTING = 'lighting';

/**
 * SSAO is applied as a standalone effect after the scene is rendered. This method uniformly
 * overlays ambient occlusion across the image, disregarding direct lighting interactions. While
 * this may sacrifice some realism, it can be advantageous for achieving specific artistic styles.
 *
 * @category Graphics
 */
export const SSAOTYPE_COMBINE = 'combine';

/**
 * Compose slot applied to the scene colour immediately after it is sampled, before any other
 * composition. Effects here receive and return the full `vec4` including alpha, and may take
 * multiple taps of the scene texture.
 *
 * @category Graphics
 */
export const COMPOSESLOT_SCENE = 'scene';

/**
 * Compose slot applied in linear, scene-referred HDR space, before tone mapping.
 *
 * @category Graphics
 */
export const COMPOSESLOT_HDR = 'hdr';

/**
 * Compose slot applied in display-referred LDR space, after tone mapping and before gamma
 * correction.
 *
 * @category Graphics
 */
export const COMPOSESLOT_LDR = 'ldr';

/**
 * Compose slot applied after gamma correction, on the final output values.
 *
 * @category Graphics
 */
export const COMPOSESLOT_OUTPUT = 'output';

/**
 * The compose slots, in the order they are applied.
 *
 * @type {string[]}
 * @ignore
 */
export const composeSlots = [COMPOSESLOT_SCENE, COMPOSESLOT_HDR, COMPOSESLOT_LDR, COMPOSESLOT_OUTPUT];
