pc.programlib.particle = {
    generateKey: function(device, options) {
        var key = "particle";
        for (var prop in options) {
            if (options.hasOwnProperty(prop)) {
                key += options[prop];
            }
        }
        return key;
    },

    _animTex: function(options, chunk) {
        var vshader = "";
        vshader += options.animTexLoop? chunk.particleAnimFrameLoopVS : chunk.particleAnimFrameClampVS;
        vshader += chunk.particleAnimTexVS;
        return vshader;
    },

    createShaderDefinition: function(device, options) {

        var chunk = pc.shaderChunks;

        var vshader = "";
        var fshader = pc.programlib.precisionCode(device) + "\n";

        if (options.animTex) vshader += "\nuniform vec4 animTexParams;\n";
        if (options.normal == 2) vshader += "\nvarying mat3 ParticleMat;\n";
        if (options.normal == 1) vshader += "\nvarying vec3 Normal;\n";
        if (options.soft) vshader += "\nvarying float vDepth;\n";

        if (!options.useCpu) {
            vshader += chunk.particle_initVS;
            vshader += (options.pack8? chunk.particleInputRgba8PS : chunk.particleInputFloatPS);
            vshader += chunk.particleVS;
            if (options.localSpace) vshader += chunk.particle_localShiftVS;
            if (options.animTex) vshader += this._animTex(options, chunk);
            if (options.wrap) vshader += chunk.particle_wrapVS;
            if (options.alignToMotion) vshader += chunk.particle_pointAlongVS;
            vshader += options.mesh ? chunk.particle_meshVS : chunk.particle_billboardVS;
            if (options.normal == 1) vshader += chunk.particle_normalVS;
            if (options.normal == 2) vshader += chunk.particle_TBNVS;
            if (options.stretch > 0.0) vshader += chunk.particle_stretchVS;
            vshader += chunk.particle_endVS;
            if (options.soft > 0) vshader += chunk.particle_softVS;
        } else {
            vshader += chunk.particle_cpuVS;
            if (options.localSpace) vshader += chunk.particle_localShiftVS;
            if (options.animTex) vshader += this._animTex(options, chunk);
            //if (options.wrap) vshader += chunk.particle_wrapVS;
            if (options.alignToMotion) vshader += chunk.particle_pointAlongVS;
            vshader += options.mesh ? chunk.particle_meshVS : chunk.particle_billboardVS;
            if (options.normal == 1) vshader += chunk.particle_normalVS;
            if (options.normal == 2) vshader += chunk.particle_TBNVS;
            if (options.stretch > 0.0) vshader += chunk.particle_stretchVS;
            vshader += chunk.particle_cpu_endVS;
            if (options.soft > 0) vshader += chunk.particle_softVS;
        }
        vshader += "}\n";

        if (options.normal > 0) {
            if (options.normal == 1) {
                fshader += "\nvarying vec3 Normal;\n";
            } else if (options.normal == 2) {
                fshader += "\nvarying mat3 ParticleMat;\n";
            }
            fshader += "\nuniform vec3 lightCube[6];\n";
        }
        if (options.soft) fshader += "\nvarying float vDepth;\n";

        if ((options.normal === 0) && (options.fog === "none")) options.srgb = false; // don't have to perform all gamma conversions when no lighting and fogging is used
        fshader += pc.programlib.gammaCode(options.gamma);
        fshader += pc.programlib.tonemapCode(options.toneMap);

        if (options.fog === 'linear') {
            fshader += chunk.fogLinearPS;
        } else if (options.fog === 'exp') {
            fshader += chunk.fogExpPS;
        } else if (options.fog === 'exp2') {
            fshader += chunk.fogExp2PS;
        } else {
            fshader += chunk.fogNonePS;
        }

        if (options.normal == 2) fshader += "\nuniform sampler2D normalMap;\n";
        if (options.soft > 0) fshader += "\nuniform sampler2D uDepthMap;\n uniform vec4 uScreenSize;\n";
        fshader += chunk.particlePS;
        if (options.soft > 0) fshader += chunk.particle_softPS;
        if (options.normal == 1) fshader += "\nvec3 normal = Normal;\n";
        if (options.normal == 2) fshader += chunk.particle_normalMapPS;
        if (options.normal > 0) fshader += options.halflambert ? chunk.particle_halflambertPS : chunk.particle_lambertPS;
        if (options.normal > 0) fshader += chunk.particle_lightingPS;
        if (options.blend==pc.BLEND_NORMAL) {
            fshader += chunk.particle_blendNormalPS;
        } else if (options.blend==pc.BLEND_ADDITIVE) {
            fshader += chunk.particle_blendAddPS;
        } else if (options.blend==pc.BLEND_MULTIPLICATIVE) {
            fshader += chunk.particle_blendMultiplyPS;
        }
        fshader += chunk.particle_endPS;

        var attributes = pc.shaderChunks.collectAttribs(vshader);

        return {
            attributes: attributes,
            vshader: vshader,
            fshader: fshader
        };
    }
};
