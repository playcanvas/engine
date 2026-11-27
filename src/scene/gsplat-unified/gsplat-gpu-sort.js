import { GSplatHybridRenderer } from './gsplat-hybrid-renderer.js';
import { GSplatHybridRendererScratch } from './gsplat-hybrid-renderer-scratch.js';
import { GSplatShadowRenderer } from './gsplat-shadow-renderer.js';

/**
 * The classes of GPU-side sorted rendering of Gaussian splats, which only WebGPU supports: the
 * forward renderer, the scratch it shares with the shadow renderer, and the shadow renderer. They
 * bring the compute projection, culling and radix sorting with them. The WebGPU gsplat feature
 * installs them on the renderer, so that the gsplat code reaches them from there and applications
 * built for WebGL only do not include them.
 *
 * @ignore
 */
const gsplatGpuSort = {
    HybridRenderer: GSplatHybridRenderer,
    HybridRendererScratch: GSplatHybridRendererScratch,
    ShadowRenderer: GSplatShadowRenderer
};

/**
 * @typedef {typeof gsplatGpuSort} GSplatGpuSort
 * @ignore
 */

export { gsplatGpuSort };
