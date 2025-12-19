
/**
 * Simple Color-Inverse Fragment Shader with intensity control.
 * 
 * Usage: the following parameters must be set:
 *   uDiffuseMap: image texture.
 *   amount: float that controls the amount of the inverse-color effect. 0 means none (normal color), while 1 means full inverse.
 *
 * Additionally, the Vertex shader that is paired with this Fragment shader must specify:
 *   varying vec2 vUv0: for the UV.
 */

#include "gammaPS"

// Additional varying from vertex shader
varying vUv0: vec2f;

// Custom Parameters (must be set from code via material.setParameter())
var uDiffuseMap: texture_2d<f32>;
var uDiffuseMapSampler: sampler;
uniform amount: f32;

@fragment
fn fragmentMain(input: FragmentInput) -> FragmentOutput {
    var output: FragmentOutput;
    
    let color: vec4f = textureSample(uDiffuseMap, uDiffuseMapSampler, input.vUv0);
    let roloc: vec3f = vec3f(1.0) - color.rgb;
    let mixedColor: vec3f = mix(color.rgb, roloc, uniform.amount);
    let correctedColor: vec3f = gammaCorrectOutput(mixedColor);
    
    output.color = vec4f(correctedColor, color.a);
    return output;
}

