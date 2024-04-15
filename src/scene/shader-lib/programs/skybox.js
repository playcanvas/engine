import { SEMANTIC_POSITION } from '../../../platform/graphics/constants.js';
import { shaderChunks } from '../chunks/chunks.js';
import { ChunkUtils } from '../chunk-utils.js';

import { ShaderUtils } from '../../../platform/graphics/shader-utils.js';
import { ShaderGenerator } from './shader-generator.js';
import { SKYTYPE_INFINITE } from '../../constants.js';

class ShaderGeneratorSkybox extends ShaderGenerator {
    generateKey(options) {
        const sharedKey = `skybox-${options.type}-${options.encoding}-${options.gamma}-${options.toneMapping}-${options.skymesh}`;
        return sharedKey + (options.type === 'cubemap' ? `-${options.mip}` : '');
    }

    createShaderDefinition(device, options) {

        // shared defines
        const defines = new Map();
        if (options.skymesh !== SKYTYPE_INFINITE) defines.set('SKYMESH', '');
        if (options.type === 'cubemap') defines.set('SKY_CUBEMAP', '');

        // fragment shader
        let fshader = '';
        if (options.type === 'cubemap') {

            // mip level
            const mip2size = [128, 64, /* 32 */ 16, 8, 4, 2];
            defines.set('SKYBOX_MIP', (1 - 1 / mip2size[options.mip]).toString());

            fshader += options.mip ? shaderChunks.fixCubemapSeamsStretchPS : shaderChunks.fixCubemapSeamsNonePS;
            fshader += shaderChunks.envMultiplyPS;
            fshader += shaderChunks.decodePS;
            fshader += ShaderGenerator.gammaCode(options.gamma);
            fshader += ShaderGenerator.tonemapCode(options.toneMapping);
            fshader += shaderChunks.skyboxHDRPS.replace(/\$DECODE/g, ChunkUtils.decodeFunc(options.encoding));
        } else {
            fshader += shaderChunks.envMultiplyPS;
            fshader += shaderChunks.decodePS;
            fshader += ShaderGenerator.gammaCode(options.gamma);
            fshader += ShaderGenerator.tonemapCode(options.toneMapping);
            fshader += shaderChunks.sphericalPS;
            fshader += shaderChunks.envAtlasPS;
            fshader += shaderChunks.skyboxEnvPS.replace(/\$DECODE/g, ChunkUtils.decodeFunc(options.encoding));
        }

        return ShaderUtils.createDefinition(device, {
            name: 'SkyboxShader',
            attributes: {
                aPosition: SEMANTIC_POSITION
            },
            vertexCode: shaderChunks.skyboxVS,
            vertexDefines: defines,
            fragmentCode: fshader,
            fragmentDefines: defines
        });
    }
}

const skybox = new ShaderGeneratorSkybox();

export { skybox };
