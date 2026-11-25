import { Debug } from '../../../core/debug.js';
import { bindGroupNames, uniformTypeToName } from '../constants.js';

/**
 * @import { GraphicsDevice } from '../graphics-device.js'
 * @import { Shader } from '../shader.js'
 * @import { ShaderProcessorOptions } from '../shader-processor-options.js'
 * @import { UniformBufferFormat } from '../uniform-buffer-format.js'
 */

// match the 'uniform' keyword
const KEYWORD = /[ \t]*\buniform\b/g;

// match 'uniform' and anything else till ';' - group 1 is the uniform declaration without the keyword
// eslint-disable-next-line regexp/no-super-linear-backtracking
const KEYWORD_LINE = /\buniform\b[ \t]*([^;]+);+/g;

// an array identifier, for example 'data[4]' - group 1 is 'data', group 2 is everything in brackets: '4'
const ARRAY_IDENTIFIER = /([\w-]+)\[(.*?)\]/;

const precisionQualifiers = new Set(['highp', 'mediump', 'lowp']);

// marker for the place in the source code where the generated uniform code is injected
const MARKER = '@@@';

/**
 * A parsed uniform declaration line.
 *
 * @ignore
 */
class UniformLine {
    constructor(line, shader) {

        // example: `lowp vec4 tints[2 * 4]`
        this.line = line;

        // split to words handling any number of spaces
        const words = line.trim().split(/\s+/);

        // optional precision
        if (precisionQualifiers.has(words[0])) {
            this.precision = words.shift();
        }

        // type
        this.type = words.shift();

        if (line.includes(',')) {
            Debug.error(`A comma on a uniform line is not supported, split it into multiple uniforms: ${line}`, shader);
        }

        // array of uniforms
        if (line.includes('[')) {

            const rest = words.join(' ');
            const match = ARRAY_IDENTIFIER.exec(rest);
            Debug.assert(match);

            this.name = match[1];
            this.arraySize = Number(match[2]);
            if (isNaN(this.arraySize)) {
                shader.failed = true;
                Debug.error(`Only numerically specified uniform array sizes are supported, this uniform is not supported: '${line}'`, shader);
            }

        } else {

            // simple uniform
            this.name = words.shift();
            this.arraySize = 0;
        }

        Debug.call(() => {
            if (this.name === 'uScreenSize') {
                Debug.deprecated('Shader uniform uScreenSize is deprecated. Use screen_size instead.');
            }
        });

        this.isSampler = this.type.indexOf('sampler') !== -1;
    }
}

/**
 * A WebGL2 GLSL shader processor. It performs limited-scope processing: it extracts only the
 * uniform declarations, replaces the view and material level uniforms with std140 uniform blocks
 * (valid GLSL ES 3.00) and re-emits all other uniforms individually. Attributes, varyings, outputs
 * and textures are left untouched - they are handled by the gles3 compatibility macros and the
 * per-uniform commit path.
 *
 * @ignore
 */
class WebglShaderProcessorGLSL {
    /**
     * @param {GraphicsDevice} device - The graphics device.
     * @param {object} shaderDefinition - The shader definition.
     * @param {Shader} shader - The shader.
     * @returns {{ vshader: string, fshader: string }} The processed shader sources.
     */
    static run(device, shaderDefinition, shader) {

        // extract only the uniform lines, leaving attributes / varyings / outs in the source for
        // the gles3 compatibility macros to handle
        const vertexExtracted = WebglShaderProcessorGLSL.extract(shaderDefinition.vshader);
        const fragmentExtracted = WebglShaderProcessorGLSL.extract(shaderDefinition.fshader);

        // merge and de-duplicate uniforms declared in either stage
        const concatUniforms = vertexExtracted.uniforms.concat(fragmentExtracted.uniforms);
        const uniforms = Array.from(new Set(concatUniforms));
        const parsedUniforms = uniforms.map(line => new UniformLine(line, shader));

        // generate the uniform code - the same block is injected into both stages, as required for
        // a shared uniform buffer
        const code = WebglShaderProcessorGLSL.processUniformsGL2(parsedUniforms, shaderDefinition.processingOptions);

        // inject at the marker (present only in a stage that declared at least one uniform)
        const vshader = vertexExtracted.src.replace(MARKER, code);
        const fshader = fragmentExtracted.src.replace(MARKER, code);

        return { vshader, fshader };
    }

    /**
     * Extract the uniform lines from the shader source code. The first uniform line is replaced by
     * a marker, where the generated uniform code is injected later, and the others are removed.
     *
     * @param {string} src - The shader source code.
     * @returns {{ src: string, uniforms: string[] }} The source code with the uniform lines cut out,
     * and the uniform declarations without the 'uniform' keyword.
     */
    static extract(src) {

        const uniforms = [];

        // replacement marker - only placed at the first uniform line
        let replacement = `${MARKER}\n`;

        let match;
        KEYWORD.lastIndex = 0;
        while ((match = KEYWORD.exec(src)) !== null) {

            // read the line
            KEYWORD_LINE.lastIndex = match.index;
            const lineMatch = KEYWORD_LINE.exec(src);
            uniforms.push(lineMatch[1]);

            // cut it out
            src = src.substring(0, match.index) + replacement + src.substring(KEYWORD_LINE.lastIndex);
            KEYWORD.lastIndex = match.index + replacement.length;
            replacement = '';
        }

        return { src, uniforms };
    }

    /**
     * Generate the uniform code for a WebGL2 shader: a single std140 view uniform block plus all
     * non-view uniforms re-emitted as individual uniforms (which keep their per-uniform commit path).
     *
     * @param {Array<UniformLine>} uniforms - The parsed uniform lines.
     * @param {ShaderProcessorOptions} processingOptions - The shader processing options.
     * @returns {string} The generated GLSL.
     */
    static processUniformsGL2(uniforms, processingOptions) {

        let code = '';

        // a uniform block per supplied format (view, material) - generated from the full format, so
        // its std140 layout matches the uniform buffer bound at that bind group index
        processingOptions.uniformFormats.forEach((format, bindGroupIndex) => {
            if (format) {
                code += WebglShaderProcessorGLSL.getUniformShaderDeclarationGL2(format, bindGroupIndex);
            }
        });

        // re-emit all uniforms not provided by a block (numeric and samplers) as individual uniforms
        uniforms.forEach((uniform) => {
            if (!processingOptions.hasUniform(uniform.name)) {
                if (!uniform.isSampler) processingOptions.debugCheckMeshUniform(uniform.name);
                code += `uniform ${uniform.line};\n`;
            }
        });

        return code;
    }

    /**
     * Generate a WebGL2 std140 uniform block declaration. It emits no `set` / `binding` layout
     * qualifiers - the block is linked to its binding point at runtime by WebglShader via
     * `gl.uniformBlockBinding`.
     *
     * @param {UniformBufferFormat} format - The uniform buffer format.
     * @param {number} bindGroup - The bind group index, used to name the block `ub_<bindGroupName>`.
     * @returns {string} The block declaration.
     */
    static getUniformShaderDeclarationGL2(format, bindGroup) {
        const name = bindGroupNames[bindGroup];
        let code = `layout(std140) uniform ub_${name} {\n`;

        format.uniforms.forEach((uniform) => {
            const typeString = uniformTypeToName[uniform.type];
            Debug.assert(typeString.length > 0, `Uniform type ${uniform.type} is not handled.`);
            code += `    ${typeString} ${uniform.shortName}${uniform.count ? `[${uniform.count}]` : ''};\n`;
        });

        return `${code}};\n`;
    }
}

export { WebglShaderProcessorGLSL };
