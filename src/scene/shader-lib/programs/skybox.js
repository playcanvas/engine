import { SEMANTIC_POSITION } from '../../../platform/graphics/constants.js';
import { shaderChunks } from '../chunks/chunks.js';
import { ChunkUtils } from '../chunk-utils.js';

import { ShaderUtils } from '../../../platform/graphics/shader-utils.js';
import { ShaderGenerator } from './shader-generator.js';
import { SKYTYPE_INFINITE, tonemapNames } from '../../constants.js';

class ShaderGeneratorSkybox extends ShaderGenerator {
    generateKey(options) {
        const definesHash = ShaderGenerator.definesHash(options.defines);
        const sharedKey = `skybox-${options.type}-${options.encoding}-${options.gamma}-${options.toneMapping}-${options.skymesh}_${definesHash}`;
        return sharedKey + (options.type === 'cubemap' ? `-${options.mip}` : '');
    }

    createShaderDefinition(device, options) {

        // defines
        const defines = new Map();
        defines.set('TONEMAP', tonemapNames[options.toneMapping]);
        defines.set('SKYBOX_DECODE_FNC', ChunkUtils.decodeFunc(options.encoding));
        if (options.skymesh !== SKYTYPE_INFINITE) defines.set('SKYMESH', '');
        if (options.type === 'cubemap') {
            defines.set('SKY_CUBEMAP', '');
        }

        // includes
        const includes = new Map(Object.entries({
            ...shaderChunks,
            ...options.chunks
        }));
        includes.set('decodePS', shaderChunks.decodePS);
        includes.set('gamma', ShaderGenerator.gammaCode(options.gamma));
        includes.set('envMultiplyPS', shaderChunks.envMultiplyPS);

        if (options.type !== 'cubemap') {
            includes.set('sphericalPS', shaderChunks.sphericalPS);
            includes.set('envAtlasPS', shaderChunks.envAtlasPS);
        }

        return ShaderUtils.createDefinition(device, {
            name: 'SkyboxShader',
            attributes: {
                aPosition: SEMANTIC_POSITION
            },
            vertexCode: shaderChunks.skyboxVS,
            vertexDefines: defines,
            fragmentCode: shaderChunks.skyboxPS,
            fragmentDefines: defines,
            fragmentIncludes: includes
        });
    }
}

const skybox = new ShaderGeneratorSkybox();

export { skybox };
