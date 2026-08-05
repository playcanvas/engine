export default /* wgsl */`
    #include "screenDepthPS"

    varying uv0: vec2f;

    var uFogTexture: texture_2d<f32>;
    var uFogTextureSampler: sampler;
    uniform uFogTextureSize: vec4f; // xy: fog texture resolution, zw: inverse resolution

    @fragment
    fn fragmentMain(input: FragmentInput) -> FragmentOutput {
        var output: FragmentOutput;

        let depth: f32 = getLinearScreenDepth(input.uv0);

        // 4 nearest texel centers of the low resolution fog texture
        let texel: vec2f = input.uv0 * uniform.uFogTextureSize.xy - 0.5;
        let base: vec2f = (floor(texel) + 0.5) * uniform.uFogTextureSize.zw;
        let f: vec2f = fract(texel);

        var uvs: array<vec2f, 4>;
        uvs[0] = base;
        uvs[1] = base + vec2f(uniform.uFogTextureSize.z, 0.0);
        uvs[2] = base + vec2f(0.0, uniform.uFogTextureSize.w);
        uvs[3] = base + uniform.uFogTextureSize.zw;

        let bilinear: vec4f = vec4f((1.0 - f.x) * (1.0 - f.y), f.x * (1.0 - f.y), (1.0 - f.x) * f.y, f.x * f.y);

        // depth-aware upsample - weight the low resolution fog samples by depth similarity to
        // avoid fog leaking across geometry edges
        var sum: vec4f = vec4f(0.0);
        var sumWeight: f32 = 0.0;
        for (var i: i32 = 0; i < 4; i += 1) {
            let sampleDepth: f32 = getLinearScreenDepth(uvs[i]);
            let w: f32 = bilinear[i] / (1.0 + 16.0 * abs(sampleDepth - depth) / max(depth, 0.001));
            sum += textureSampleLevel(uFogTexture, uFogTextureSampler, uvs[i], 0.0) * w;
            sumWeight += w;
        }

        // rgb: in-scattered light, a: transmittance. Blended over the scene using
        // scene * transmittance + inscatter.
        output.color = sum / max(sumWeight, 0.0001);
        return output;
    }
`;
