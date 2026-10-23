import spatialSource from './compute-gsplat-steady-spatial.js';
import temporalSource from './compute-gsplat-steady-temporal.js';
import convergenceSource from './compute-gsplat-steady-convergence.js';

// Fuse reconstruction to avoid an intermediate image and a full-screen dispatch. The spatial
// variant has no temporal bindings or history reads, including on devices without optional features.
export default `${spatialSource /* wgsl */}
#ifdef STEADY_TEMPORAL
${temporalSource}
#endif
#ifdef STEADY_CONVERGENCE
${convergenceSource}
#endif
var steadyOutput: texture_storage_2d<rgba16float, write>;

@compute @workgroup_size(8, 8, 1)
fn main(@builtin(global_invocation_id) globalId: vec3u) {
    var p = vec2i(globalId.xy);
    #ifdef STEADY_CONVERGENCE
        p.y += i32(uniform.steadyRowStart);
        if (globalId.y >= uniform.steadyRowCount) {
            return;
        }
    #endif
    if (any(p >= vec2i(uniform.steadySize))) {
        return;
    }
    let spatial = steadySpatialAt(p);
    var color = spatial;
    #ifdef STEADY_TEMPORAL
        color = steadyTemporalAt(p, color);
    #endif
    #ifdef STEADY_CONVERGENCE
        color = steadyConvergenceAt(p, color, spatial);
    #endif
    // Cubic reconstruction can overshoot coverage; preserve premultiplication when bounding it.
    let alpha = clamp(color.a, 0.0, 1.0);
    let rgb = color.rgb * select(0.0, alpha / max(color.a, 1e-8), color.a > 0.0);
    textureStore(steadyOutput, p, vec4f(rgb, alpha));
}
`;
