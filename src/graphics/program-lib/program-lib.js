pc.programlib = {
    gammaCode: function (value) {
        return value===pc.GAMMA_NONE? pc.shaderChunks.gamma1_0PS :
              (value===pc.GAMMA_SRGBFAST? pc.shaderChunks.gamma2_2FastPS : pc.shaderChunks.gamma2_2PS);
    },

    tonemapCode: function (value) {
        if (value===pc.TONEMAP_FILMIC) {
            return pc.shaderChunks.tonemappingFilmicPS;
        } else if (value===pc.TONEMAP_LINEAR) {
            return pc.shaderChunks.tonemappingLinearPS;
        } else if (value===pc.TONEMAP_HEJL) {
            return pc.shaderChunks.tonemappingHejlPS;
        } else if (value===pc.TONEMAP_ACES) {
            return pc.shaderChunks.tonemappingAcesPS;
        }
        return pc.shaderChunks.tonemappingNonePS;
    },

    fogCode: function(value) {
        if (value === 'linear') {
            return pc.shaderChunks.fogLinearPS;
        } else if (value === 'exp') {
            return pc.shaderChunks.fogExpPS;
        } else if (value === 'exp2') {
            return pc.shaderChunks.fogExp2PS;
        } else {
            return pc.shaderChunks.fogNonePS;
        }
    },

    skinCode: function(device) {
        if (device.supportsBoneTextures) {
            return pc.shaderChunks.skinTexVS;
        } else {
            return "#define BONE_LIMIT " + device.getBoneLimit() + "\n" + pc.shaderChunks.skinConstVS;
        }
    },

    precisionCode: function(device) {
        return 'precision ' + device.precision + ' float;\n\n';
    },

    begin: function() {
        return 'void main(void)\n{\n';
    },

    end: function() {
        return '}\n';
    }
};

