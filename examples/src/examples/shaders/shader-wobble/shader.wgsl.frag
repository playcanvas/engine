#include "gammaPS"

var uDiffuseMap: texture_2d<f32>;
var uDiffuseMapSampler: sampler;

varying vUv0: vec2f;

@fragment
fn fragmentMain(input: FragmentInput) -> FragmentOutput {
    var output: FragmentOutput;
    let linearColor: vec4f = textureSample(uDiffuseMap, uDiffuseMapSampler, input.vUv0);
    let corrected_rgb: vec3f = gammaCorrectOutput(linearColor.rgb);
    output.color = vec4f(corrected_rgb, 1.0);
    return output;
}