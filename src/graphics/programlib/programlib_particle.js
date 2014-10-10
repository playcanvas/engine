pc.gfx.programlib.particle = {
    generateKey: function (device, options) {
        var key = "particle";
        if (options.billboard) key += '_bbrd';
        return key;
    },

    createShaderDefinition: function (device, options) {
        /////////////////////////
        // GENERATE ATTRIBUTES //
        /////////////////////////
        var attributes = {
            particle_uvLifeTimeFrameStart: pc.gfx.SEMANTIC_ATTR0,
            particle_positionStartTime: pc.gfx.SEMANTIC_ATTR1,
            particle_velocityStartSize: pc.gfx.SEMANTIC_ATTR2,
            particle_accelerationEndSize: pc.gfx.SEMANTIC_ATTR3,
            particle_spinStartSpinSpeed: pc.gfx.SEMANTIC_ATTR4,
            particle_colorMult: pc.gfx.SEMANTIC_ATTR5
        }
        if (!options.billboard) {
            attributes.particle_orientation = pc.gfx.SEMANTIC_ATTR6;
        }

        ////////////////////////////
        // GENERATE VERTEX SHADER //
        ////////////////////////////
        var getSnippet = pc.gfx.programlib.getSnippet;
        var code = '';

		var chunk = pc.gfx.shaderChunks;
		code += chunk.particleStartVS;
		if (!options.billboard) code += chunk.particleStartRotationVS;

		code += chunk.particleVS;
		code += options.billboard? chunk.particleEndBBRDVS : chunk.particleEndVS;


        var vshader = code;

        //////////////////////////////
        // GENERATE FRAGMENT SHADER //
        //////////////////////////////
        code = getSnippet(device, 'fs_precision');
		code += chunk.particlePS;

        var fshader = code;

        return {
            attributes: attributes,
            vshader: vshader,
            fshader: fshader
        };
    }
};
