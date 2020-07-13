import { SEMANTIC_POSITION } from '../graphics.js';
import { shaderChunks } from './chunks/chunks.js';

import { programlib } from './program-lib.js';

var skybox = {
    generateKey: function (options) {
        var key = "skybox" + options.rgbm + " " + options.hdr + " " + options.fixSeams + "" +
                  options.toneMapping + "" + options.gamma + "" + options.useIntensity + "" + options.mip;
        return key;
    },

    createShaderDefinition: function (device, options) {
        var mip2size = [128, 64, 32, 16, 8, 4, 2];

        var fshader;
        fshader  = programlib.precisionCode(device);
        fshader += options.mip ? shaderChunks.fixCubemapSeamsStretchPS : shaderChunks.fixCubemapSeamsNonePS;
        fshader += options.useIntensity ? shaderChunks.envMultiplyPS : shaderChunks.envConstPS;
        fshader += programlib.gammaCode(options.gamma);
        fshader += programlib.tonemapCode(options.toneMapping);
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
