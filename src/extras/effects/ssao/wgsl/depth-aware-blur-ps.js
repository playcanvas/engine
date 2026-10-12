export default /* wgsl */`
#include "screenDepthPS"

varying uv0: vec2f;

var sourceTexture: texture_2d<f32>;
var sourceTextureSampler: sampler;
uniform sourceInvResolution: vec2f;
uniform filterSize: i32;

fn random(w: vec2f) -> f32 {
    const m: vec3f = vec3f(0.06711056, 0.00583715, 52.9829189);
    return fract(m.z * fract(dot(w, m.xy)));
}

fn bilateralWeight(depth: f32, sampleDepth: f32) -> f32 {
    let diff: f32 = (sampleDepth - depth);
    return max(0.0, 1.0 - diff * diff);
}

fn tap(sum_ptr: ptr<function, f32>, totalWeight_ptr: ptr<function, f32>, weight: f32, depth: f32, position: vec2f) {

    let color: f32 = textureSample(sourceTexture, sourceTextureSampler, position).r;
    let textureDepth: f32 = -getLinearScreenDepth(position);

    let bilateral: f32 = bilateralWeight(depth, textureDepth) * weight;

    *sum_ptr = *sum_ptr + color * bilateral;
    *totalWeight_ptr = *totalWeight_ptr + bilateral;
}

// TODO: weights of 1 are used for all samples. Test with gaussian weights
@fragment
fn fragmentMain(input: FragmentInput) -> FragmentOutput {
    var output: FragmentOutput;

    // handle the center pixel separately because it doesn't participate in bilateral filtering
    let depth: f32 = -getLinearScreenDepth(input.uv0);
    var totalWeight: f32 = 1.0;
    let color: f32 = textureSample(sourceTexture, sourceTextureSampler, input.uv0 ).r;
    var sum: f32 = color * totalWeight;

    for (var i: i32 = -uniform.filterSize; i <= uniform.filterSize; i = i + 1) {
        let weight: f32 = 1.0;

        #ifdef HORIZONTAL
            var offset: vec2f = vec2f(f32(i), 0.0) * uniform.sourceInvResolution;
        #else
            var offset: vec2f = vec2f(0.0, f32(i)) * uniform.sourceInvResolution;
        #endif

        tap(&sum, &totalWeight, weight, depth, input.uv0 + offset);
    }

    let ao: f32 = sum / totalWeight;

    // simple dithering helps a lot (assumes 8 bits target)
    // this is most useful with high quality/large blurs
    // ao += ((random(gl_FragCoord.xy) - 0.5) / 255.0);

    output.color = vec4f(ao, ao, ao, 1.0);
    return output;
}
`;
