import { ShaderProcessorOptions } from '../../platform/graphics/shader-processor-options.js';
import { getProgramLibrary } from '../shader-lib/get-program-library.js';
import { shaderGeneratorShader } from '../shader-lib/programs/shader-generator-shader.js';
import { Material } from './material.js';

/**
 * @typedef {object} ShaderDesc - The description of the shader used by the {@link ShaderMaterial}.
 * @property {string} uniqueName - Unique name for the shader. If a shader with this name already
 * exists, it will be returned instead of a new shader instance.
 * @property {string} [vertexCode] - The vertex shader code.
 * @property {string} [fragmentCode] - The fragment shader code.
 * @property {Object<string, string>} [attributes] - Object detailing the mapping of vertex shader
 * attribute names to semantics SEMANTIC_*. This enables the engine to match vertex buffer data as
 * inputs to the shader. Defaults to undefined, which generates the default attributes.
 * @param {string | string[]} [fragmentOutputTypes] - Fragment shader output types, which default to
 * vec4. Passing a string will set the output type for all color attachments. Passing an array will
 * set the output type for each color attachment. @see ShaderUtils.createDefinition
 */

/**
 * A ShaderMaterial is a type of material that utilizes a specified shader for rendering purposes.
 *
 * A simple example which creates a material with custom vertex and fragment shaders:
 *
 * ```javascript
 * const material = new pc.ShaderMaterial({
 *     uniqueName: 'MyShader',
 *     attributes: { aPosition: pc.SEMANTIC_POSITION },
 *     vertexCode: `
 *         attribute vec3 aPosition;
 *         uniform mat4 matrix_viewProjection;
 *         void main(void)
 *         {
 *             gl_Position = matrix_viewProjection * pos;
 *         }`,
 *     fragmentCode: `
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

        // shallow clone the object
        this._shaderDesc = value ? { ...value } : undefined;
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

    getShaderVariant(device, scene, objDefs, renderParams, pass, sortedLights, viewUniformFormat, viewBindGroupFormat, vertexFormat) {

        const options = {
            pass: pass,
            gamma: renderParams.shaderOutputGamma,
            toneMapping: renderParams.toneMapping,
            shaderDesc: this.shaderDesc
        };

        const processingOptions = new ShaderProcessorOptions(viewUniformFormat, viewBindGroupFormat, vertexFormat);

        const library = getProgramLibrary(device);
        library.register('shader-material', shaderGeneratorShader);

        return library.getProgram('shader-material', options, processingOptions, this.userId);
    }
}

export { ShaderMaterial };
