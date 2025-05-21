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

        let a: vec3f = textureSample(sourceTexture, sourceTextureSampler, vec2f(input.uv0.x - x, input.uv0.y + y)).rgb;
        let b: vec3f = textureSample(sourceTexture, sourceTextureSampler, vec2f(input.uv0.x,     input.uv0.y + y)).rgb;
        let c: vec3f = textureSample(sourceTexture, sourceTextureSampler, vec2f(input.uv0.x + x, input.uv0.y + y)).rgb;

        let d: vec3f = textureSample(sourceTexture, sourceTextureSampler, vec2f(input.uv0.x - x, input.uv0.y)).rgb;
        let e: vec3f = textureSample(sourceTexture, sourceTextureSampler, vec2f(input.uv0.x,     input.uv0.y)).rgb;
        let f: vec3f = textureSample(sourceTexture, sourceTextureSampler, vec2f(input.uv0.x + x, input.uv0.y)).rgb;

        let g: vec3f = textureSample(sourceTexture, sourceTextureSampler, vec2f(input.uv0.x - x, input.uv0.y - y)).rgb;
        let h: vec3f = textureSample(sourceTexture, sourceTextureSampler, vec2f(input.uv0.x,     input.uv0.y - y)).rgb;
        let i: vec3f = textureSample(sourceTexture, sourceTextureSampler, vec2f(input.uv0.x + x, input.uv0.y - y)).rgb;

        var value: vec3f = e * 4.0;
        value = value + (b + d + f + h) * 2.0;
        value = value + (a + c + g + i);
        value = value * (1.0 / 16.0);

        output.color = vec4f(value, 1.0);
        return output;
    }
`;
