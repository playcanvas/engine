import { SEMANTIC_POSITION } from '../../graphics.js';
import { shaderChunks } from '../chunks/chunks.js';

import { gammaCode, precisionCode, tonemapCode } from './common.js';

var skybox = {
    generateKey: function (options) {
        var key = "skybox" + options.rgbm + " " + options.hdr + " " + options.fixSeams + "" +
                  options.toneMapping + "" + options.gamma + "" + options.useIntensity + "" + options.useRotation + "" + options.mip;
        return key;
    },

    createShaderDefinition: function (device, options) {
        var mip2size = [128, 64, 32, 16, 8, 4, 2];

        var fshader;
        fshader  = precisionCode(device);
        fshader += options.mip ? shaderChunks.fixCubemapSeamsStretchPS : shaderChunks.fixCubemapSeamsNonePS;
        fshader += options.useIntensity ? shaderChunks.envMultiplyPS : shaderChunks.envConstPS;
        fshader += gammaCode(options.gamma);
        fshader += tonemapCode(options.toneMapping);
        fshader += shaderChunks.rgbmPS;
        var skyboxChunkPS = options.useRotation ? shaderChunks.skyboxHDRRotPS : shaderChunks.skyboxHDRPS;
        fshader += skyboxChunkPS
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
