#include "gammaPS"

varying vUv0: vec2f;
varying vLayer: f32;

var uImpostorMap: texture_2d_array<f32>;
var uImpostorMapSampler: sampler;

@fragment
fn fragmentMain(input: FragmentInput) -> FragmentOutput {
    var output: FragmentOutput;

    let color = textureSample(uImpostorMap, uImpostorMapSampler, input.vUv0, i32(floor(input.vLayer + 0.5)));
    if (color.a < 0.5) {
        discard;
    }

    // the mip levels blend the statue with the transparent black background, un-premultiply the
    // color to avoid dark edges in the distance
    output.color = vec4f(gammaCorrectOutput(color.rgb / color.a), 1.0);
    return output;
}
