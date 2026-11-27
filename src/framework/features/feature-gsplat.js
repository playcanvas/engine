import { DebugHelper } from '../../core/debug.js';
import { SHADERLANGUAGE_GLSL, SHADERLANGUAGE_WGSL } from '../../platform/graphics/constants.js';
import { Feature } from '../../scene/features/feature.js';
import { gsplatChunksGLSL } from '../../scene/shader-lib/glsl/collections/gsplat-chunks-glsl.js';
import { gsplatChunksWGSL } from '../../scene/shader-lib/wgsl/collections/gsplat-chunks-wgsl.js';
import { GSplatComponentSystem } from '../components/gsplat/system.js';
import { GSplatHandler } from '../handlers/gsplat.js';
import { FEATURE_GSPLAT } from './constants.js';

/**
 * @import { AppBase } from '../app-base.js'
 */

// The device independent part of Gaussian splats, shared by the feature for each device, so that
// the component system and the asset handler are added once however many of them an application
// installs.
const gsplatCore = /* #__PURE__ */ new Feature({
    componentSystems: [GSplatComponentSystem],
    install: (host) => {
        const app = /** @type {AppBase} */ (host);
        app.loader.addHandler('gsplat', new GSplatHandler(app));
    }
});
DebugHelper.setName(gsplatCore, FEATURE_GSPLAT);

/**
 * Gaussian splats on a WebGL device: {@link featureGsplat} with the shader chunks of WebGL only.
 *
 * @type {Feature}
 * @ignore
 */
export const featureGsplatWebgl = /* #__PURE__ */ new Feature({
    chunks: {
        language: SHADERLANGUAGE_GLSL,
        chunks: gsplatChunksGLSL
    },
    requires: [gsplatCore]
});
DebugHelper.setName(featureGsplatWebgl, 'gsplat-webgl');

/**
 * Gaussian splats on a WebGPU device: {@link featureGsplat} with the shader chunks of WebGPU only.
 *
 * @type {Feature}
 * @ignore
 */
export const featureGsplatWebgpu = /* #__PURE__ */ new Feature({
    chunks: {
        language: SHADERLANGUAGE_WGSL,
        chunks: gsplatChunksWGSL
    },
    requires: [gsplatCore]
});
DebugHelper.setName(featureGsplatWebgpu, 'gsplat-webgpu');

/**
 * Gaussian splats with the {@link GSplatComponent}: the {@link GSplatComponentSystem}, the
 * loading of `gsplat` assets by the {@link GSplatHandler}, and the shader chunks of Gaussian
 * splats for both WebGL and WebGPU devices. Add it to {@link AppOptions#features} to use gsplat
 * components.
 *
 * @type {Feature}
 * @category Graphics
 * @example
 * const options = new AppOptions();
 * options.features = [featureGsplat];
 */
export const featureGsplat = /* #__PURE__ */ new Feature({
    requires: [featureGsplatWebgl, featureGsplatWebgpu]
});
DebugHelper.setName(featureGsplat, 'gsplat-all');
