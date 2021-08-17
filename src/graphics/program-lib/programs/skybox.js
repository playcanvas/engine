import { SEMANTIC_POSITION } from '../../constants.js';
import { shaderChunks } from '../chunks/chunks.js';

import { gammaCode, precisionCode, tonemapCode } from './common.js';

const skybox = {
    generateKey: function (options) {
        const key = "skybox" + options.rgbm + " " + options.hdr + " " + options.fixSeams + "" +
                  options.toneMapping + "" + options.gamma + "" + options.useIntensity + "" +
                  options.useCubeMapRotation + "" + options.useRightHandedCubeMap + "" + options.mip;
        return key;
    },

    createShaderDefinition: function (device, options) {
        const mip2size = [128, 64, 32, 16, 8, 4, 2];

        let fshader = precisionCode(device);
        fshader += options.useCubeMapRotation ? '#define CUBEMAP_ROTATION\n' : '';
        fshader += options.useRightHandedCubeMap ? '#define RIGHT_HANDED_CUBEMAP\n' : '';
        fshader += options.mip ? shaderChunks.fixCubemapSeamsStretchPS : shaderChunks.fixCubemapSeamsNonePS;
        fshader += options.useIntensity ? shaderChunks.envMultiplyPS : shaderChunks.envConstPS;
        fshader += gammaCode(options.gamma);
        fshader += tonemapCode(options.toneMapping);
        fshader += shaderChunks.rgbmPS;
        fshader += shaderChunks.skyboxHDRPS
            .replace(/\$textureCubeSAMPLE/g, options.rgbm ? "textureCubeRGBM" : (options.hdr ? "textureCube" : "textureCubeSRGB"))
            .replace(/\$FIXCONST/g, (1 - 1 / mip2size[options.mip]) + "");

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
