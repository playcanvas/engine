import { Debug, DebugHelper } from '../../core/debug.js';
import { ShadowMapCache } from '../renderer/shadow-map-cache.js';
import { ShadowRenderer } from '../renderer/shadow-renderer.js';
import { shadowChunksGLSL } from '../shader-lib/glsl/collections/shadow-chunks-glsl.js';
import { shadowChunksWGSL } from '../shader-lib/wgsl/collections/shadow-chunks-wgsl.js';
import { FEATURE_SHADOWS } from './constants.js';
import { Feature } from './feature.js';

/**
 * @import { FeatureHost } from './feature.js'
 */

/**
 * Creates the shadow renderer shared by the shadows of all light types on the renderer of the
 * host.
 *
 * @param {FeatureHost} host - The host the feature is installed into.
 */
function installShadowsCore(host) {
    const renderer = host.renderer;
    Debug.assert(renderer, 'The shadows feature needs a renderer');
    if (!renderer) {
        return;
    }

    const shadowMapCache = new ShadowMapCache();
    renderer.shadowMapCache = shadowMapCache;
    renderer.shadowRenderer = new ShadowRenderer(renderer, renderer.lightTextureAtlas, shadowMapCache);
}

// The engine code shared by the shadows of all light types, installed once when a host installs
// the features of both devices.
const shadowsCoreCode = /* #__PURE__ */ new Feature({
    install: installShadowsCore
});
DebugHelper.setName(shadowsCoreCode, FEATURE_SHADOWS);

/**
 * The shadow rendering shared by the shadows of all light types on a WebGL device, required by
 * the directional and local shadows features.
 *
 * @type {Feature}
 * @ignore
 */
export const shadowsCoreWebgl = /* #__PURE__ */ new Feature({
    chunks: shadowChunksGLSL,
    requires: [shadowsCoreCode]
});
DebugHelper.setName(shadowsCoreWebgl, 'shadowsCore-webgl');

/**
 * The shadow rendering shared by the shadows of all light types on a WebGPU device, required by
 * the directional and local shadows features.
 *
 * @type {Feature}
 * @ignore
 */
export const shadowsCoreWebgpu = /* #__PURE__ */ new Feature({
    chunks: shadowChunksWGSL,
    requires: [shadowsCoreCode]
});
DebugHelper.setName(shadowsCoreWebgpu, 'shadowsCore-webgpu');
