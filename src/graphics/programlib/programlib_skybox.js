pc.programlib.skybox = {
    generateKey: function (device, options) {
        var key = "skybox" + options.rgbm + " " + options.hdr + " " + options.fixSeams + "" + options.toneMapping + "" + options.gamma
        + "" + options.useIntensity + "" + options.mip;
        return key;
    },

    createShaderDefinition: function (device, options) {
        var getSnippet = pc.programlib.getSnippet;
        var chunks = pc.shaderChunks;
        var mip2size = [128, 64, 16, 8, 4, 2];

        return {
            attributes: {
                aPosition: pc.SEMANTIC_POSITION
            },
            vshader: [
                'attribute vec3 aPosition;',
                '',
                'uniform mat4 matrix_view;',
                'uniform mat4 matrix_projection;',
                '',
                'varying vec3 vViewDir;',
                '',
                'void main(void)',
                '{',
                '    mat4 view = matrix_view;',
                '    view[3][0] = view[3][1] = view[3][2] = 0.0;',
                '    gl_Position = matrix_projection * view * vec4(aPosition, 1.0);',

                // Force skybox to far Z, regardless of the clip planes on the camera
                // Subtract a tiny fudge factor to ensure floating point errors don't
                // still push pixels beyond far Z. See:
                // http://www.opengl.org/discussion_boards/showthread.php/171867-skybox-problem
                '    gl_Position.z = gl_Position.w - 0.00001;',
                '    vViewDir = aPosition;',
                '    vViewDir.x *= -1.0;',
                '}'
            ].join('\n'),
            fshader: getSnippet(device, 'fs_precision') +
                (options.mip? chunks.fixCubemapSeamsStretchPS : chunks.fixCubemapSeamsNonePS) +
                (options.useIntensity? chunks.envMultiplyPS : chunks.envConstPS) +
                pc.programlib.gammaCode(options.gamma) + pc.programlib.tonemapCode(options.toneMapping) + chunks.rgbmPS +
                chunks.skyboxHDRPS.replace(/\$textureCubeSAMPLE/g, options.rgbm? "textureCubeRGBM" : (options.hdr? "textureCube" : "textureCubeSRGB"))
                .replace(/\$FIXCONST/g, (1.0 - 1.0 / mip2size[options.mip]) + "")
        }
    }
};
