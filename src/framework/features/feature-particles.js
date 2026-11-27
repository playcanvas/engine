import { DebugHelper } from '../../core/debug.js';
import { Feature } from '../../scene/features/feature.js';
import { particleChunksGLSL } from '../../scene/shader-lib/glsl/collections/particle-chunks-glsl.js';
import { particleChunksWGSL } from '../../scene/shader-lib/wgsl/collections/particle-chunks-wgsl.js';
import { ParticleSystemComponentSystem } from '../components/particle-system/system.js';
import { FEATURE_PARTICLES } from './constants.js';

// The device independent part of particle systems, shared by the feature for each device, so that
// the component system is added once however many of them an application installs.
const particlesCore = /* #__PURE__ */ new Feature({
    componentSystems: [ParticleSystemComponentSystem]
});
DebugHelper.setName(particlesCore, FEATURE_PARTICLES);

/**
 * Particle systems on a WebGL device: {@link featureParticles} with the shader chunks of WebGL
 * only.
 *
 * @type {Feature}
 * @ignore
 */
export const featureParticlesWebgl = /* #__PURE__ */ new Feature({
    chunks: particleChunksGLSL,
    requires: [particlesCore]
});
DebugHelper.setName(featureParticlesWebgl, 'particles-webgl');

/**
 * Particle systems on a WebGPU device: {@link featureParticles} with the shader chunks of WebGPU
 * only.
 *
 * @type {Feature}
 * @ignore
 */
export const featureParticlesWebgpu = /* #__PURE__ */ new Feature({
    chunks: particleChunksWGSL,
    requires: [particlesCore]
});
DebugHelper.setName(featureParticlesWebgpu, 'particles-webgpu');

/**
 * Particle systems with the {@link ParticleSystemComponent}: the
 * {@link ParticleSystemComponentSystem}, and the shader chunks of particles for both WebGL and
 * WebGPU devices. Add it to {@link AppOptions#features} to use particle system components.
 *
 * @type {Feature}
 * @category Graphics
 * @example
 * const options = new AppOptions();
 * options.features = [featureParticles];
 */
export const featureParticles = /* #__PURE__ */ new Feature({
    requires: [featureParticlesWebgl, featureParticlesWebgpu]
});
DebugHelper.setName(featureParticles, 'particles-all');
