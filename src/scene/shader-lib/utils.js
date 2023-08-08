import { Shader } from '../../platform/graphics/shader.js';
import { ShaderUtils } from '../../platform/graphics/shader-utils.js';
import { shaderChunks } from './chunks/chunks.js';
import { getProgramLibrary } from './get-program-library.js';
import { Debug } from '../../core/debug.js';

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
 * Create a shader from the supplied source code. Note that this function adds additional shader
 * blocks to both vertex and fragment shaders, which allow the shader to use more features and
 * compile on both WebGL and WebGPU. Specifically, these blocks are added, and should not be
 * part of provided vsCode and fsCode: shader version, shader precision, commonly used extensions.
 *
 * @param {import('../../platform/graphics/graphics-device.js').GraphicsDevice} device - The
 * graphics device.
 * @param {string} vsCode - The vertex shader code.
 * @param {string} fsCode - The fragment shader code.
 * @param {string} uniqueName - Unique name for the shader. If a shader with this name already
 * exists, it will be returned instead of a new shader instance.
 * @param {Object<string, string>} [attributes] - Object detailing the mapping of vertex shader
 * attribute names to semantics SEMANTIC_*. This enables the engine to match vertex buffer data as
 * inputs to the shader. Defaults to undefined, which generates the default attributes.
 * @param {boolean} [useTransformFeedback] - Whether to use transform feedback. Defaults to false.
 * @returns {Shader} The newly created shader.
 */
function createShaderFromCode(device, vsCode, fsCode, uniqueName, attributes, useTransformFeedback = false) {

    // the function signature has changed, fail if called incorrectly
    Debug.assert(typeof attributes !== 'boolean');

    const programLibrary = getProgramLibrary(device);
    let shader = programLibrary.getCachedShader(uniqueName);
    if (!shader) {
        shader = new Shader(device, ShaderUtils.createDefinition(device, {
            name: uniqueName,
            vertexCode: vsCode,
            fragmentCode: fsCode,
            attributes: attributes,
            useTransformFeedback: useTransformFeedback
        }));
        programLibrary.setCachedShader(uniqueName, shader);
    }
    return shader;
}

/**
 * Process shader using shader processing options, utilizing cache of the ProgramLibrary
 *
 * @param {Shader} shader - The shader to be processed.
 * @param {import('../../platform/graphics/shader-processor-options.js').ShaderProcessorOptions} processingOptions -
 * The shader processing options.
 * @returns {Shader} The processed shader.
 * @ignore
 */
function processShader(shader, processingOptions) {

    Debug.assert(shader);
    const shaderDefinition = shader.definition;

    // 'shader' generator for a material - simply return existing shader definition. Use generator and getProgram
    // to allow for shader processing to be cached
    const name = shaderDefinition.name ?? 'shader';
    const key = `${name}-id-${shader.id}`;
    const materialGenerator = {
        generateKey: function (options) {
            // unique name based of the shader id
            return key;
        },

        createShaderDefinition: function (device, options) {
            return shaderDefinition;
        }
    };

    // temporarily register the program generator
    const libraryModuleName = 'shader';
    const library = getProgramLibrary(shader.device);
    Debug.assert(!library.isRegistered(libraryModuleName));
    library.register(libraryModuleName, materialGenerator);

    // generate shader variant - its the same shader, but with different processing options
    const variant = library.getProgram(libraryModuleName, {}, processingOptions);

    // unregister it again
    library.unregister(libraryModuleName);

    return variant;
}


shaderChunks.createShader = createShader;
shaderChunks.createShaderFromCode = createShaderFromCode;

export { createShader, createShaderFromCode, processShader };
