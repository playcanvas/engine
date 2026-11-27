import { Debug } from '../../core/debug.js';
import { ShaderChunks } from '../shader-lib/shader-chunks.js';

/**
 * @import { GraphicsDevice } from '../../platform/graphics/graphics-device.js'
 */

/**
 * Returns the source of a gsplat shader chunk in a shader language, by default the language of the
 * device. The gsplat code reads its chunks this way rather than importing them, so that the gsplat
 * feature for one device brings the chunks of its language only.
 *
 * @param {GraphicsDevice} device - The graphics device the gsplat chunks are installed on.
 * @param {string} name - The name of the chunk.
 * @param {string} [language] - The shader language. Defaults to the language of the device.
 * @returns {string} The source of the chunk.
 * @ignore
 */
const getGsplatChunk = (device, name, language = device.shaderLanguage) => {
    const code = ShaderChunks.get(device, language).get(name);
    Debug.assert(code !== undefined, `The gsplat shader chunk ${name} is not installed for the ${language} shader language. Gaussian splats need featureGsplat, installed for the device.`);
    return code;
};

export { getGsplatChunk };
