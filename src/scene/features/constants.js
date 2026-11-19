// The names of the features engine code checks for in the features of a graphics device. They are
// kept apart from the features, so that checking for one does not import, and bundle, it.

/**
 * The name of the shadows feature.
 *
 * @type {string}
 * @ignore
 */
export const FEATURE_SHADOWS = 'shadows';

/**
 * The name of the area lights feature.
 *
 * @type {string}
 * @ignore
 */
export const FEATURE_AREA_LIGHTS = 'areaLights';

/**
 * The name of the particles feature.
 *
 * @type {string}
 * @ignore
 */
export const FEATURE_PARTICLES = 'particles';

/**
 * The name of the directional PCSS feature.
 *
 * @type {string}
 * @ignore
 */
export const FEATURE_DIRECTIONAL_PCSS = 'directionalPcss';

/**
 * The name of the directional shadows feature.
 *
 * @type {string}
 * @ignore
 */
export const FEATURE_DIRECTIONAL_SHADOWS = 'directionalShadows';

/**
 * The name of the local shadows feature, the shadows of omni and spot lights.
 *
 * @type {string}
 * @ignore
 */
export const FEATURE_LOCAL_SHADOWS = 'localShadows';
