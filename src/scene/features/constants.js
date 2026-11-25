// The names of the features engine code checks for in the features of a graphics device. They are
// kept apart from the features, so that checking for one does not import, and bundle, it.

/**
 * @import { GraphicsDevice } from '../../platform/graphics/graphics-device.js'
 */

/**
 * Returns true if a feature is installed on a graphics device. Feature names are recorded in debug
 * builds only, so this is for debug checks, such as `Debug.assert(hasFeature(device,
 * FEATURE_SHADOWS))`, which release builds strip together with it.
 *
 * @param {GraphicsDevice} device - The graphics device.
 * @param {string} name - The name of the feature, one of the `FEATURE_*` constants.
 * @returns {boolean} True if the feature is installed.
 * @ignore
 */
export const hasFeature = (device, name) => device.featureNames.has(name);

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
