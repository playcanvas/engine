// Shades the capsule of a particle of the SceneParticlesEffect, see the vertex shader. The particle
// is included for the storage buffer of the particles, which the stages share a binding of.

#include "sceneParticleCS"

varying vColor: vec3f;
varying vUv: vec2f;
varying vStretch: f32;

@fragment
fn fragmentMain(input: FragmentInput) -> FragmentOutput {

    // the distance to the segment along the middle of the capsule, in units of its radius
    let dx = max(abs(input.vUv.x) - input.vStretch, 0.0);
    let d2 = dx * dx + input.vUv.y * input.vUv.y;
    if (d2 > 1.0) {
        discard;
    }

    // a little shading toward the edge gives the particles some volume
    var output: FragmentOutput;
    output.color = vec4f(input.vColor * (1.0 - 0.45 * d2), 1.0);
    return output;
}
