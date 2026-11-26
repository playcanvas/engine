import { DebugHelper } from '../../core/debug.js';
import { SHADERLANGUAGE_GLSL, SHADERLANGUAGE_WGSL } from '../../platform/graphics/constants.js';
import { shaderChunksGLSL } from '../shader-lib/glsl/collections/shader-chunks-glsl.js';
import { shaderChunksWGSL } from '../shader-lib/wgsl/collections/shader-chunks-wgsl.js';
import { Feature } from './feature.js';

/**
 * The core shader chunks on a WebGL device: the chunks of the common, lit and standard shaders,
 * and of the engine's internal shaders.
 *
 * @type {Feature}
 * @ignore
 */
export const featureCoreChunksWebgl = /* #__PURE__ */ new Feature({
    chunks: {
        language: SHADERLANGUAGE_GLSL,
        chunks: shaderChunksGLSL
    }
});
DebugHelper.setName(featureCoreChunksWebgl, 'coreChunks-webgl');

/**
 * The core shader chunks on a WebGPU device: the chunks of the common, lit and standard shaders,
 * and of the engine's internal shaders.
 *
 * @type {Feature}
 * @ignore
 */
export const featureCoreChunksWebgpu = /* #__PURE__ */ new Feature({
    chunks: {
        language: SHADERLANGUAGE_WGSL,
        chunks: shaderChunksWGSL
    }
});
DebugHelper.setName(featureCoreChunksWebgpu, 'coreChunks-webgpu');
