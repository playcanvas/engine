pc.gfx.programlib.particle2 = {
    generateKey: function(device, options) {
        var key = "particle2" + options.mode + options.normal + options.halflambert + options.stretch + options.soft + options.mesh
        + options.srgb + options.wrap + options.blend + options.toneMap + options.fog;
        return key;
    },

    createShaderDefinition: function(device, options) {
        var modeGPU = 0;
        var modeCPU = 1;

        var getSnippet = pc.gfx.programlib.getSnippet;
        var chunk = pc.gfx.shaderChunks;

        var vshader = "";
        var fshader = getSnippet(device, 'fs_precision') + "\n";

        if (options.mode == modeGPU) {
            if (options.normal == 1) vshader +=     "\nvarying vec3 Normal;\n";
            if (options.normal == 2) vshader +=     "\nvarying mat3 ParticleMat;\n";
            vshader +=                              chunk.particle2VS;
            if (options.wrap) vshader +=                              chunk.particle2_wrapVS;
            vshader +=                              options.mesh ? chunk.particle2_meshVS : chunk.particle2_billboardVS;
            if (options.normal == 1) vshader +=     chunk.particle2_normalVS;
            if (options.normal == 2) vshader +=     chunk.particle2_TBNVS;
            if (options.stretch > 0.0) vshader +=   chunk.particle2_stretchVS;
            vshader += chunk.particle2_endVS;
        } else {
            if (options.normal == 1) vshader +=     "\nvarying vec3 Normal;\n";
            if (options.normal == 2) vshader +=     "\nvarying mat3 ParticleMat;\n";
            vshader +=                              chunk.particle2_cpuVS;
            //if (options.wrap) vshader +=                              chunk.particle2_wrapVS;
            if (options.mesh) vshader +=            chunk.particle2_cpu_meshVS;
            if (options.normal == 1) vshader +=     chunk.particle2_normalVS;
            if (options.normal == 2) vshader +=     chunk.particle2_TBNVS;
            vshader +=                              chunk.particle2_cpu_endVS;
        }

        if (options.normal > 0) {
            if (options.normal == 1) {
                fshader +=                          "\nvarying vec3 Normal;\n";
            } else if (options.normal == 2) {
                fshader +=                          "\nvarying mat3 ParticleMat;\n";
            }
            fshader +=                              "\nuniform vec3 lightCube[6];\n";
        }

        if ((options.normal==0) && (options.fog!="none")) options.srgb = false; // don't have to perform all gamma conversions when no lighting is used
        fshader += options.srgb ? chunk.gamma2_2PS : chunk.gamma1_0PS;
        fshader += "struct psInternalData {float dummy;};\n";
        fshader += chunk.defaultTonemapping;

        if (options.fog === 'linear') {
            fshader += chunk.fogLinearPS;
        } else if (options.fog === 'exp') {
            fshader += chunk.fogExpPS;
        } else if (options.fog === 'exp2') {
            fshader += chunk.fogExp2PS;
        } else {
            fshader += chunk.fogNonePS;
        }

        fshader +=                                  chunk.particle2PS;
        if (options.soft > 0) fshader +=            chunk.particle2_softPS;
        if (options.normal == 1) fshader +=         "\nvec3 normal = Normal;\n"
        if (options.normal == 2) fshader +=         chunk.particle2_normalMapPS;
        if (options.normal > 0) fshader +=          options.halflambert ? chunk.particle2_halflambertPS : chunk.particle2_lambertPS;
        if (options.normal > 0) fshader +=          chunk.particle2_lightingPS;
        if (options.blend==pc.scene.BLEND_NORMAL) {
            fshader += chunk.particle2_blendNormalPS;
        } else if (options.blend==pc.scene.BLEND_ADDITIVE) {
            fshader += chunk.particle2_blendAddPS;
        } else if (options.blend==pc.scene.BLEND_MULTIPLICATIVE) {
            fshader += chunk.particle2_blendMultiplyPS;
        }
        fshader += chunk.particle2_endPS;

        var attributes = pc.gfx.shaderChunks.collectAttribs(vshader);

        return {
            attributes: attributes,
            vshader: vshader,
            fshader: fshader
        };
    }
};
