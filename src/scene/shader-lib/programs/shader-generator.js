import {
    GAMMA_SRGB,
    TONEMAP_ACES, TONEMAP_ACES2, TONEMAP_FILMIC, TONEMAP_HEJL, TONEMAP_NEUTRAL, TONEMAP_LINEAR
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
        return chunks.skinTexVS;
    }

    static fogCode(value, chunks = shaderChunks) {
        if (value === 'linear') {
            return chunks.fogLinearPS ?? shaderChunks.fogLinearPS;
        } else if (value === 'exp') {
            return chunks.fogExpPS ?? shaderChunks.fogExpPS;
        } else if (value === 'exp2') {
            return chunks.fogExp2PS ?? shaderChunks.fogExp2PS;
        }
        return chunks.fogNonePS ? chunks.fogNonePS : shaderChunks.fogNonePS;
    }

    static gammaCode(value, chunks = shaderChunks) {
        if (value === GAMMA_SRGB) {
            return chunks.gamma2_2PS ?? shaderChunks.gamma2_2PS;
        }
        return chunks.gamma1_0PS ?? shaderChunks.gamma1_0PS;
    }

    static tonemapCode(value, chunks = shaderChunks) {
        switch (value) {
            case TONEMAP_FILMIC: return chunks.tonemappingFilmicPS ?? shaderChunks.tonemappingFilmicPS;
            case TONEMAP_LINEAR: return chunks.tonemappingLinearPS ?? shaderChunks.tonemappingLinearPS;
            case TONEMAP_HEJL: return chunks.tonemappingHejlPS ?? shaderChunks.tonemappingHejlPS;
            case TONEMAP_ACES: return chunks.tonemappingAcesPS ?? shaderChunks.tonemappingAcesPS;
            case TONEMAP_ACES2: return chunks.tonemappingAces2PS ?? shaderChunks.tonemappingAces2PS;
            case TONEMAP_NEUTRAL: return chunks.tonemappingNeutralPS ?? shaderChunks.tonemappingNeutralPS;
        }
        return chunks.tonemapingNonePS ?? shaderChunks.tonemappingNonePS;
    }
}

export { ShaderGenerator };
