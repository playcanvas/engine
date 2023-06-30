import { hashCode } from '../../../core/hash.js';
import { ChunkBuilder } from '../chunk-builder.js';
import { LitShader } from './lit-shader.js';
import lit from './lit.js';

const custom  = {

    /** @type { Function } */
    generateKey: function (options) {

        let key = "custom";

        const props = lit.buildPropertiesList(options);

        key += lit.propertiesKey(props);

        if (options.chunks) {
            key += lit.chunksKey(options.chunks);
        }

        if (options.litOptions) {
            key += lit.litOptionsKey(options.litOptions);
        }

        key += options.customLitArguments;

        return hashCode(key);
    },

    /**
     * @param {import('../../../platform/graphics/graphics-device.js').GraphicsDevice} device - The
     * graphics device.
     * @param {object} options - The lit options to be passed to the backend.
     * @returns {object} Returns the created shader definition.
     * @ignore
     */
    createShaderDefinition: function (device, options) {
        const litShader = new LitShader(device, options.litOptions);

        const decl = new ChunkBuilder();
        const code = new ChunkBuilder();
        const func = new ChunkBuilder();

        // global texture bias for standard textures
        decl.append(`uniform float textureBias;`);

        decl.append(litShader.chunks.litShaderArgsPS);
        code.append(options.customLitArguments);
        func.code = `LitShaderArguments litShaderArgs = evaluateFrontend();`;

        func.code = `\n${func.code.split('\n').map(l => `    ${l}`).join('\n')}\n\n`;
        const useUv = [];
        const useUnmodifiedUv = [];
        const mapTransforms = [];
        litShader.generateVertexShader(useUv, useUnmodifiedUv, mapTransforms);
        litShader.generateFragmentShader(decl.code, code.code, func.code, "vUv0");

        return litShader.getDefinition();
    }
};

export { custom };
