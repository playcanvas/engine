import { LitShader } from './lit-shader.js';
import { LitOptionsUtils } from './lit-options-utils.js';
import { ShaderGenerator } from './shader-generator.js';
import { SHADERLANGUAGE_GLSL, SHADERLANGUAGE_WGSL, SHADERTAG_MATERIAL } from '../../../platform/graphics/constants.js';
import { ShaderUtils } from '../../../platform/graphics/shader-utils.js';
import { hashCode } from '../../../core/hash.js';

/**
 * @import { GraphicsDevice } from '../../../platform/graphics/graphics-device.js'
 * @import { LitMaterialOptions } from '../../materials/lit-material-options.js'
 */

const dummyUvs = [0, 1, 2, 3, 4, 5, 6, 7];

class ShaderGeneratorLit extends ShaderGenerator {
    generateKey(options) {
        const definesHash = ShaderGenerator.definesHash(options.defines);
        const glslHash = hashCode(options.shaderChunkGLSL ?? '');
        const wgslHash = hashCode(options.shaderChunkWGSL ?? '');
        const loHash = LitOptionsUtils.generateKey(options.litOptions);
        const uvOptions = `${dummyUvs.map((dummy, index) => {
            return options.usedUvs[index] ? '1' : '0';
        }).join('')}`;

        return `lit_${definesHash}_${uvOptions}_${glslHash}_${wgslHash}_${loHash}`;
    }

    /**
     * @param {GraphicsDevice} device - The graphics device.
     * @param {LitMaterialOptions} options - The options to be passed to the backend.
     * @returns {object} Returns the created shader definition.
     */
    createShaderDefinition(device, options) {
        const wgsl = device.isWebGPU && options.shaderChunkWGSL;
        const shaderLanguage = wgsl ? SHADERLANGUAGE_WGSL : SHADERLANGUAGE_GLSL;
        const litShader = new LitShader(device, options.litOptions, shaderLanguage);

        const definitionOptions = {
            name: 'LitShader',
            shaderLanguage: shaderLanguage,
            tag: litShader.shaderPassInfo.isForward ? SHADERTAG_MATERIAL : undefined
        };

        const usedUvSets = options.usedUvs || [true];
        const mapTransforms = [];
        litShader.generateVertexShader(usedUvSets, usedUvSets, mapTransforms);

        litShader.generateFragmentShader('', wgsl ? options.shaderChunkWGSL : options.shaderChunkGLSL, 'vUv0');

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
