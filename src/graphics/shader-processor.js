import { Debug } from '../core/debug.js';
import {
    BINDGROUP_MESH, uniformTypeToName, bindGroupNames, semanticToLocation,
    SHADERSTAGE_VERTEX, SHADERSTAGE_FRAGMENT
} from './constants.js';
import { UniformFormat, UniformBufferFormat } from './uniform-buffer-format.js';
import { UniformBuffer } from './uniform-buffer.js';
import { BindGroupFormat, BindBufferFormat, BindTextureFormat } from './bind-group-format.js';
import { BindGroup } from './bind-group.js';

/** @typedef {import('./bind-group-format.js').BindGroupFormat} BindGroupFormat */
/** @typedef {import('./shader-processor-options.js').ShaderProcessorOptions} ShaderProcessorOptions */
/** @typedef {import('./graphics-device.js').GraphicsDevice} GraphicsDevice */

// accepted keywords
const KEYWORD = /[ \t]*(\battribute\b|\bvarying\b|\bout\b|\buniform\b)/g;

// match 'attribute' and anything else till ';'
const KEYWORD_LINE = /(\battribute\b|\bvarying\b|\bout\b|\buniform\b)[ \t]*([^;]+)([;]+)/g;

// marker for a place in the source code to be replaced by code
const MARKER = '@@@';

// const textureTypes = [
//     'sampler2D'
// ];

/**
 * Pure static class implementing processing of GLSL shaders. It allocates
 * fixed locations for attributes, and handles conversion of uniforms to
 * uniform buffers.
 *
 * @ignore
 */
class ShaderProcessor {
    /**
     * Process the shader.
     *
     * @param {GraphicsDevice} device - The graphics device.
     * @param {object} shaderDefinition - The shader definition.
     * @returns {object} - The processed shader data.
     */
    static run(device, shaderDefinition) {

        /** @type {Map<string, number>} */
        const varyingMap = new Map();

        // extract lines of interests from both shaders
        const vertexExtracted = ShaderProcessor.extract(shaderDefinition.vshader, true);
        const fragmentExtracted = ShaderProcessor.extract(shaderDefinition.fshader, false);

        // VS - convert a list of attributes to a shader block with fixed locations
        const attributesBlock = ShaderProcessor.processAttributes(vertexExtracted.attributes, shaderDefinition.attributes);

        // VS - convert a list of varyings to a shader block
        const vertexVaryingsBlock = ShaderProcessor.processVaryings(vertexExtracted.varyings, varyingMap, true);

        // FS - convert a list of varyings to a shader block
        const fragmentVaryingsBlock = ShaderProcessor.processVaryings(fragmentExtracted.varyings, varyingMap, false);

        // FS - convert a list of outputs to a shader block
        const outBlock = ShaderProcessor.processOuts(fragmentExtracted.outs);

        // uniforms - merge vertex and fragment uniforms, and create shared uniform buffers
        const uniforms = vertexExtracted.uniforms.concat(fragmentExtracted.uniforms);
        const uniformsData = ShaderProcessor.processUniforms(device, uniforms, shaderDefinition.processingOptions);

        // VS - insert the blocks to the source
        const vBlock = attributesBlock + '\n' + vertexVaryingsBlock + '\n' + uniformsData.code;
        const vshader = vertexExtracted.src.replace(MARKER, vBlock);

        // FS - insert the blocks to the source
        const fBlock = fragmentVaryingsBlock + '\n' + outBlock + '\n' + uniformsData.code;
        const fshader = fragmentExtracted.src.replace(MARKER, fBlock);

        return {
            vshader: vshader,
            fshader: fshader,
            meshUniformBufferFormat: uniformsData.meshUniformBufferFormat,
            meshBindGroupFormat: uniformsData.meshBindGroupFormat
        };
    }

    // Extract required information from the shader source code.
    static extract(src, isVertex) {

        // collected data
        const attributes = [];
        const varyings = [];
        const outs = [];
        const uniforms = [];

        // replacement marker - mark a first replacement place, this is where code
        // blocks are injected later
        let replacement = `${MARKER}\n`;

        // extract relevant parts of the shader
        let match;
        while ((match = KEYWORD.exec(src)) !== null) {

            const keyword = match[1];
            switch (keyword) {
                case 'attribute':
                case 'varying':
                case 'uniform':
                case 'out': {

                    // read the line
                    KEYWORD_LINE.lastIndex = match.index;
                    const lineMatch = KEYWORD_LINE.exec(src);

                    if (keyword === 'attribute') {
                        attributes.push(lineMatch[2]);
                    } else if (keyword === 'varying') {
                        varyings.push(lineMatch[2]);
                    } else if (keyword === 'out') {
                        outs.push(lineMatch[2]);
                    } else if (keyword === 'uniform') {
                        uniforms.push(lineMatch[2]);
                    }

                    // cut it out
                    src = ShaderProcessor.cutOut(src, match.index, KEYWORD_LINE.lastIndex, replacement);
                    KEYWORD.lastIndex = match.index + replacement.length;

                    // only place a single replacement marker
                    replacement = '';
                    break;
                }
            }
        }

        return {
            src,
            attributes,
            varyings,
            outs,
            uniforms
        };
    }

    /**
     * @param {GraphicsDevice} device - The graphics device.
     * @param {Array<string>} uniformLines - Lines containing uniforms.
     * @param {ShaderProcessorOptions} processingOptions - Uniform formats.
     * @returns {object} - The uniform data.
     */
    static processUniforms(device, uniformLines, processingOptions) {

        const isSampler = (uniformType) => {
            return uniformType.indexOf('sampler') !== -1;
        };

        // split uniform lines into samplers and the rest
        const uniformLinesSamplers = [];
        const uniformLinesNonSamplers = [];
        uniformLines.forEach((line) => {
            const words = ShaderProcessor.splitToWords(line);
            const type = words[0];
            if (isSampler(type)) {
                uniformLinesSamplers.push(line);
            } else {
                uniformLinesNonSamplers.push(line);
            }
        });

        // build mesh uniform buffer format
        const meshUniforms = [];
        uniformLinesNonSamplers.forEach((line) => {
            const words = ShaderProcessor.splitToWords(line);
            const type = words[0];
            const name = words[1];

            // uniforms not already in supplied uniform buffers go to the mesh buffer
            if (!processingOptions.hasUniform(name)) {
                const uniformType = uniformTypeToName.indexOf(type);
                Debug.assert(uniformType >= 0, `Uniform type ${type} is not recognized on line [${line}]`);
                const uniform = new UniformFormat(name, uniformType);
                meshUniforms.push(uniform);
            }

            // validate types in else

        });
        const meshUniformBufferFormat = meshUniforms.length ? new UniformBufferFormat(meshUniforms) : null;

        // build mesh bind group format - start with uniform buffer
        const bufferFormats = [];
        if (meshUniformBufferFormat) {
            // TODO: we could optimize visibility to only stages that use any of the data
            bufferFormats.push(new BindBufferFormat('mesh', SHADERSTAGE_VERTEX | SHADERSTAGE_FRAGMENT));
        }

        // add textures uniforms
        const textureFormats = [];
        uniformLinesSamplers.forEach((line) => {
            const words = ShaderProcessor.splitToWords(line);
            const name = words[1];

            // unmached texture uniforms go to mesh block
            if (!processingOptions.hasTexture(name)) {

                // TODO: we could optimize visibility to only stages that use any of the data
                textureFormats.push(new BindTextureFormat(name, SHADERSTAGE_VERTEX | SHADERSTAGE_FRAGMENT));
            }

            // validate types in else

        });
        const meshBindGroupFormat = new BindGroupFormat(device, bufferFormats, textureFormats);

        // generate code for uniform buffers
        let code = '';
        processingOptions.uniformFormats.forEach((format, bindGroupIndex) => {
            if (format) {
                code += format.getShaderDeclaration(bindGroupIndex, 0);
            }
        });

        // and also for generated mesh format, which is at the slot 0 of the bind group
        code += meshUniformBufferFormat.getShaderDeclaration(BINDGROUP_MESH, 0);

        // generate code for textures
        processingOptions.bindGroupFormats.forEach((format, bindGroupIndex) => {
            if (format) {
                code += format.getShaderDeclarationTextures(bindGroupIndex);
            }
        });

        // and also for generated mesh format
        code += meshBindGroupFormat.getShaderDeclarationTextures(BINDGROUP_MESH);

        return {
            code,
            meshUniformBufferFormat,
            meshBindGroupFormat
        };
    }

    static processVaryings(varyingLines, varyingMap, isVertex) {
        let block = '';
        const op = isVertex ? 'out' : 'in';
        varyingLines.forEach((line, index) => {
            const words = ShaderProcessor.splitToWords(line);
            const type = words[0];
            const name = words[1];

            if (isVertex) {
                // store it in the map
                varyingMap.set(name, index);
            } else {
                Debug.assert(varyingMap.has(name), `Fragment shader requires varying ${name} but vertex shader does not generate it.`);
                index = varyingMap.get(name);
            }

            // generates: 'layout(location = 0) in vec4 position;'
            block += `layout(location = ${index}) ${op} ${type} ${name};\n`;
        });
        return block;
    }

    static processOuts(outsLines) {
        let block = '';
        outsLines.forEach((line, index) => {
            // generates: 'layout(location = 0) out vec4 gl_FragColor;'
            block += `layout(location = ${index}) out ${line};\n`;
        });
        return block;
    }

    static processAttributes(attributeLines, shaderDefinitionAttributes) {
        let block = '';
        const usedLocations = {};
        attributeLines.forEach((line) => {
            const words = ShaderProcessor.splitToWords(line);
            const type = words[0];
            const name = words[1];

            if (shaderDefinitionAttributes.hasOwnProperty(name)) {
                const semantic = shaderDefinitionAttributes[name];
                const location = semanticToLocation[semantic];

                Debug.assert(!usedLocations.hasOwnProperty(location),
                             `WARNING: Two vertex attribues are mapped to the same location in a shader: ${usedLocations[location]} and ${semantic}`);
                usedLocations[location] = semantic;

                // generates: 'layout(location = 0) in vec4 position;'
                block += `layout(location = ${location}) in ${type} ${name};\n`;
            }
        });
        return block;
    }

    static splitToWords(line) {
        // remove any double spaces
        line = line.replace(/\s+/g, ' ').trim();
        return line.split(' ');
    }

    static cutOut(src, start, end, replacement) {
        return src.substring(0, start) + replacement + src.substring(end);
    }
}

export { ShaderProcessor };
