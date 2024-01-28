import {
    GAMMA_SRGB, GAMMA_SRGBFAST, GAMMA_SRGBHDR,
    TONEMAP_ACES, TONEMAP_ACES2, TONEMAP_FILMIC, TONEMAP_HEJL, TONEMAP_LINEAR
} from '../../constants.js';
import { shaderChunks } from '../chunks/chunks.js';

class ShaderGenerator {
    static begin() {
        return 'void main(void)\n{\n';
    }

    static end() {
        return '}\n';
    }

    static skinCode(device, chunks = shaderChunks) {
        if (device.supportsBoneTextures) {
            return chunks.skinTexVS;
        }
        return "#define BONE_LIMIT " + device.getBoneLimit() + "\n" + chunks.skinConstVS;
    }

    static fogCode(value, chunks = shaderChunks) {
        if (value === 'linear') {
            return chunks.fogLinearPS ? chunks.fogLinearPS : shaderChunks.fogLinearPS;
        } else if (value === 'exp') {
            return chunks.fogExpPS ? chunks.fogExpPS : shaderChunks.fogExpPS;
        } else if (value === 'exp2') {
            return chunks.fogExp2PS ? chunks.fogExp2PS : shaderChunks.fogExp2PS;
        }
        return chunks.fogNonePS ? chunks.fogNonePS : shaderChunks.fogNonePS;
    }

    static gammaCode(value, chunks = shaderChunks) {
        if (value === GAMMA_SRGB || value === GAMMA_SRGBFAST) {
            return chunks.gamma2_2PS ? chunks.gamma2_2PS : shaderChunks.gamma2_2PS;
        } else if (value === GAMMA_SRGBHDR) {
            return "#define HDR\n" + (chunks.gamma2_2PS ? chunks.gamma2_2PS : shaderChunks.gamma2_2PS);
        }
        return chunks.gamma1_0PS ? chunks.gamma1_0PS : shaderChunks.gamma1_0PS;
    }

    static tonemapCode(value, chunks = shaderChunks) {
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
}

export { ShaderGenerator };
