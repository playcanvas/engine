export default /* wgsl */`
varying vUv0: vec2f;
var source: texture_2d<f32>;
var sourceSampler: sampler;

@fragment fn fragmentMain(input : FragmentInput) -> FragmentOutput {
    var output: FragmentOutput;
    output.color = textureSample(source, sourceSampler, input.vUv0);
    return output;
}
`;
