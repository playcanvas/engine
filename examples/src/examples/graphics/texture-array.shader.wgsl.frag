#include "gammaPS"

varying vUv0: vec2f;
varying worldNormal: vec3f;
uniform uTime: f32;

var uDiffuseMap: texture_2d_array<f32>;
var uDiffuseMapSampler: sampler;

@fragment
fn fragmentMain(input: FragmentInput) -> FragmentOutput {
    var output: FragmentOutput;

    // sample different texture based on time along its texture v-coordinate
    let index: f32 = (sin(uniform.uTime + input.vUv0.y + input.vUv0.x * 0.5) * 0.5 + 0.5) * 4.0;
    var data: vec3f = textureSample(uDiffuseMap, uDiffuseMapSampler, input.vUv0, i32(floor(index))).xyz;

    data = data.rgb * (0.8 * max(dot(input.worldNormal, vec3f(0.1, 1.0, 0.5)), 0.0) + 0.5);
    output.color = vec4f(gammaCorrectOutput(data), 1.0);
    return output;
}