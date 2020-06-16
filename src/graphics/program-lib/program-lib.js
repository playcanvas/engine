import { shaderChunks } from '../chunks.js';

var programlib = {
    gammaCode: function (value, chunks) {
        if (!chunks) chunks = shaderChunks;
        if (value === pc.GAMMA_SRGB || value === pc.GAMMA_SRGBFAST) {
            return chunks.gamma2_2PS ? chunks.gamma2_2PS : shaderChunks.gamma2_2PS;
        } else if (value === pc.GAMMA_SRGBHDR) {
            return "#define HDR\n" + (chunks.gamma2_2PS ? chunks.gamma2_2PS : shaderChunks.gamma2_2PS);
        }
        return chunks.gamma1_0PS ? chunks.gamma1_0PS : shaderChunks.gamma1_0PS;
    },

    tonemapCode: function (value, chunks) {
        if (!chunks) chunks = shaderChunks;
        if (value === pc.TONEMAP_FILMIC) {
            return chunks.tonemappingFilmicPS ? chunks.tonemappingFilmicPS : shaderChunks.tonemappingFilmicPS;
        } else if (value === pc.TONEMAP_LINEAR) {
            return chunks.tonemappingLinearPS ? chunks.tonemappingLinearPS : shaderChunks.tonemappingLinearPS;
        } else if (value === pc.TONEMAP_HEJL) {
            return chunks.tonemappingHejlPS ? chunks.tonemappingHejlPS : shaderChunks.tonemappingHejlPS;
        } else if (value === pc.TONEMAP_ACES) {
            return chunks.tonemappingAcesPS ? chunks.tonemappingAcesPS : shaderChunks.tonemappingAcesPS;
        } else if (value === pc.TONEMAP_ACES2) {
            return chunks.tonemappingAces2PS ? chunks.tonemappingAces2PS : shaderChunks.tonemappingAces2PS;
        }
        return chunks.tonemapingNonePS ? chunks.tonemapingNonePS : shaderChunks.tonemappingNonePS;
    },

    fogCode: function (value, chunks) {
        if (!chunks) chunks = shaderChunks;
        if (value === 'linear') {
            return chunks.fogLinearPS ? chunks.fogLinearPS : shaderChunks.fogLinearPS;
        } else if (value === 'exp') {
            return chunks.fogExpPS ? chunks.fogExpPS : shaderChunks.fogExpPS;
        } else if (value === 'exp2') {
            return chunks.fogExp2PS ? chunks.fogExp2PS : shaderChunks.fogExp2PS;
        }
        return chunks.fogNonePS ? chunks.fogNonePS : shaderChunks.fogNonePS;
    },

    skinCode: function (device, chunks) {
        if (!chunks) chunks = shaderChunks;
        if (device.supportsBoneTextures) {
            return chunks.skinTexVS;
        }
        return "#define BONE_LIMIT " + device.getBoneLimit() + "\n" + chunks.skinConstVS;
    },

    precisionCode: function (device) {
        var pcode = 'precision ' + device.precision + ' float;\n';
        if (device.webgl2) {
            pcode += '#ifdef GL2\nprecision ' + device.precision + ' sampler2DShadow;\n#endif\n';
        }
        return pcode;
    },

    versionCode: function (device) {
        return device.webgl2 ? "#version 300 es\n" : "";
    },

    dummyFragmentCode: function () {
        return "void main(void) {gl_FragColor = vec4(0.0);}";
    },

    begin: function () {
        return 'void main(void)\n{\n';
    },

    end: function () {
        return '}\n';
    }
};

export { programlib };