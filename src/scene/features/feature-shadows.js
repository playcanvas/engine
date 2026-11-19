import { Debug } from '../../core/debug.js';
import { ShadowMapCache } from '../renderer/shadow-map-cache.js';
import { ShadowRendererDirectional } from '../renderer/shadow-renderer-directional.js';
import { ShadowRendererLocal } from '../renderer/shadow-renderer-local.js';
import { ShadowRenderer } from '../renderer/shadow-renderer.js';
import { shadowChunksGLSL } from '../shader-lib/glsl/collections/shadow-chunks-glsl.js';
import { shadowChunksWGSL } from '../shader-lib/wgsl/collections/shadow-chunks-wgsl.js';
import { FEATURE_SHADOWS } from './constants.js';
import { Feature } from './feature.js';

/**
 * @import { FeatureHost } from './feature.js'
 */

/**
 * Creates the shadow renderers on the renderer of the host.
 *
 * @param {FeatureHost} host - The host the feature is installed into.
 */
function installShadows(host) {
    const renderer = host.renderer;
    Debug.assert(renderer, 'The shadows feature needs a renderer');
    if (!renderer) {
        return;
    }

    const shadowMapCache = new ShadowMapCache();
    const shadowRenderer = new ShadowRenderer(renderer, renderer.lightTextureAtlas, shadowMapCache);

    renderer.shadowMapCache = shadowMapCache;
    renderer.shadowRenderer = shadowRenderer;
    renderer._shadowRendererLocal = new ShadowRendererLocal(renderer, shadowRenderer);
    renderer._shadowRendererDirectional = new ShadowRendererDirectional(renderer, shadowRenderer);
}

// The engine code of shadow rendering, shared by the feature for each device, so that it is
// installed once when a host installs both.
const shadowsCode = /* #__PURE__ */ new Feature({
    name: FEATURE_SHADOWS,
    install: installShadows
});

/**
 * Shadow rendering on a WebGL device.
 *
 * @type {Feature}
 * @ignore
 */
export const featureShadowsWebgl = /* #__PURE__ */ new Feature({
    name: 'shadows-webgl',
    chunks: shadowChunksGLSL,
    requires: [shadowsCode]
});

/**
 * Shadow rendering on a WebGPU device.
 *
 * @type {Feature}
 * @ignore
 */
export const featureShadowsWebgpu = /* #__PURE__ */ new Feature({
    name: 'shadows-webgpu',
    chunks: shadowChunksWGSL,
    requires: [shadowsCode]
});
