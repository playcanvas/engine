#include "gammaPS" // Preserved include

// engine built-in constant storing render target size in .xy and inverse size in .zw
uniform uScreenSize: vec4f;

// reflection texture
var uDiffuseMap: texture_2d<f32>;
var uDiffuseMapSampler: sampler;

@fragment
fn fragmentMain(input: FragmentInput) -> FragmentOutput {
    var output: FragmentOutput;

    // sample reflection texture
    var coord: vec2f = pcPosition.xy * uniform.uScreenSize.zw;
    coord.y = 1.0 - coord.y;
    let reflection: vec4f = textureSample(uDiffuseMap, uDiffuseMapSampler, coord);

    let linearColor: vec3f = reflection.xyz * 0.4;
    output.color = vec4f(gammaCorrectOutput(linearColor), 1.0);
    return output;
}