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
