import { DebugHelper } from '../../core/debug.js';
import { directionalPcssChunksGLSL } from '../shader-lib/glsl/collections/directional-pcss-chunks-glsl.js';
import { directionalPcssChunksWGSL } from '../shader-lib/wgsl/collections/directional-pcss-chunks-wgsl.js';
import { FEATURE_DIRECTIONAL_PCSS } from './constants.js';
import { Feature } from './feature.js';
import { featureDirectionalShadowsWebgl, featureDirectionalShadowsWebgpu } from './feature-directional-shadows.js';

// Directional PCSS needs no engine code of its own, so the shared feature only records that it is
// installed, once when a host installs the feature for both devices.
const directionalPcssCode = /* #__PURE__ */ new Feature({});
DebugHelper.setName(directionalPcssCode, FEATURE_DIRECTIONAL_PCSS);

/**
 * PCSS soft shadows of directional lights on a WebGL device.
 *
 * @type {Feature}
 * @ignore
 */
export const featureDirectionalPcssWebgl = /* #__PURE__ */ new Feature({
    chunks: directionalPcssChunksGLSL,
    // the directional shadows of the same device, for their shader chunks as well as their engine code
    requires: [featureDirectionalShadowsWebgl, directionalPcssCode]
});
DebugHelper.setName(featureDirectionalPcssWebgl, 'directionalPcss-webgl');

/**
 * PCSS soft shadows of directional lights on a WebGPU device.
 *
 * @type {Feature}
 * @ignore
 */
export const featureDirectionalPcssWebgpu = /* #__PURE__ */ new Feature({
    chunks: directionalPcssChunksWGSL,
    // the directional shadows of the same device, for their shader chunks as well as their engine code
    requires: [featureDirectionalShadowsWebgpu, directionalPcssCode]
});
DebugHelper.setName(featureDirectionalPcssWebgpu, 'directionalPcss-webgpu');
