import { SEMANTIC_POSITION } from '../../../platform/graphics/constants.js';
import { shaderChunks } from '../chunks/chunks.js';
import { ChunkUtils } from '../chunk-utils.js';

import { ShaderUtils } from '../../../platform/graphics/shader-utils.js';
import { ShaderGenerator } from './shader-generator.js';
import { SKYTYPE_INFINITE } from '../../constants.js';

class ShaderGeneratorSkybox extends ShaderGenerator {
    generateKey(options) {
        const sharedKey = `skybox-${options.type}-${options.encoding}-${options.useIntensity}-${options.gamma}-${options.toneMapping}-${options.skymesh}`;
        return sharedKey + (options.type === 'cubemap' ? `-${options.fixSeams}-${options.mip}` : '');
    }

    createShaderDefinition(device, options) {
        const defines = options.skymesh === SKYTYPE_INFINITE ? '' : '#define SKYMESH\n';
        const vshader = defines + shaderChunks.skyboxVS;
        let fshader = defines;

        if (options.type === 'cubemap') {
            const mip2size = [128, 64, /* 32 */ 16, 8, 4, 2];
            fshader += options.mip ? shaderChunks.fixCubemapSeamsStretchPS : shaderChunks.fixCubemapSeamsNonePS;
            fshader += options.useIntensity ? shaderChunks.envMultiplyPS : shaderChunks.envConstPS;
            fshader += shaderChunks.decodePS;
            fshader += ShaderGenerator.gammaCode(options.gamma);
            fshader += ShaderGenerator.tonemapCode(options.toneMapping);
            fshader += shaderChunks.skyboxHDRPS
                .replace(/\$DECODE/g, ChunkUtils.decodeFunc(options.encoding))
                .replace(/\$FIXCONST/g, (1 - 1 / mip2size[options.mip]) + "");
        } else {
            fshader += options.useIntensity ? shaderChunks.envMultiplyPS : shaderChunks.envConstPS;
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
            vertexCode: vshader,
            fragmentCode: fshader
        });
    }
}

const skybox = new ShaderGeneratorSkybox();

export { skybox };
