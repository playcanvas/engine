import { shadowChunksGLSL } from '../shader-lib/glsl/collections/shadow-chunks-glsl.js';
import { shadowChunksWGSL } from '../shader-lib/wgsl/collections/shadow-chunks-wgsl.js';
import { Feature } from './feature.js';

// The engine code of shadow rendering, shared by the feature for each device, so that it is
// installed once when a host installs both.
const shadowsCode = /* #__PURE__ */ new Feature({
    name: 'shadows'
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
