#include "gammaPS" // Preserved include

varying vUv0: vec2f;
varying worldNormal: vec3f;

var uDiffuseMap: texture_2d_array<f32>;
var uDiffuseMapSampler: sampler;

@fragment
fn fragmentMain(input: FragmentInput) -> FragmentOutput {
    var output: FragmentOutput;

    var data: vec4f = textureSample(uDiffuseMap, uDiffuseMapSampler, vUv0, i32(step(vUv0.x, 0.5) + 2.0 * step(vUv0.y, 0.5)));
    data = vec4f(data.rgb * (0.8 * max(dot(worldNormal, vec3f(0.1, 1.0, 0.5)), 0.0) + 0.5), data.a);  // simple lighting
    output.color = vec4f(gammaCorrectOutput(data.rgb), 1.0);

    return output;
}