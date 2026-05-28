varying fragPosition: vec4f;
varying texCoord: vec2f;

uniform amount: f32;
var diffuseTexture: texture_2d<f32>;
var diffuseSampler: sampler;

@fragment
fn fragmentMain(input: FragmentInput) -> FragmentOutput {
    let color = input.fragPosition.rgb;
    let tint = vec3f(uniform.amount) + color;
    let diffuseColor = textureSample(diffuseTexture, diffuseSampler, input.texCoord);

    var output: FragmentOutput;
    output.color = vec4f(diffuseColor.xyz * tint, 1.0);
    return output;
}
