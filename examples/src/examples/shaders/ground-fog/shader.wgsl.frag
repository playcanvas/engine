#include "screenDepthPS"

var uTexture: texture_2d<f32>;
var uTextureSampler: sampler;
uniform uSoftening: f32;

varying texCoord0: vec2f;
varying texCoord1: vec2f;
varying texCoord2: vec2f;
varying screenPos: vec4f;
varying depth: f32;

@fragment
fn fragmentMain(input: FragmentInput) -> FragmentOutput {
    var output: FragmentOutput;

    // sample the texture 3 times and compute average intensity of the fog
    let diffusTexture0: vec4f = textureSample(uTexture, uTextureSampler, input.texCoord0);
    let diffusTexture1: vec4f = textureSample(uTexture, uTextureSampler, input.texCoord1);
    let diffusTexture2: vec4f = textureSample(uTexture, uTextureSampler, input.texCoord2);
    var alpha: f32 = 0.5 * (diffusTexture0.r + diffusTexture1.r + diffusTexture2.r);

    // use built-in getGrabScreenPos function to convert screen position to grab texture uv coords
    let screenCoord: vec2f = getGrabScreenPos(input.screenPos);

    // read the depth from the depth buffer
    let sceneDepth: f32 = getLinearScreenDepth(screenCoord) * uniform.camera_params.x;

    // depth of the current fragment (on the fog plane)
    let fragmentDepth: f32 = input.depth * uniform.camera_params.x;

    // difference between these two depths is used to adjust the alpha, to fade out
    // the fog near the geometry
    let depthDiff: f32 = clamp(abs(fragmentDepth - sceneDepth) * uniform.uSoftening, 0.0, 1.0);
    alpha = alpha * smoothstep(0.0, 1.0, depthDiff);

    // final color
    let fogColor: vec3f = vec3f(1.0, 1.0, 1.0);
    output.color = vec4f(fogColor, alpha);

    return output;
}