import { ChunkBuilder } from '../chunk-builder.js';
import { LitShader } from './lit-shader.js';
import { LitOptionsUtils } from './lit-options-utils.js';
import { ShaderGenerator } from './shader-generator.js';
import { SHADERLANGUAGE_GLSL, SHADERTAG_MATERIAL } from '../../../platform/graphics/constants.js';
import { ShaderUtils } from '../../../platform/graphics/shader-utils.js';

/**
 * @import { GraphicsDevice } from '../../../platform/graphics/graphics-device.js'
 * @import { LitMaterialOptions } from '../../materials/lit-material-options.js'
 */

const dummyUvs = [0, 1, 2, 3, 4, 5, 6, 7];

class ShaderGeneratorLit extends ShaderGenerator {
    generateKey(options) {
        const definesHash = ShaderGenerator.definesHash(options.defines);
        const key = `lit_${definesHash}_${
            dummyUvs.map((dummy, index) => {
                return options.usedUvs[index] ? '1' : '0';
            }).join('')
        }${options.shaderChunk
        }${LitOptionsUtils.generateKey(options.litOptions)}`;

        return key;
    }

    /**
     * @param {GraphicsDevice} device - The graphics device.
     * @param {LitMaterialOptions} options - The options to be passed to the backend.
     * @returns {object} Returns the created shader definition.
     */
    createShaderDefinition(device, options) {
        const litShader = new LitShader(device, options.litOptions);

        const decl = new ChunkBuilder();
        const code = new ChunkBuilder();

        // global texture bias for standard textures
        decl.append('uniform float textureBias;');

        decl.append(litShader.chunks.litShaderArgsPS);
        code.append(options.shaderChunk);

        const definitionOptions = {
            name: 'LitShader',
            shaderLanguage: SHADERLANGUAGE_GLSL,
            tag: litShader.shaderPassInfo.isForward ? SHADERTAG_MATERIAL : undefined
        };

        const usedUvSets = options.usedUvs || [true];
        const mapTransforms = [];
        litShader.generateVertexShader(usedUvSets, usedUvSets, mapTransforms);

        litShader.generateFragmentShader(decl.code, code.code, 'vUv0');

        const includes = new Map(Object.entries({
            ...Object.getPrototypeOf(litShader.chunks), // the prototype stores the default chunks
            ...litShader.chunks,  // user overrides are supplied as instance properties
            ...options.litOptions.chunks
        }));

        const vDefines = litShader.vDefines;
        options.defines.forEach((value, key) => vDefines.set(key, value));

        const fDefines = litShader.fDefines;
        options.defines.forEach((value, key) => fDefines.set(key, value));

        definitionOptions.attributes = litShader.attributes;
        definitionOptions.vertexCode = litShader.vshader;
        definitionOptions.vertexIncludes = includes;
        definitionOptions.vertexDefines = vDefines;
        definitionOptions.fragmentCode = litShader.fshader;
        definitionOptions.fragmentIncludes = includes;
        definitionOptions.fragmentDefines = fDefines;

        return ShaderUtils.createDefinition(device, definitionOptions);
    }
}

const lit = new ShaderGeneratorLit();

export { lit };
