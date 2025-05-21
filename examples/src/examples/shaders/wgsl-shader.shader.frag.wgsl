varying fragPosition: vec4f;
varying texCoord: vec2f;

uniform amount : f32;
var diffuseTexture : texture_2d<f32>;
var diffuseSampler : sampler;

@fragment
fn fragmentMain(input : FragmentInput) -> FragmentOutput {

    var color : vec3f = input.fragPosition.rgb;
    var roloc : vec3f = vec3f(uniform.amount) + color;
    var diffuseColor : vec4f = textureSample(diffuseTexture, diffuseSampler, input.texCoord);

    var output: FragmentOutput;
    output.color = vec4f(diffuseColor.xyz * roloc, 1.0);
    return output;
}
