export default /* wgsl */`
varying vUv0: vec2f;

var source: texture_2d<f32>;
var sourceSampler: sampler;

#ifdef GAUSS
    uniform weight: array<f32, {SAMPLES}>;
#endif
uniform pixelOffset: vec2f;

@fragment
fn fragmentMain(input: FragmentInput) -> FragmentOutput {
    var output: FragmentOutput;
    var moments: vec3f = vec3f(0.0);
    let uv: vec2f = input.vUv0 - uniform.pixelOffset * (f32({SAMPLES}) * 0.5);

    for (var i: i32 = 0; i < {SAMPLES}; i = i + 1) {
        let c: vec4f = textureSample(source, sourceSampler, uv + uniform.pixelOffset * f32(i));

        #ifdef GAUSS
            moments = moments + c.xyz * uniform.weight[i].element;
        #else
            moments = moments + c.xyz;
        #endif
    }

    #ifndef GAUSS
        moments = moments * (1.0 / f32({SAMPLES}));
    #endif

    output.color = vec4f(moments, 1.0);
    return output;
}
`;
