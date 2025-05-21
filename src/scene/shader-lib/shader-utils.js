import { Shader } from '../../platform/graphics/shader.js';
import { ShaderDefinitionUtils } from '../../platform/graphics/shader-definition-utils.js';
import { getProgramLibrary } from './get-program-library.js';
import { Debug } from '../../core/debug.js';
import { ShaderGenerator } from './programs/shader-generator.js';
import { ShaderPass } from '../shader-pass.js';
import { SHADERLANGUAGE_GLSL, SHADERLANGUAGE_WGSL } from '../../platform/graphics/constants.js';
import { ShaderChunks } from './shader-chunks.js';

/**
 * @import { GraphicsDevice } from '../../platform/graphics/graphics-device.js'
 * @import { ShaderProcessorOptions } from '../../platform/graphics/shader-processor-options.js'
 * @import { Material, ShaderVariantParams } from '../materials/material.js'
 * @import { CameraShaderParams } from '../camera-shader-params.js';
 */

class ShaderGeneratorPassThrough extends ShaderGenerator {
    constructor(key, shaderDefinition) {
        super();
        this.key = key;
        this.shaderDefinition = shaderDefinition;
    }

    generateKey(options) {
        return this.key;
    }

    createShaderDefinition(device, options) {
        return this.shaderDefinition;
    }
}

class ShaderUtils {
    /**
     * Creates a shader. When the active graphics device is WebGL, the provided GLSL vertex and
     * fragment source code is used. For WebGPU, if WGSL vertex and fragment source code is
     * supplied, it is used directly; otherwise, the system automatically translates the provided
     * GLSL code into WGSL. In the case of GLSL shaders, additional blocks are appended to both the
     * vertex and fragment source code to support extended features and maintain compatibility.
     * These additions include the shader version declaration, precision qualifiers, and commonly
     * used extensions, and therefore should be excluded from the user-supplied GLSL source.
     * Note: The shader has access to all registered shader chunks via the `#include` directive.
     * Any provided includes will be applied as overrides on top of those.
     *
     * @param {GraphicsDevice} device - The graphics device.
     * @param {object} options - Object for passing optional arguments.
     * @param {string} options.uniqueName - Unique name for the shader. If a shader with this name
     * already exists, it will be returned instead of a new shader instance.
     * @param {Object<string, string>} options.attributes - Object detailing the mapping of vertex
     * shader attribute names to semantics SEMANTIC_*. This enables the engine to match vertex
     * buffer data to the shader attributes.
     * @param {boolean} [options.useTransformFeedback] - Whether to use transform feedback. Defaults
     * to false. Only supported by WebGL.
     * @param {string} [options.vertexChunk] - The name of the vertex shader chunk to use.
     * @param {string} [options.vertexGLSL] - The vertex shader code in GLSL. Ignored if vertexChunk
     * is provided.
     * @param {string} [options.vertexWGSL] - The vertex shader code in WGSL. Ignored if vertexChunk
     * is provided.
     * @param {string} [options.fragmentChunk] - The name of the fragment shader chunk to use.
     * @param {string} [options.fragmentGLSL] - The fragment shader code in GLSL. Ignored if
     * fragmentChunk is provided.
     * @param {string} [options.fragmentWGSL] - The fragment shader code in WGSL. Ignored if
     * fragmentChunk is provided.
     * @param {Map<string, string>} [options.vertexIncludes] - A map containing key-value pairs of
     * include names and their content. These are used for resolving #include directives in the
     * vertex shader source.
     * @param {Map<string, string>} [options.vertexDefines] - A map containing key-value pairs of
     * define names and their values. These are used for resolving #ifdef style of directives in the
     * vertex code.
     * @param {Map<string, string>} [options.fragmentIncludes] - A map containing key-value pairs
     * of include names and their content. These are used for resolving #include directives in the
     * fragment shader source.
     * @param {Map<string, string>} [options.fragmentDefines] - A map containing key-value pairs of
     * define names and their values. These are used for resolving #ifdef style of directives in the
     * fragment code.
     * @param {string | string[]} [options.fragmentOutputTypes] - Fragment shader output types,
     * which default to vec4. Passing a string will set the output type for all color attachments.
     * Passing an array will set the output type for each color attachment.
     * @returns {Shader} The newly created shader.
     */
    static createShader(device, options) {

        const programLibrary = getProgramLibrary(device);
        let shader = programLibrary.getCachedShader(options.uniqueName);
        if (!shader) {

            // use WGSL language on WebGPU: if user provided WGSL code, or if named chunks are used
            const wgsl = device.isWebGPU &&
                (!!options.vertexWGSL || !!options.vertexChunk) &&
                (!!options.fragmentWGSL || !!options.fragmentChunk);

            // chunks map
            const chunksMap = ShaderChunks.get(device, wgsl ? SHADERLANGUAGE_WGSL : SHADERLANGUAGE_GLSL);

            // source code
            const vertexCode = options.vertexChunk ? chunksMap.get(options.vertexChunk) : (wgsl ? options.vertexWGSL : options.vertexGLSL);
            const fragmentCode = options.fragmentChunk ? chunksMap.get(options.fragmentChunk) : (wgsl ? options.fragmentWGSL : options.fragmentGLSL);
            Debug.assert(vertexCode, 'ShaderUtils.createShader: vertex shader code not provided', options);
            Debug.assert(fragmentCode, 'ShaderUtils.createShader: fragment shader code not provided', options);

            // add default shader chunks to includes
            const fragmentIncludes = options.fragmentIncludes ? new Map([...chunksMap, ...options.fragmentIncludes]) : new Map(chunksMap);
            const vertexIncludes = options.vertexIncludes ? new Map([...chunksMap, ...options.vertexIncludes]) : new Map(chunksMap);

            shader = new Shader(device, ShaderDefinitionUtils.createDefinition(device, {
                name: options.uniqueName,
                shaderLanguage: wgsl ? SHADERLANGUAGE_WGSL : SHADERLANGUAGE_GLSL,
                attributes: options.attributes,
                vertexCode: vertexCode,
                fragmentCode: fragmentCode,
                useTransformFeedback: options.useTransformFeedback,
                vertexIncludes: vertexIncludes,
                vertexDefines: options.vertexDefines,
                fragmentIncludes: fragmentIncludes,
                fragmentDefines: options.fragmentDefines,
                fragmentOutputTypes: options.fragmentOutputTypes
            }));
            programLibrary.setCachedShader(options.uniqueName, shader);
        }
        return shader;
    }

    /**
     * Create a map of defines used for shader generation for a material.
     *
     * @param {Material} material - The material to create the shader defines for.
     * @param {ShaderVariantParams} params - The shader variant parameters.
     * @returns {Map<string, string>} The map of shader defines.
     * @ignore
     */
    static getCoreDefines(material, params) {

        // merge both maps, with camera shader params taking precedence
        const defines = new Map(material.defines);
        params.cameraShaderParams.defines.forEach((value, key) => defines.set(key, value));

        // add pass defines
        const shaderPassInfo = ShaderPass.get(params.device).getByIndex(params.pass);
        shaderPassInfo.defines.forEach((value, key) => defines.set(key, value));

        return defines;
    }

    /**
     * Process shader using shader processing options, utilizing the cache of the ProgramLibrary.
     *
     * @param {Shader} shader - The shader to be processed.
     * @param {ShaderProcessorOptions} processingOptions - The shader processing options.
     * @returns {Shader} The processed shader.
     * @ignore
     */
    static processShader(shader, processingOptions) {

        Debug.assert(shader);
        const shaderDefinition = shader.definition;

        // 'shader' generator for a material - simply return existing shader definition. Use generator and getProgram
        // to allow for shader processing to be cached
        const name = shaderDefinition.name ?? 'shader';

        // unique name based of the shader id
        const key = `${name}-id-${shader.id}`;

        const materialGenerator = new ShaderGeneratorPassThrough(key, shaderDefinition);

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

    /**
     * Add defines required for correct screenDepthPS chunk functionality for the given camera
     * shader parameters.
     *
     * @param {GraphicsDevice} device - The graphics device.
     * @param {CameraShaderParams} cameraShaderParams - The camera shader parameters.
     * @ignore
     */
    static addScreenDepthChunkDefines(device, cameraShaderParams, defines) {
        if (cameraShaderParams.sceneDepthMapLinear) {
            defines.set('SCENE_DEPTHMAP_LINEAR', '');
        }
        if (device.textureFloatRenderable) {
            defines.set('SCENE_DEPTHMAP_FLOAT', '');
        }
    }
}

function createShader(device, vsName, fsName, useTransformFeedback = false, shaderDefinitionOptions = {}) {
    Debug.removed('pc.createShader has been removed deprecated. Use ShaderUtils.createShader instead.');
}

function createShaderFromCode(device, vsCode, fsCode, uniqueName, attributes, useTransformFeedback = false, shaderDefinitionOptions = {}) {

    Debug.deprecated('pc.createShaderFromCode has been deprecated. Use ShaderUtils.createShader instead.');

    // the function signature has changed, fail if called incorrectly
    Debug.assert(typeof attributes !== 'boolean');

    // Normalize arguments to allow passing shaderDefinitionOptions as the 6th argument
    if (typeof useTransformFeedback === 'boolean') {
        shaderDefinitionOptions.useTransformFeedback = useTransformFeedback;
    } else if (typeof useTransformFeedback === 'object') {
        shaderDefinitionOptions = {
            ...shaderDefinitionOptions,
            ...useTransformFeedback
        };
    }

    const programLibrary = getProgramLibrary(device);
    let shader = programLibrary.getCachedShader(uniqueName);
    if (!shader) {
        shader = new Shader(device, ShaderDefinitionUtils.createDefinition(device, {
            ...shaderDefinitionOptions,
            name: uniqueName,
            vertexCode: vsCode,
            fragmentCode: fsCode,
            attributes: attributes
        }));
        programLibrary.setCachedShader(uniqueName, shader);
    }
    return shader;
}

export { ShaderUtils, createShader, createShaderFromCode };
