// use the special uSceneColorMap texture, which is a built-in texture containing
// a copy of the color buffer at the point of capture, inside the Depth layer.
var uSceneColorMap: texture_2d<f32>;
var uSceneColorMapSampler: sampler;

// normal map providing offsets
var uOffsetMap: texture_2d<f32>;
var uOffsetMapSampler: sampler;

// roughness map
var uRoughnessMap: texture_2d<f32>;
var uRoughnessMapSampler: sampler;

// tint colors
uniform tints: array<vec3f, 4>;

// engine built-in constant storing render target size in .xy and inverse size in .zw
uniform uScreenSize: vec4f;

varying texCoord: vec2f;

@fragment
fn fragmentMain(input: FragmentInput) -> FragmentOutput {
    var output: FragmentOutput;

    let roughness: f32 = 1.0 - textureSample(uRoughnessMap, uRoughnessMapSampler, texCoord).r;

    // sample offset texture - used to add distortion to the sampled background
    var offset: vec2f = textureSample(uOffsetMap, uOffsetMapSampler, texCoord).rg;
    offset = 2.0 * offset - 1.0;

    // offset strength
    offset = offset * (0.2 + roughness) * 0.015;

    // get normalized uv coordinates for canvas
    let grabUv: vec2f = pcPosition.xy * uniform.uScreenSize.zw;

    // roughness dictates which mipmap level gets used, in 0..4 range
    let mipmap: f32 = roughness * 5.0;

    // get background pixel color with distorted offset
    var grabColor: vec3f = textureSampleLevel(uSceneColorMap, uSceneColorMapSampler, grabUv + offset, mipmap).rgb;

    // tint the material based on mipmap
    let tintIndex: f32 = clamp(mipmap, 0.0, 3.0);
    grabColor = grabColor * uniform.tints[i32(tintIndex)];

    // brighten the refracted texture a little bit
    // brighten even more the rough parts of the glass
    output.color = vec4f(grabColor * 1.1, 1.0) + vec4f(roughness * 0.09);
    return output;
}