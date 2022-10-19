import { SHADERSTAGE_VERTEX, SHADERSTAGE_FRAGMENT, SHADERSTAGE_COMPUTE } from '../constants.js';

class WebgpuUtils {
    // converts a combination of SHADER_STAGE_* into GPUShaderStage.*
    static shaderStage(stage) {
        let ret = 0;
        if (stage & SHADERSTAGE_VERTEX) ret |= GPUShaderStage.VERTEX;
        if (stage & SHADERSTAGE_FRAGMENT) ret |= GPUShaderStage.FRAGMENT;
        if (stage & SHADERSTAGE_COMPUTE) ret |= GPUShaderStage.COMPUTE;
        return ret;
    }
}

export { WebgpuUtils };
