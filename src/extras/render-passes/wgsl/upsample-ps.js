export default /* wgsl */`
    var sourceTexture: texture_2d<f32>;
    var sourceTextureSampler: sampler;
    uniform sourceInvResolution: vec2f;
    varying uv0: vec2f;

    @fragment
    fn fragmentMain(input: FragmentInput) -> FragmentOutput {
        var output: FragmentOutput;

        let x: f32 = uniform.sourceInvResolution.x;
        let y: f32 = uniform.sourceInvResolution.y;

        let a: half3 = half3(textureSample(sourceTexture, sourceTextureSampler, vec2f(input.uv0.x - x, input.uv0.y + y)).rgb);
        let b: half3 = half3(textureSample(sourceTexture, sourceTextureSampler, vec2f(input.uv0.x,     input.uv0.y + y)).rgb);
        let c: half3 = half3(textureSample(sourceTexture, sourceTextureSampler, vec2f(input.uv0.x + x, input.uv0.y + y)).rgb);

        let d: half3 = half3(textureSample(sourceTexture, sourceTextureSampler, vec2f(input.uv0.x - x, input.uv0.y)).rgb);
        let e: half3 = half3(textureSample(sourceTexture, sourceTextureSampler, vec2f(input.uv0.x,     input.uv0.y)).rgb);
        let f: half3 = half3(textureSample(sourceTexture, sourceTextureSampler, vec2f(input.uv0.x + x, input.uv0.y)).rgb);

        let g: half3 = half3(textureSample(sourceTexture, sourceTextureSampler, vec2f(input.uv0.x - x, input.uv0.y - y)).rgb);
        let h: half3 = half3(textureSample(sourceTexture, sourceTextureSampler, vec2f(input.uv0.x,     input.uv0.y - y)).rgb);
        let i: half3 = half3(textureSample(sourceTexture, sourceTextureSampler, vec2f(input.uv0.x + x, input.uv0.y - y)).rgb);

        var value: half3 = e * half(0.25);
        value += (b + d + f + h) * half(0.125);
        value += (a + c + g + i) * half(0.0625);

        output.color = vec4f(vec3f(value), 1.0);
        return output;
    }
`;
