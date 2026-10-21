export default /* wgsl */`
#include "sceneTexturesPS"
varying steadyUV: vec2f;
var steadyImage: texture_2d<f32>;
var steadySamples: texture_2d<u32>;

@fragment
fn fragmentMain(input: FragmentInput) -> FragmentOutput {
    var output: FragmentOutput;
    let size = vec2i(textureDimensions(steadyImage));
    let p = clamp(vec2i(steadyUV * vec2f(size)), vec2i(0), size - 1);
    let color = textureLoad(steadyImage, p, 0);
    let sample = textureLoad(steadySamples, p, 0);
    if (color.a <= 0.0) {
        discard;
    }
    let depth = select(1e20, bitcast<f32>(sample.z), sample.y != 0u);
    output.color = vec4f(max(color.rgb, vec3f(0.0)), color.a);
    output.fragDepth = select(1.0, bitcast<f32>(sample.w), sample.y != 0u);
    #ifdef SCENE_TEXTURE_DEPTH
        writeSceneTextureDepth(&output, depth, color.a);
    #endif
    return output;
}
`;
