export default /* wgsl */`
var sourceTexture: texture_2d<f32>;
var sourceTextureSampler: sampler;
uniform sourceInvResolution: vec2f;
varying uv0: vec2f;

#ifdef PREMULTIPLY
    var premultiplyTexture: texture_2d<f32>;
    var premultiplyTextureSampler: sampler;
#endif

@fragment
fn fragmentMain(input: FragmentInput) -> FragmentOutput {
    var output: FragmentOutput;

    let e: vec3f = textureSample(sourceTexture, sourceTextureSampler, input.uv0).rgb;

    #ifdef BOXFILTER
        var value: vec3f = e;

        #ifdef PREMULTIPLY
            let premultiply: f32 = textureSample(premultiplyTexture, premultiplyTextureSampler, input.uv0).{PREMULTIPLY_SRC_CHANNEL};
            value = value * vec3f(premultiply);
        #endif
    #else

        let x: f32 = uniform.sourceInvResolution.x;
        let y: f32 = uniform.sourceInvResolution.y;

        let a: vec3f = textureSample(sourceTexture, sourceTextureSampler, vec2f(input.uv0.x - 2.0 * x, input.uv0.y + 2.0 * y)).rgb;
        let b: vec3f = textureSample(sourceTexture, sourceTextureSampler, vec2f(input.uv0.x,           input.uv0.y + 2.0 * y)).rgb;
        let c: vec3f = textureSample(sourceTexture, sourceTextureSampler, vec2f(input.uv0.x + 2.0 * x, input.uv0.y + 2.0 * y)).rgb;

        let d: vec3f = textureSample(sourceTexture, sourceTextureSampler, vec2f(input.uv0.x - 2.0 * x, input.uv0.y)).rgb;
        let f: vec3f = textureSample(sourceTexture, sourceTextureSampler, vec2f(input.uv0.x + 2.0 * x, input.uv0.y)).rgb;

        let g: vec3f = textureSample(sourceTexture, sourceTextureSampler, vec2f(input.uv0.x - 2.0 * x, input.uv0.y - 2.0 * y)).rgb;
        let h: vec3f = textureSample(sourceTexture, sourceTextureSampler, vec2f(input.uv0.x,           input.uv0.y - 2.0 * y)).rgb;
        let i: vec3f = textureSample(sourceTexture, sourceTextureSampler, vec2f(input.uv0.x + 2.0 * x, input.uv0.y - 2.0 * y)).rgb;

        let j: vec3f = textureSample(sourceTexture, sourceTextureSampler, vec2f(input.uv0.x - x, input.uv0.y + y)).rgb;
        let k: vec3f = textureSample(sourceTexture, sourceTextureSampler, vec2f(input.uv0.x + x, input.uv0.y + y)).rgb;
        let l: vec3f = textureSample(sourceTexture, sourceTextureSampler, vec2f(input.uv0.x - x, input.uv0.y - y)).rgb;
        let m: vec3f = textureSample(sourceTexture, sourceTextureSampler, vec2f(input.uv0.x + x, input.uv0.y - y)).rgb;

        var value: vec3f = e * 0.125;
        value = value + (a + c + g + i) * 0.03125;
        value = value + (b + d + f + h) * 0.0625;
        value = value + (j + k + l + m) * 0.125;
    #endif

    #ifdef REMOVE_INVALID
        value = max(value, vec3f(0.0));
    #endif

    output.color = vec4f(value, 1.0);
    return output;
}
`;
