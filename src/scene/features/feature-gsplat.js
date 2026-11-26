import { DebugHelper } from '../../core/debug.js';
import { SHADERLANGUAGE_GLSL, SHADERLANGUAGE_WGSL } from '../../platform/graphics/constants.js';
import { gsplatChunksGLSL } from '../shader-lib/glsl/collections/gsplat-chunks-glsl.js';
import { gsplatChunksWGSL } from '../shader-lib/wgsl/collections/gsplat-chunks-wgsl.js';
import { Feature } from './feature.js';

/**
 * The shader chunks of Gaussian splats on a WebGL device.
 *
 * @type {Feature}
 * @ignore
 */
export const featureGsplatWebgl = /* #__PURE__ */ new Feature({
    chunks: {
        language: SHADERLANGUAGE_GLSL,
        chunks: gsplatChunksGLSL
    }
});
DebugHelper.setName(featureGsplatWebgl, 'gsplat-webgl');

/**
 * The shader chunks of Gaussian splats on a WebGPU device.
 *
 * @type {Feature}
 * @ignore
 */
export const featureGsplatWebgpu = /* #__PURE__ */ new Feature({
    chunks: {
        language: SHADERLANGUAGE_WGSL,
        chunks: gsplatChunksWGSL
    }
});
DebugHelper.setName(featureGsplatWebgpu, 'gsplat-webgpu');
