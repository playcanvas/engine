export default /* wgsl */`
#if defined(NEAR_BLUR)
    var nearTexture: texture_2d<f32>;
    var nearTextureSampler: sampler;
#endif
var farTexture: texture_2d<f32>;
var farTextureSampler: sampler;
var cocTexture: texture_2d<f32>;
var cocTextureSampler: sampler;

uniform kernel: array<vec2f, {KERNEL_COUNT}>;
uniform blurRadiusNear: f32;
uniform blurRadiusFar: f32;

varying uv0: vec2f;

@fragment
fn fragmentMain(input: FragmentInput) -> FragmentOutput {
    var output: FragmentOutput;

    let coc: vec2f = textureSample(cocTexture, cocTextureSampler, input.uv0).rg;
    let cocFar: f32 = coc.r;

    var sum: vec3f = vec3f(0.0, 0.0, 0.0);

    #if defined(NEAR_BLUR)
        // near blur
        let cocNear: f32 = coc.g;
        if (cocNear > 0.0001) {
            let nearTextureSize: vec2f = vec2f(textureDimensions(nearTexture, 0));
            let step: vec2f = cocNear * uniform.blurRadiusNear / nearTextureSize;

            for (var i: i32 = 0; i < {KERNEL_COUNT}; i = i + 1) {
                let uv: vec2f = uv0 + step * uniform.kernel[i].element;
                let tap: vec3f = textureSampleLevel(nearTexture, nearTextureSampler, uv, 0.0).rgb;
                sum = sum + tap;
            }
            sum = sum * f32({INV_KERNEL_COUNT});

        } else
    #endif

        if (cocFar > 0.0001) { // far blur

            let farTextureSize: vec2f = vec2f(textureDimensions(farTexture, 0));
            let step: vec2f = cocFar * uniform.blurRadiusFar / farTextureSize;

            var sumCoC: f32 = 0.0;
            for (var i: i32 = 0; i < {KERNEL_COUNT}; i = i + 1) {
                let uv: vec2f = uv0 + step * uniform.kernel[i].element;
                var tap: vec3f = textureSampleLevel(farTexture, farTextureSampler, uv, 0.0).rgb;

                // block out sharp objects to avoid leaking to far blur
                let cocThis: f32 = textureSampleLevel(cocTexture, cocTextureSampler, uv, 0.0).r;
                tap = tap * cocThis;
                sumCoC = sumCoC + cocThis;

                sum = sum + tap;
            }

            // average out the sum
            if (sumCoC > 0.0) {
                sum = sum / sumCoC;
            }

            // compensate for the fact the farTexture was premultiplied by CoC
            sum = sum / cocFar;
        }

    output.color = vec4f(sum, 1.0);
    return output;
}
`;
