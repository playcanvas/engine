// the color of the scene behind the glass, grabbed by the Depth layer, with mipmaps
var uSceneColorMap: texture_2d<f32>;
var uSceneColorMapSampler: sampler;

// the bumps of the glass, and its roughness, frosted around a clear logo
var uOffsetMap: texture_2d<f32>;
var uOffsetMapSampler: sampler;
var uRoughnessMap: texture_2d<f32>;
var uRoughnessMapSampler: sampler;

// the size of the render target in .xy, and its inverse in .zw
uniform screen_size: vec4f;

varying texCoord: vec2f;
varying viewNormal: vec3f;

@fragment
fn fragmentMain(input: FragmentInput) -> FragmentOutput {
    var output: FragmentOutput;

    let roughness = 1.0 - textureSample(uRoughnessMap, uRoughnessMapSampler, texCoord).r;

    // the view through the glass bends at its rounded edges, and on its bumps. The screen
    // position points down, so the vertical direction of the normal is flipped.
    let normal = normalize(viewNormal);
    let bumps = textureSample(uOffsetMap, uOffsetMapSampler, texCoord).rg * 2.0 - 1.0;
    let offset = vec2f(-normal.x, normal.y) * 0.08 + bumps * (0.2 + roughness) * 0.015;

    // the rougher the glass, the smaller and more blurred the mip level the scene is sampled from
    let grabUv = pcPosition.xy * uniform.screen_size.zw;
    let color = textureSampleLevel(uSceneColorMap, uSceneColorMapSampler, grabUv + offset, roughness * 7.0).rgb;

    // the frosted glass and its edges are a little brighter
    let edge = 1.0 - abs(normal.z);
    output.color = vec4f(color + roughness * 0.06 + edge * edge * 0.3, 1.0);
    return output;
}
