#include "gammaPS"

varying vertOutTexCoord: f32;
varying texCoord: vec2f;

@fragment
fn fragmentMain(input: FragmentInput) -> FragmentOutput {
    var output: FragmentOutput;

    let v_in = input.vertOutTexCoord;
    let v = f32(i32(v_in * 6.0)) / 6.0;
    let linearColor = vec3f(0.218, 0.190, 0.156) * v;
    let correctedRgb = gammaCorrectOutput(linearColor.rgb);
    output.color = vec4f(correctedRgb, 1.0);

    return output;
}