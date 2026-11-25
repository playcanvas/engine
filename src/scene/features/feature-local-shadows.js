import { DebugHelper } from '../../core/debug.js';
import { ShadowRendererLocal } from '../renderer/shadow-renderer-local.js';
import { localShadowChunksGLSL } from '../shader-lib/glsl/collections/local-shadow-chunks-glsl.js';
import { localShadowChunksWGSL } from '../shader-lib/wgsl/collections/local-shadow-chunks-wgsl.js';
import { FEATURE_LOCAL_SHADOWS } from './constants.js';
import { Feature } from './feature.js';
import { shadowsCoreWebgl, shadowsCoreWebgpu } from './feature-shadows-core.js';

/**
 * @import { FeatureHost } from './feature.js'
 */

/**
 * Creates the renderer of the shadows of local (omni and spot) lights on the renderer of the host.
 *
 * @param {FeatureHost} host - The host the feature is installed into.
 */
function installLocalShadows(host) {
    const renderer = host.renderer;
    if (renderer?.shadowRenderer) {
        renderer._shadowRendererLocal = new ShadowRendererLocal(renderer, renderer.shadowRenderer);
    }
}

// The engine code of the shadows of local (omni and spot) lights, installed once when a host installs the features of
// both devices.
const localShadowsCode = /* #__PURE__ */ new Feature({
    install: installLocalShadows
});
DebugHelper.setName(localShadowsCode, FEATURE_LOCAL_SHADOWS);

/**
 * The shadows of local (omni and spot) lights on a WebGL device.
 *
 * @type {Feature}
 * @ignore
 */
export const featureLocalShadowsWebgl = /* #__PURE__ */ new Feature({
    chunks: localShadowChunksGLSL,
    // the shared shadow rendering of the same device, installed before the code that builds on it
    requires: [shadowsCoreWebgl, localShadowsCode]
});
DebugHelper.setName(featureLocalShadowsWebgl, 'localShadows-webgl');

/**
 * The shadows of local (omni and spot) lights on a WebGPU device.
 *
 * @type {Feature}
 * @ignore
 */
export const featureLocalShadowsWebgpu = /* #__PURE__ */ new Feature({
    chunks: localShadowChunksWGSL,
    // the shared shadow rendering of the same device, installed before the code that builds on it
    requires: [shadowsCoreWebgpu, localShadowsCode]
});
DebugHelper.setName(featureLocalShadowsWebgpu, 'localShadows-webgpu');
