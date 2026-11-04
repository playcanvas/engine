#include "gammaPS"

varying vUv0: vec2f;

var uDiffuseMap: texture_2d<f32>;
var uDiffuseMapSampler: sampler;
var uHeightMap: texture_2d<f32>;
var uHeightMapSampler: sampler;
uniform uTime: f32;

@fragment
fn fragmentMain(input: FragmentInput) -> FragmentOutput {
    var output: FragmentOutput;
    let height: f32 = textureSample(uHeightMap, uHeightMapSampler, input.vUv0).r;
    var linearColor: vec4f = textureSample(uDiffuseMap, uDiffuseMapSampler, input.vUv0);

    if (height < uniform.uTime) {
        discard;
        return output;
    }
    if (height < (uniform.uTime + uniform.uTime * 0.1)) {
        linearColor = vec4f(5.0, 0.02, 0.0, 1.0);
    }

    let finalRgb = gammaCorrectOutput(linearColor.rgb);
    output.color = vec4f(finalRgb, 1.0);
    return output;
}
