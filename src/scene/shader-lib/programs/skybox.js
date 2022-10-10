import { SEMANTIC_POSITION } from '../../../graphics/constants.js';
import { shaderChunks } from '../chunks/chunks.js';
import { ChunkUtils } from '../chunk-utils.js';

import { gammaCode, precisionCode, tonemapCode } from './common.js';

const skybox = {
    generateKey: function (options) {
        return options.type === 'cubemap' ?
            `skybox-${options.type}-${options.encoding}-${options.useIntensity}-${options.gamma}-${options.toneMapping}-${options.fixSeams}-${options.mip}` :
            `skybox-${options.type}-${options.encoding}-${options.useIntensity}-${options.gamma}-${options.toneMapping}`;
    },

    createShaderDefinition: function (device, options) {
        let fshader;
        if (options.type === 'cubemap') {
            const mip2size = [128, 64, /* 32 */ 16, 8, 4, 2];

            fshader = precisionCode(device);
            fshader += options.mip ? shaderChunks.fixCubemapSeamsStretchPS : shaderChunks.fixCubemapSeamsNonePS;
            fshader += options.useIntensity ? shaderChunks.envMultiplyPS : shaderChunks.envConstPS;
            fshader += shaderChunks.decodePS;
            fshader += gammaCode(options.gamma);
            fshader += tonemapCode(options.toneMapping);
            fshader += shaderChunks.skyboxHDRPS
                .replace(/\$DECODE/g, ChunkUtils.decodeFunc(options.encoding))
                .replace(/\$FIXCONST/g, (1 - 1 / mip2size[options.mip]) + "");
        } else {
            fshader = precisionCode(device);
            fshader += options.useIntensity ? shaderChunks.envMultiplyPS : shaderChunks.envConstPS;
            fshader += shaderChunks.decodePS;
            fshader += gammaCode(options.gamma);
            fshader += tonemapCode(options.toneMapping);
            fshader += shaderChunks.sphericalPS;
            fshader += shaderChunks.envAtlasPS;
            fshader += shaderChunks.skyboxEnvPS.replace(/\$DECODE/g, ChunkUtils.decodeFunc(options.encoding));
        }

        return {
            attributes: {
                aPosition: SEMANTIC_POSITION
            },
            vshader: shaderChunks.skyboxVS,
            fshader: fshader
        };
    }
};

export { skybox };
