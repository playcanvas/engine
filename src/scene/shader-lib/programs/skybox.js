import { SEMANTIC_POSITION } from '../../../platform/graphics/constants.js';
import { shaderChunks } from '../chunks/chunks.js';
import { ChunkUtils } from '../chunk-utils.js';

import { ShaderUtils } from '../../../platform/graphics/shader-utils.js';
import { ShaderGenerator } from './shader-generator.js';
import { SKYTYPE_INFINITE } from '../../constants.js';

const fShader = `
    #include "decodePS"
    #include "gamma"
    #include "tonemapping"
    #include "envMultiplyPS"

    #ifdef SKY_CUBEMAP
        #include "skyboxHDRPS"
    #else
        #include "sphericalPS"
        #include "envAtlasPS"
        #include "skyboxEnvPS"
    #endif
`;

class ShaderGeneratorSkybox extends ShaderGenerator {
    generateKey(options) {
        const sharedKey = `skybox-${options.type}-${options.encoding}-${options.gamma}-${options.toneMapping}-${options.skymesh}`;
        return sharedKey + (options.type === 'cubemap' ? `-${options.mip}` : '');
    }

    createShaderDefinition(device, options) {

        // defines
        const defines = new Map();
        defines.set('SKYBOX_DECODE_FNC', ChunkUtils.decodeFunc(options.encoding));
        if (options.skymesh !== SKYTYPE_INFINITE) defines.set('SKYMESH', '');
        if (options.type === 'cubemap') {
            defines.set('SKY_CUBEMAP', '');
        }

        // includes
        const includes = new Map();
        includes.set('decodePS', shaderChunks.decodePS);
        includes.set('gamma', ShaderGenerator.gammaCode(options.gamma));
        includes.set('tonemapping', ShaderGenerator.tonemapCode(options.toneMapping));
        includes.set('envMultiplyPS', shaderChunks.envMultiplyPS);

        if (options.type === 'cubemap') {
            includes.set('skyboxHDRPS', shaderChunks.skyboxHDRPS);
        } else {
            includes.set('sphericalPS', shaderChunks.sphericalPS);
            includes.set('envAtlasPS', shaderChunks.envAtlasPS);
            includes.set('skyboxEnvPS', shaderChunks.skyboxEnvPS);
        }

        return ShaderUtils.createDefinition(device, {
            name: 'SkyboxShader',
            attributes: {
                aPosition: SEMANTIC_POSITION
            },
            vertexCode: shaderChunks.skyboxVS,
            vertexDefines: defines,
            fragmentCode: fShader,
            fragmentDefines: defines,
            fragmentIncludes: includes
        });
    }
}

const skybox = new ShaderGeneratorSkybox();

export { skybox };
