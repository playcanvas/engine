import { SHADERLANGUAGE_WGSL } from '../src/platform/graphics/constants.js';
import { gsplatChunksGLSL } from '../src/scene/shader-lib/glsl/collections/gsplat-chunks-glsl.js';
import { ShaderChunks } from '../src/scene/shader-lib/shader-chunks.js';
import { gsplatChunksWGSL } from '../src/scene/shader-lib/wgsl/collections/gsplat-chunks-wgsl.js';

/**
 * @import { GraphicsDevice } from '../src/platform/graphics/graphics-device.js'
 */

/**
 * Registers the gsplat shader chunks of the shader language of a device, as featureGsplat does in
 * an application, for tests creating gsplat objects on a device without an application.
 *
 * @param {GraphicsDevice} device - The graphics device.
 */
export const installGsplatChunks = (device) => {
    const wgsl = device.shaderLanguage === SHADERLANGUAGE_WGSL;
    ShaderChunks.get(device, device.shaderLanguage).add(wgsl ? gsplatChunksWGSL : gsplatChunksGLSL);
};
