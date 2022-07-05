import { Debug } from '../core/debug.js';
import { BINDGROUP_MESH, bindGroupNames, semanticToLocation } from './constants.js';

/** @typedef {import('./bind-group-format.js').BindGroupFormat} BindGroupFormat */
/** @typedef {import('./shader-processor-options.js').ShaderProcessorOptions} ShaderProcessorOptions */

// accepted keywords
const KEYWORD = /[ \t]*(\battribute\b|\bvarying\b|\bout\b|\buniform\b)/g;

// match 'attribute' and anything else till ';'
const KEYWORD_LINE = /(\battribute\b|\bvarying\b|\bout\b|\buniform\b)[ \t]*([^;]+)([;]+)/g;

// marker for a place in the source code to be replaced by code
const MARKER = '@@@';

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
     * @param {object} shaderDefinition - The shader definition.
     * @returns {object} - The processed shader data.
     */
    static run(shaderDefinition) {

        /** @type {Map<string, number>} */
        const varyingMap = new Map();
        const vshader = ShaderProcessor.vertex(shaderDefinition.vshader, shaderDefinition, varyingMap);
        const fshader = ShaderProcessor.fragment(shaderDefinition.fshader, varyingMap);

        // TODO: we could create a uniform buffer format for the mesh here

        return {
            vshader,
            fshader
        };
    }

    static vertex(src, shaderDefinition, varyingMap) {

        const extracted = ShaderProcessor.extract(src, true);
        src = extracted.src;

        // convert a list of attributes to a shader block with fixed locations
        const attributesBlock = ShaderProcessor.processAttributes(extracted.attributes, shaderDefinition.attributes);

        // convert a list of varyings to a shader block
        const varyingsBlock = ShaderProcessor.processVaryings(extracted.varyings, varyingMap, true);

        // convert a list of uniforms to a uniforms block
        const uniformsBlock = ShaderProcessor.processUniforms(extracted.uniforms, shaderDefinition.processingOptions);

        // insert the blocks to the source
        return src.replace(MARKER, attributesBlock + '\n' + varyingsBlock + '\n' + uniformsBlock);
    }

    static fragment(src, varyingMap) {

        const extracted = ShaderProcessor.extract(src, false);
        src = extracted.src;

        // convert a list of varyings to a shader block
        const varyingsBlock = ShaderProcessor.processVaryings(extracted.varyings, varyingMap, false);

        // convert a list of outputs to a shader block
        const outBlock = ShaderProcessor.processOuts(extracted.outs);

        // insert the blocks to the source
        return src.replace(MARKER, varyingsBlock + '\n' + outBlock);
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

                    // TODO: ignore fragment shader uniforms for now
                    if (keyword === 'uniform' && !isVertex)
                        break;

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

    static generateUniformBuffer(uniforms, name, set, binding) {
        // format: layout(set = 0, binding = 0, std140) uniform UniformsView {
        return `layout(set = ${set}, binding = ${binding}, std140) uniform ${name} {\n` +
            uniforms +
            '};\n';
    }

    /**
     * @param {Array<string>} uniformLines - Lines containing uniforms.
     * @param {ShaderProcessorOptions} processingOptions - Uniform formats.
     * @returns {string} - The code block with the uniform buffers.
     */
    static processUniforms(uniformLines, processingOptions) {
        const uniformBlocks = [];

        uniformLines.forEach((line) => {
            const words = ShaderProcessor.splitToWords(line);
            const type = words[0];
            const name = words[1];

            const generatedLine = `    ${type} ${name};`;
            let index = processingOptions.has(name);

            // unmatched uniform goes to mesh block
            if (index < 0) {
                index = BINDGROUP_MESH;
            }

            // add it to appropriate block
            if (index >= 0) {
                if (!uniformBlocks[index]) {
                    uniformBlocks[index] = '';
                }
                uniformBlocks[index] += generatedLine + '\n';
            }

        });

        // TODO: this nedes to be implemented for textures
        const binding = 0;

        // add up all blocks together
        let code = '';
        for (let i = 0; i < uniformBlocks.length; i++) {
            code  += ShaderProcessor.generateUniformBuffer(uniformBlocks[i], `Uniforms_${bindGroupNames[i]}`, i, binding);
            code  += '\n';
        }

        return code;
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
