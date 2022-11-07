import { Shader } from '../../platform/graphics/shader.js';
import { ShaderUtils } from '../../platform/graphics/shader-utils.js';
import { shaderChunks } from './chunks/chunks.js';
import { getProgramLibrary } from './get-program-library.js';

/**
 * Create a shader from named shader chunks.
 *
 * @param {import('../../platform/graphics/graphics-device.js').GraphicsDevice} device - The
 * graphics device.
 * @param {string} vsName - The vertex shader chunk name.
 * @param {string} fsName - The fragment shader chunk name.
 * @param {boolean} [useTransformFeedback] - Whether to use transform feedback. Defaults to false.
 * @returns {Shader} The newly created shader.
 */
function createShader(device, vsName, fsName, useTransformFeedback = false) {
    return new Shader(device, ShaderUtils.createDefinition(device, {
        name: `${vsName}_${fsName}`,
        vertexCode: shaderChunks[vsName],
        fragmentCode: shaderChunks[fsName],
        useTransformFeedback: useTransformFeedback
    }));
}

/**
 * Create a shader from the supplied source code.
 *
 * @param {import('../../platform/graphics/graphics-device.js').GraphicsDevice} device - The
 * graphics device.
 * @param {string} vsCode - The vertex shader code.
 * @param {string} fsCode - The fragment shader code.
 * @param {string} uniqueName - Unique name for the shader.
 * @param {boolean} [useTransformFeedback] - Whether to use transform feedback. Defaults to false.
 * @param {string} [fragmentPreamble] - An optional 'preamble' string for the fragment shader. Defaults
 * to ''.
 * @returns {Shader} The newly created shader.
 */
function createShaderFromCode(device, vsCode, fsCode, uniqueName, useTransformFeedback = false, fragmentPreamble = '') {
    const programLibrary = getProgramLibrary(device);
    let shader = programLibrary.getCachedShader(uniqueName);
    if (!shader) {
        shader = new Shader(device, ShaderUtils.createDefinition(device, {
            name: uniqueName,
            vertexCode: vsCode,
            fragmentCode: fsCode,
            fragmentPreamble: fragmentPreamble,
            useTransformFeedback: useTransformFeedback
        }));
        programLibrary.setCachedShader(uniqueName, shader);
    }
    return shader;
}

shaderChunks.createShader = createShader;
shaderChunks.createShaderFromCode = createShaderFromCode;

export { createShader, createShaderFromCode };
