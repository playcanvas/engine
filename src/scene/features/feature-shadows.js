import { DebugHelper } from '../../core/debug.js';
import { Feature } from './feature.js';
import { featureDirectionalShadowsWebgl, featureDirectionalShadowsWebgpu } from './feature-directional-shadows.js';
import { featureLocalShadowsWebgl, featureLocalShadowsWebgpu } from './feature-local-shadows.js';

/**
 * Shadow rendering of all light types on a WebGL device: the directional and local shadows.
 *
 * @type {Feature}
 * @ignore
 */
export const featureShadowsWebgl = /* #__PURE__ */ new Feature({
    requires: [featureDirectionalShadowsWebgl, featureLocalShadowsWebgl]
});
DebugHelper.setName(featureShadowsWebgl, 'shadows-webgl');

/**
 * Shadow rendering of all light types on a WebGPU device: the directional and local shadows.
 *
 * @type {Feature}
 * @ignore
 */
export const featureShadowsWebgpu = /* #__PURE__ */ new Feature({
    requires: [featureDirectionalShadowsWebgpu, featureLocalShadowsWebgpu]
});
DebugHelper.setName(featureShadowsWebgpu, 'shadows-webgpu');
