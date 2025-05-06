export default /* wgsl */`
varying texCoordsAlphaLife: vec4f;

var colorMap: texture_2d<f32>;
var colorMapSampler: sampler;
var colorParam: texture_2d<f32>;
var colorParamSampler: sampler;

uniform graphSampleSize: f32;
uniform graphNumSamples: f32;

#ifndef CAMERAPLANES
    #define CAMERAPLANES
    uniform camera_params: vec4f;
#endif

uniform softening: f32;
uniform colorMult: f32;

fn saturate(x: f32) -> f32 {
    return clamp(x, 0.0, 1.0);
}

@fragment
fn fragmentMain(input: FragmentInput) -> FragmentOutput {
    var output: FragmentOutput;

    let tex: vec4f  = textureSample(colorMap, colorMapSampler, vec2f(input.texCoordsAlphaLife.x, 1.0 - input.texCoordsAlphaLife.y));
    var ramp: vec4f = textureSample(colorParam, colorParamSampler, vec2f(input.texCoordsAlphaLife.w, 0.0));
    ramp = vec4f(ramp.rgb * uniform.colorMult, ramp.a);

    ramp.a = ramp.a + input.texCoordsAlphaLife.z;

    var rgb: vec3f = tex.rgb * ramp.rgb;
    var a: f32 = tex.a * ramp.a;
`;
