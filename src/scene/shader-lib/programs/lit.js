import { ChunkBuilder } from '../chunk-builder.js';
import { LitShader } from './lit-shader.js';
import { LitOptionsUtils } from './lit-options-utils.js';
import { ShaderGenerator } from './shader-generator.js';

/**
 * @import { GraphicsDevice } from '../../../platform/graphics/graphics-device.js'
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
     * @param {object} options - The options to be passed to the backend.
     * @returns {object} Returns the created shader definition.
     */
    createShaderDefinition(device, options) {
        const litShader = new LitShader(device, options.litOptions);

        const decl = new ChunkBuilder();
        const code = new ChunkBuilder();
        const func = new ChunkBuilder();

        // global texture bias for standard textures
        decl.append('uniform float textureBias;');

        decl.append(litShader.chunks.litShaderArgsPS);
        code.append(options.shaderChunk);
        func.code = 'evaluateFrontend();';

        func.code = `\n${func.code.split('\n').map(l => `    ${l}`).join('\n')}\n\n`;
        const usedUvSets = options.usedUvs || [true];
        const mapTransforms = [];
        litShader.generateVertexShader(usedUvSets, usedUvSets, mapTransforms);
        litShader.generateFragmentShader(decl.code, code.code, func.code, 'vUv0');

        return litShader.getDefinition(options);
    }
}

const lit = new ShaderGeneratorLit();

export { lit };
