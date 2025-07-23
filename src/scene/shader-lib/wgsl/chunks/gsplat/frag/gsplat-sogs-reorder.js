export default /* wgsl */`
    var means_l: texture_2d<f32>;
    var means_u: texture_2d<f32>;
    var quats: texture_2d<f32>;
    var scales: texture_2d<f32>;
    var sh_labels: texture_2d<f32>;

    uniform numSplats: u32;

    fn packU32(v: vec4<f32>) -> u32 {
        return (u32(v.x * 255.0) << 24u)  |
               (u32(v.y * 255.0) << 16u)  |
               (u32(v.z * 255.0) << 8u) |
               u32(v.w * 255.0);
    }

    fn packUVec32(a: vec4<f32>, b: vec4<f32>, c: vec4<f32>, d: vec4<f32>) -> vec4<u32> {
        return vec4<u32>(packU32(a), packU32(b), packU32(c), packU32(d));
    }

    @fragment
    fn fragmentMain(input: FragmentInput) -> FragmentOutput {
        var output: FragmentOutput;

        let w: u32 = textureDimensions(means_l, 0).x;
        let uv: vec2<u32> = vec2<u32>(pcPosition.xy);
        if (uv.x + uv.y * w >= uniform.numSplats) {
            discard;
            return output;
        }

        // fetch the source index and calculate source uv
        let meansLSample: vec3<f32> = textureLoad(means_l, uv, 0).xyz;
        let meansUSample: vec3<f32> = textureLoad(means_u, uv, 0).xyz;
        let quatsSample: vec4<f32> = textureLoad(quats, uv, 0);
        let scalesSample: vec3<f32> = textureLoad(scales, uv, 0).xyz;
        let shLabelsSample: vec2<f32> = textureLoad(sh_labels, uv, 0).xy;

        output.color = packUVec32(
            vec4(meansLSample, shLabelsSample.x),
            vec4(meansUSample, shLabelsSample.y),
            vec4(quatsSample),
            vec4(scalesSample, 0.0)
        );

        return output;
    }
`;
