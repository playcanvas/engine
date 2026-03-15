import { Debug } from '../../core/debug.js';
import { SHADERLANGUAGE_GLSL, SHADERLANGUAGE_WGSL } from '../../platform/graphics/constants.js';
import { ShaderProcessorOptions } from '../../platform/graphics/shader-processor-options.js';
import { SHADERDEF_INSTANCING, SHADERDEF_MORPH_NORMAL, SHADERDEF_MORPH_POSITION, SHADERDEF_MORPH_TEXTURE_BASED_INT, SHADERDEF_SKIN } from '../constants.js';
import { getProgramLibrary } from '../shader-lib/get-program-library.js';
import { shaderGeneratorShader } from '../shader-lib/programs/shader-generator-shader.js';
import { ShaderUtils } from '../shader-lib/shader-utils.js';
import { Material } from './material.js';

/**
 * @typedef {object} ShaderDesc - Defines the vertex and fragment shader source for
 * {@link ShaderMaterial}, supporting both GLSL and WGSL formats. WebGL always uses the GLSL code.
 * WebGPU prefers the WGSL code if available, otherwise it automatically transpiles the provided
 * GLSL code at runtime.
 * @property {string} uniqueName - Unique name for the shader. If a shader with this name already
 * exists, it will be returned instead of a new shader instance.
 * @property {string} [vertexGLSL] - The vertex shader code in GLSL.
 * @property {string} [fragmentGLSL] - The fragment shader code in GLSL.
 * @property {string} [vertexWGSL] - The vertex shader code in WGSL.
 * @property {string} [fragmentWGSL] - The fragment shader code in WGSL.
 * @property {Object<string, string>} [attributes] - Object detailing the mapping of vertex shader
 * attribute names to semantics SEMANTIC_*. This enables the engine to match vertex buffer data as
 * inputs to the shader. Defaults to undefined, which generates the default attributes.
 * @property {string | string[]} [fragmentOutputTypes] - Fragment shader output types, which default to
 * vec4. Passing a string will set the output type for all color attachments. Passing an array will
 * set the output type for each color attachment. @see ShaderDefinitionUtils.createDefinition
 */

/**
 * A ShaderMaterial is a type of material that utilizes a specified shader for rendering purposes.
 *
 * A simple example which creates a material with custom vertex and fragment shaders specified in
 * GLSL format:
 *
 * ```javascript
 * const material = new pc.ShaderMaterial({
 *     uniqueName: 'MyShader',
 *     attributes: { aPosition: pc.SEMANTIC_POSITION },
 *     vertexGLSL: `
 *         attribute vec3 aPosition;
 *         uniform mat4 matrix_viewProjection;
 *         void main(void)
 *         {
 *             gl_Position = matrix_viewProjection * pos;
 *         }`,
 *     fragmentGLSL: `
 *         void main(void) {
 *             gl_FragColor = vec4(1.0, 0.0, 0.0, 1.0);
 *         }`
 * });
 * ```
 *
 * @category Graphics
 */
class ShaderMaterial extends Material {
    /**
     * @type {ShaderDesc|undefined}
     * @private
     */
    _shaderDesc;

    /**
     * Create a new ShaderMaterial instance.
     *
     * @param {ShaderDesc} [shaderDesc] - The description of the shader to be used by the material.
     */
    constructor(shaderDesc) {
        super();

        this.shaderDesc = shaderDesc;
    }

    /**
     * Sets the shader description.
     *
     * @type {ShaderDesc|undefined}
     */
    set shaderDesc(value) {
        this._shaderDesc = undefined;
        if (value) {

            // clone the object - only supported properties
            this._shaderDesc = {
                uniqueName: value.uniqueName,
                attributes: value.attributes,
                fragmentOutputTypes: value.fragmentOutputTypes,
                vertexGLSL: value.vertexGLSL,
                fragmentGLSL: value.fragmentGLSL,
                vertexWGSL: value.vertexWGSL,
                fragmentWGSL: value.fragmentWGSL
            };

            // backward compatibility - convert old properties to new
            if (value.vertexCode || value.fragmentCode || value.shaderLanguage) {
                Debug.deprecated(`ShaderMaterial [${value.uniqueName}]: vertexCode, fragmentCode and shaderLanguage properties of ShaderDesc is deprecated. Use vertexGLSL, fragmentGLSL, vertexWGSL or fragmentWGSL instead.`);
                const language = value.shaderLanguage ?? SHADERLANGUAGE_GLSL;
                if (language === SHADERLANGUAGE_GLSL) {
                    this._shaderDesc.vertexGLSL = value.vertexCode;
                    this._shaderDesc.fragmentGLSL = value.fragmentCode;
                } else if (language === SHADERLANGUAGE_WGSL) {
                    this._shaderDesc.vertexWGSL = value.vertexCode;
                    this._shaderDesc.fragmentWGSL = value.fragmentCode;
                }
            }
        }

        this.clearVariants();
    }

    /**
     * Gets the shader description.
     *
     * @type {ShaderDesc|undefined}
     */
    get shaderDesc() {
        return this._shaderDesc;
    }

    /**
     * Copy a `ShaderMaterial`.
     *
     * @param {ShaderMaterial} source - The material to copy from.
     * @returns {ShaderMaterial} The destination material.
     */
    copy(source) {
        super.copy(source);
        this.shaderDesc = source.shaderDesc;
        return this;
    }

    getShaderVariant(params) {

        const { objDefs } = params;
        const options = {
            defines: ShaderUtils.getCoreDefines(this, params),
            skin: (objDefs & SHADERDEF_SKIN) !== 0,
            useInstancing: (objDefs & SHADERDEF_INSTANCING) !== 0,
            useMorphPosition: (objDefs & SHADERDEF_MORPH_POSITION) !== 0,
            useMorphNormal: (objDefs & SHADERDEF_MORPH_NORMAL) !== 0,
            useMorphTextureBasedInt: (objDefs & SHADERDEF_MORPH_TEXTURE_BASED_INT) !== 0,

            pass: params.pass,
            gamma: params.cameraShaderParams.shaderOutputGamma,
            toneMapping: params.cameraShaderParams.toneMapping,
            fog: params.cameraShaderParams.fog,
            shaderDesc: this.shaderDesc,
            shaderChunks: this.shaderChunks // override chunks from the material
        };

        const processingOptions = new ShaderProcessorOptions(params.viewUniformFormat, params.viewBindGroupFormat, params.vertexFormat);

        const library = getProgramLibrary(params.device);
        library.register('shader-material', shaderGeneratorShader);

        return library.getProgram('shader-material', options, processingOptions, this.userId);
    }
}

export { ShaderMaterial };
