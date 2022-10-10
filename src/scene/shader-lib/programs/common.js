import {
    DEVICETYPE_WEBGPU, DEVICETYPE_WEBGL
} from '../../../graphics/constants.js';

import {
    GAMMA_SRGB, GAMMA_SRGBFAST, GAMMA_SRGBHDR,
    TONEMAP_ACES, TONEMAP_ACES2, TONEMAP_FILMIC, TONEMAP_HEJL, TONEMAP_LINEAR
} from '../../constants.js';
import { ShaderPass } from '../../shader-pass.js';

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

function precisionCode(device, forcePrecision, shadowPrecision) {

    let code = '';

    if (device.deviceType === DEVICETYPE_WEBGL) {

        if (forcePrecision && forcePrecision !== 'highp' && forcePrecision !== 'mediump' && forcePrecision !== 'lowp') {
            forcePrecision = null;
        }

        if (forcePrecision) {
            if (forcePrecision === 'highp' && device.maxPrecision !== 'highp') {
                forcePrecision = 'mediump';
            }
            if (forcePrecision === 'mediump' && device.maxPrecision === 'lowp') {
                forcePrecision = 'lowp';
            }
        }

        const precision = forcePrecision ? forcePrecision : device.precision;
        code = `precision ${precision} float;\n`;

        // TODO: this can be only set on shaders with version 300 or more, so make this optional as many
        // internal shaders (particles..) are from webgl1 era and don't set any precision. Modified when upgraded.
        if (shadowPrecision && device.webgl2) {
            code += `precision ${precision} sampler2DShadow;\n`;
        }
    }

    return code;
}

function versionCode(device) {
    if (device.deviceType === DEVICETYPE_WEBGPU) {
        return '#version 450\n';
    }

    return device.webgl2 ? "#version 300 es\n" : "";
}

// SpectorJS integration
function getShaderNameCode(name) {
    return `#define SHADER_NAME ${name}\n`;
}

function vertexIntro(device, name, pass, extensionCode) {

    let code = versionCode(device);

    if (device.deviceType === DEVICETYPE_WEBGPU) {

        code += shaderChunks.webgpuVS;

    } else {    // WebGL

        if (extensionCode) {
            code += extensionCode + "\n";
        }

        if (device.webgl2) {
            code += shaderChunks.gles3VS;
        }
    }

    code += getShaderNameCode(name);
    code += ShaderPass.getPassShaderDefine(pass);

    return code;
}

function fragmentIntro(device, name, pass, extensionCode, forcePrecision) {

    let code = versionCode(device);

    if (device.deviceType === DEVICETYPE_WEBGPU) {

        code += shaderChunks.webgpuPS;

    } else {    // WebGL

        if (extensionCode) {
            code += extensionCode + "\n";
        }

        if (device.webgl2) {    // WebGL 2

            code += shaderChunks.gles3PS;

        } else {    // WebGL 1

            if (device.extStandardDerivatives) {
                code += "#extension GL_OES_standard_derivatives : enable\n";
            }
            if (device.extTextureLod) {
                code += "#extension GL_EXT_shader_texture_lod : enable\n";
                code += "#define SUPPORTS_TEXLOD\n";
            }

            code += shaderChunks.gles2PS;
        }
    }

    code += precisionCode(device, forcePrecision, true);
    code += getShaderNameCode(name);
    code += ShaderPass.getPassShaderDefine(pass);

    return code;
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

export { vertexIntro, fragmentIntro, begin, end, dummyFragmentCode, fogCode, gammaCode, precisionCode, skinCode, tonemapCode, versionCode };
