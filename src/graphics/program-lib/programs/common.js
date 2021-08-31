import {
    GAMMA_SRGB, GAMMA_SRGBFAST, GAMMA_SRGBHDR,
    TONEMAP_ACES, TONEMAP_ACES2, TONEMAP_FILMIC, TONEMAP_HEJL, TONEMAP_LINEAR
} from '../../../scene/constants.js';

import { shaderChunks } from '../chunks/chunks.js';

function gammaCode(value, chunks) {
    if (!chunks) chunks = shaderChunks;
    if (value === GAMMA_SRGB || value === GAMMA_SRGBFAST) {
        return chunks.gamma2_2PS ? chunks.gamma2_2PS : shaderChunks.gamma2_2PS;
    } else if (value === GAMMA_SRGBHDR) {
        return "#define HDR\n" + (chunks.gamma2_2PS ? chunks.gamma2_2PS : shaderChunks.gamma2_2PS);
    }
    return chunks.gamma1_0PS ? chunks.gamma1_0PS : shaderChunks.gamma1_0PS;
}

function tonemapCode(value, chunks) {
    if (!chunks) chunks = shaderChunks;
    if (value === TONEMAP_FILMIC) {
        return chunks.tonemappingFilmicPS ? chunks.tonemappingFilmicPS : shaderChunks.tonemappingFilmicPS;
    } else if (value === TONEMAP_LINEAR) {
        return chunks.tonemappingLinearPS ? chunks.tonemappingLinearPS : shaderChunks.tonemappingLinearPS;
    } else if (value === TONEMAP_HEJL) {
        return chunks.tonemappingHejlPS ? chunks.tonemappingHejlPS : shaderChunks.tonemappingHejlPS;
    } else if (value === TONEMAP_ACES) {
        return chunks.tonemappingAcesPS ? chunks.tonemappingAcesPS : shaderChunks.tonemappingAcesPS;
    } else if (value === TONEMAP_ACES2) {
        return chunks.tonemappingAces2PS ? chunks.tonemappingAces2PS : shaderChunks.tonemappingAces2PS;
    }
    return chunks.tonemapingNonePS ? chunks.tonemapingNonePS : shaderChunks.tonemappingNonePS;
}

function fogCode(value, chunks) {
    if (!chunks) chunks = shaderChunks;
    if (value === 'linear') {
        return chunks.fogLinearPS ? chunks.fogLinearPS : shaderChunks.fogLinearPS;
    } else if (value === 'exp') {
        return chunks.fogExpPS ? chunks.fogExpPS : shaderChunks.fogExpPS;
    } else if (value === 'exp2') {
        return chunks.fogExp2PS ? chunks.fogExp2PS : shaderChunks.fogExp2PS;
    }
    return chunks.fogNonePS ? chunks.fogNonePS : shaderChunks.fogNonePS;
}

function skinCode(device, chunks) {
    if (!chunks) chunks = shaderChunks;
    if (device.supportsBoneTextures) {
        return chunks.skinTexVS;
    }
    return "#define BONE_LIMIT " + device.getBoneLimit() + "\n" + chunks.skinConstVS;
}

function precisionCode(device) {
    let pcode = 'precision ' + device.precision + ' float;\n';
    if (device.webgl2) {
        pcode += '#ifdef GL2\nprecision ' + device.precision + ' sampler2DShadow;\n#endif\n';
    }
    return pcode;
}

function versionCode(device) {
    return device.webgl2 ? "#version 300 es\n" : "";
}

function dummyFragmentCode() {
    return "void main(void) {gl_FragColor = vec4(0.0);}";
}

function begin() {
    return 'void main(void)\n{\n';
}

function end() {
    return '}\n';
}

export { begin, end, dummyFragmentCode, fogCode, gammaCode, precisionCode, skinCode, tonemapCode, versionCode };
