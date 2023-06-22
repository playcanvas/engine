import { LIGHTTYPE_DIRECTIONAL } from '../../../scene/constants.js';
import { hashCode } from '../../../core/hash.js';
import { ChunkBuilder } from '../chunk-builder.js';
import { LitShader } from './lit-shader.js';

const custom  = {

    /** @type { Function } */
    generateKey: function (options) {
        const props = [];
        for (const prop in options) {
            if (options.hasOwnProperty(prop) && prop !== "chunks" && prop !== "lights")
                props.push(prop);
        }

        let key = "custom";

        if (options.chunks) {
            const chunks = [];
            for (const p in options.chunks) {
                if (options.chunks.hasOwnProperty(p)) {
                    chunks.push(p + options.chunks[p]);
                }
            }
            chunks.sort();
            key += chunks;
        }

        if (options.litOptions) {

            for (const m in options.litOptions) {

                // handle lights in a custom way
                if (m === 'lights') {
                    const isClustered = options.litOptions.clusteredLightingEnabled;
                    for (let i = 0; i < options.litOptions.lights.length; i++) {
                        const light = options.litOptions.lights[i];
                        if (!isClustered || light._type === LIGHTTYPE_DIRECTIONAL) {
                            key += light.key;
                        }
                    }
                } else {
                    key += m + options.litOptions[m];
                }
            }
        }

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
