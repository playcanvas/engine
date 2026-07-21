import { Debug } from '../../../core/debug.js';
import { BINDGROUP_VIEW, bindGroupNames, uniformTypeToName } from '../constants.js';
import { ShaderProcessorGLSL } from '../shader-processor-glsl.js';

/**
 * @import { GraphicsDevice } from '../graphics-device.js'
 * @import { Shader } from '../shader.js'
 * @import { ShaderProcessorOptions } from '../shader-processor-options.js'
 * @import { UniformBufferFormat } from '../uniform-buffer-format.js'
 * @import { UniformLine } from '../shader-processor-glsl.js'
 */

/**
 * A WebGL2-specific GLSL shader processor. Unlike the base {@link ShaderProcessorGLSL#run} - which
 * targets the WebGPU transpile path and emits Vulkan-flavored GLSL (separate texture/sampler,
 * `layout(set=, binding=)`, explicit varying locations) - this performs limited-scope processing:
 * it extracts only the standalone view-level uniform declarations and replaces them with a single
 * std140 `ub_view` block (valid GLSL ES 3.00). Attributes, varyings, outputs, textures and all
 * non-view (mesh / material / custom) uniforms are left untouched - they are handled by the gles3
 * compatibility macros and the per-uniform commit path.
 *
 * @ignore
 */
class WebglShaderProcessorGLSL extends ShaderProcessorGLSL {
    /**
     * @param {GraphicsDevice} device - The graphics device.
     * @param {object} shaderDefinition - The shader definition.
     * @param {Shader} shader - The shader.
     * @returns {{ vshader: string, fshader: string }} The processed shader sources.
     */
    static run(device, shaderDefinition, shader) {

        // extract only the uniform lines, leaving attributes / varyings / outs in the source for
        // the gles3 compatibility macros to handle
        const vertexExtracted = WebglShaderProcessorGLSL.extract(shaderDefinition.vshader, true);
        const fragmentExtracted = WebglShaderProcessorGLSL.extract(shaderDefinition.fshader, true);

        // merge and de-duplicate uniforms declared in either stage
        const concatUniforms = vertexExtracted.uniforms.concat(fragmentExtracted.uniforms);
        const uniforms = Array.from(new Set(concatUniforms));
        const parsedUniforms = WebglShaderProcessorGLSL.parseUniformLines(uniforms, shader);

        // generate the uniform code - the same block is injected into both stages, as required for
        // a shared uniform buffer
        const code = WebglShaderProcessorGLSL.processUniformsGL2(parsedUniforms, shaderDefinition.processingOptions);

        // inject at the marker (present only in a stage that declared at least one uniform)
        const vshader = vertexExtracted.src.replace(ShaderProcessorGLSL.MARKER, code);
        const fshader = fragmentExtracted.src.replace(ShaderProcessorGLSL.MARKER, code);

        return { vshader, fshader };
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

        // view uniform buffer block - generated from the full view format, so its std140 layout
        // matches the uniform buffer the renderer uploads
        const viewFormat = processingOptions.uniformFormats[BINDGROUP_VIEW];
        if (viewFormat) {
            code += WebglShaderProcessorGLSL.getUniformShaderDeclarationGL2(viewFormat, BINDGROUP_VIEW);
        }

        // re-emit all non-view uniforms (numeric and samplers) as individual uniforms
        uniforms.forEach((uniform) => {
            if (!processingOptions.hasUniform(uniform.name)) {
                code += `uniform ${uniform.line};\n`;
            }
        });

        return code;
    }

    /**
     * Generate a WebGL2 std140 uniform block declaration. Unlike the base
     * {@link ShaderProcessorGLSL#getUniformShaderDeclaration} it emits no `set` / `binding` layout
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
