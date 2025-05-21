export default /* wgsl */`

varying vUv0: vec2f;

var source: texture_2d<f32>;
var sourceSampler: sampler;
uniform pixelOffset: vec2f;

fn isUsed(pixel: vec4f) -> bool {
    #ifdef HDR
        return any(pixel.rgb > vec3f(0.0));
    #else
        return pixel.a > 0.0;
    #endif
}

@fragment
fn fragmentMain(input: FragmentInput) -> FragmentOutput {
    var c: vec4f = textureSampleLevel(source, sourceSampler, input.vUv0, 0.0);
    c = select(textureSampleLevel(source, sourceSampler, input.vUv0 - uniform.pixelOffset, 0.0), c, isUsed(c));
    c = select(textureSampleLevel(source, sourceSampler, input.vUv0 + vec2f(0.0, -uniform.pixelOffset.y), 0.0), c, isUsed(c));
    c = select(textureSampleLevel(source, sourceSampler, input.vUv0 + vec2f(uniform.pixelOffset.x, -uniform.pixelOffset.y), 0.0), c, isUsed(c));
    c = select(textureSampleLevel(source, sourceSampler, input.vUv0 + vec2f(-uniform.pixelOffset.x, 0.0), 0.0), c, isUsed(c));
    c = select(textureSampleLevel(source, sourceSampler, input.vUv0 + vec2f(uniform.pixelOffset.x, 0.0), 0.0), c, isUsed(c));
    c = select(textureSampleLevel(source, sourceSampler, input.vUv0 + vec2f(-uniform.pixelOffset.x, uniform.pixelOffset.y), 0.0), c, isUsed(c));
    c = select(textureSampleLevel(source, sourceSampler, input.vUv0 + vec2f(0.0, uniform.pixelOffset.y), 0.0), c, isUsed(c));
    c = select(textureSampleLevel(source, sourceSampler, input.vUv0 + uniform.pixelOffset, 0.0), c, isUsed(c));

    var output: FragmentOutput;
    output.color = c;
    return output;
}
`;
