varying decalPos: vec4f;
var uDecalMap: texture_2d<f32>;
var uDecalMapSampler: sampler;

@fragment
fn fragmentMain(input: FragmentInput) -> FragmentOutput {
    var output: FragmentOutput;

    // decal space position from -1..1 range, to texture space range 0..1
    let p: vec4f = input.decalPos * 0.5 + 0.5;

    // if the position is outside out 0..1 projection box, ignore the pixel
    if (p.x < 0.0 || p.x > 1.0 || p.y < 0.0 || p.y > 1.0 || p.z < 0.0 || p.z > 1.0) {
        discard;
        return output;
    }

    output.color = textureSampleLevel(uDecalMap, uDecalMapSampler, p.xy, 0.0);
    return output;
}