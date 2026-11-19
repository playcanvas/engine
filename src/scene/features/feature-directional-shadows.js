import { DebugHelper } from '../../core/debug.js';
import { ShadowRendererDirectional } from '../renderer/shadow-renderer-directional.js';
import { directionalShadowChunksGLSL } from '../shader-lib/glsl/collections/directional-shadow-chunks-glsl.js';
import { directionalShadowChunksWGSL } from '../shader-lib/wgsl/collections/directional-shadow-chunks-wgsl.js';
import { FEATURE_DIRECTIONAL_SHADOWS } from './constants.js';
import { Feature } from './feature.js';
import { shadowsCoreWebgl, shadowsCoreWebgpu } from './feature-shadows-core.js';

/**
 * @import { FeatureHost } from './feature.js'
 */

/**
 * Creates the renderer of the shadows of directional lights on the renderer of the host.
 *
 * @param {FeatureHost} host - The host the feature is installed into.
 */
function installDirectionalShadows(host) {
    const renderer = host.renderer;
    if (renderer?.shadowRenderer) {
        renderer._shadowRendererDirectional = new ShadowRendererDirectional(renderer, renderer.shadowRenderer);
    }
}

// The engine code of the shadows of directional lights, installed once when a host installs the features of
// both devices.
const directionalShadowsCode = /* #__PURE__ */ new Feature({
    install: installDirectionalShadows
});
DebugHelper.setName(directionalShadowsCode, FEATURE_DIRECTIONAL_SHADOWS);

/**
 * The shadows of directional lights on a WebGL device.
 *
 * @type {Feature}
 * @ignore
 */
export const featureDirectionalShadowsWebgl = /* #__PURE__ */ new Feature({
    chunks: directionalShadowChunksGLSL,
    // the shared shadow rendering of the same device, installed before the code that builds on it
    requires: [shadowsCoreWebgl, directionalShadowsCode]
});
DebugHelper.setName(featureDirectionalShadowsWebgl, 'directionalShadows-webgl');

/**
 * The shadows of directional lights on a WebGPU device.
 *
 * @type {Feature}
 * @ignore
 */
export const featureDirectionalShadowsWebgpu = /* #__PURE__ */ new Feature({
    chunks: directionalShadowChunksWGSL,
    // the shared shadow rendering of the same device, installed before the code that builds on it
    requires: [shadowsCoreWebgpu, directionalShadowsCode]
});
DebugHelper.setName(featureDirectionalShadowsWebgpu, 'directionalShadows-webgpu');
