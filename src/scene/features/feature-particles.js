import { particleChunksGLSL } from '../shader-lib/glsl/collections/particle-chunks-glsl.js';
import { particleChunksWGSL } from '../shader-lib/wgsl/collections/particle-chunks-wgsl.js';
import { FEATURE_PARTICLES } from './constants.js';
import { Feature } from './feature.js';

// The particle code needs no installation, so the shared feature only records that particles are
// installed, once when a host installs the feature for both devices.
const particlesCode = /* #__PURE__ */ new Feature({
    name: FEATURE_PARTICLES
});

/**
 * Particle systems on a WebGL device.
 *
 * @type {Feature}
 * @ignore
 */
export const featureParticlesWebgl = /* #__PURE__ */ new Feature({
    name: 'particles-webgl',
    chunks: particleChunksGLSL,
    requires: [particlesCode]
});

/**
 * Particle systems on a WebGPU device.
 *
 * @type {Feature}
 * @ignore
 */
export const featureParticlesWebgpu = /* #__PURE__ */ new Feature({
    name: 'particles-webgpu',
    chunks: particleChunksWGSL,
    requires: [particlesCode]
});
