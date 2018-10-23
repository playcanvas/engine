pc.programlib.skybox = {
    generateKey: function (options) {
        var key = "skybox" + options.rgbm + " " + options.hdr + " " + options.fixSeams + "" +
                  options.toneMapping + "" + options.gamma + "" + options.useIntensity + "" + options.mip;
        return key;
    },

    createShaderDefinition: function (device, options) {
        var chunks = pc.shaderChunks;
        var mip2size = [128, 64, 16, 8, 4, 2];

        return {
            attributes: {
                aPosition: pc.SEMANTIC_POSITION
            },
            vshader: chunks.skyboxVS,
            fshader: pc.programlib.precisionCode(device) +
                (options.mip ? chunks.fixCubemapSeamsStretchPS : chunks.fixCubemapSeamsNonePS) +
                (options.useIntensity ? chunks.envMultiplyPS : chunks.envConstPS) +
                pc.programlib.gammaCode(options.gamma) + pc.programlib.tonemapCode(options.toneMapping) + chunks.rgbmPS +
                chunks.skyboxHDRPS.replace(/\$textureCubeSAMPLE/g, options.rgbm ? "textureCubeRGBM" : (options.hdr ? "textureCube" : "textureCubeSRGB"))
                    .replace(/\$FIXCONST/g, (1.0 - 1.0 / mip2size[options.mip]) + "")
        };
    }
};
