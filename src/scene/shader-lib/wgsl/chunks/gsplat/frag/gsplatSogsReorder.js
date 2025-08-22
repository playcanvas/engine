export default /* wgsl */`
    #include "gsplatPackingPS"

    var means_l: texture_2d<f32>;
    var means_u: texture_2d<f32>;
    var quats: texture_2d<f32>;
    var scales: texture_2d<f32>;
    var sh0: texture_2d<f32>;
    var sh_labels: texture_2d<f32>;

    uniform numSplats: u32;

    uniform scales_codebook: array<vec4f, 64>;
    uniform sh0_codebook: array<vec4f, 64>;

    @fragment
    fn fragmentMain(input: FragmentInput) -> FragmentOutput {
        var output: FragmentOutput;

        let w: u32 = textureDimensions(means_l, 0).x;
        let uv: vec2<u32> = vec2<u32>(input.position.xy);
        if (uv.x + uv.y * w >= uniform.numSplats) {
            discard;
            return output;
        }

        // fetch the source index and calculate source uv
        let meansLSample: vec3<f32> = textureLoad(means_l, uv, 0).xyz;
        let meansUSample: vec3<f32> = textureLoad(means_u, uv, 0).xyz;
        let quatsSample: vec4<f32> = textureLoad(quats, uv, 0);
        let scalesSample: vec3<f32> = textureLoad(scales, uv, 0).xyz;
        let sh0Sample: vec4f = textureLoad(sh0, uv, 0);
        let shLabelsSample: vec2<f32> = textureLoad(sh_labels, uv, 0).xy;

        let scale = pack101010(resolveCodebook(scalesSample, &uniform.scales_codebook));    // resolve scale to 10,10,10 bits
        let sh0 = pack111110(resolveCodebook(sh0Sample.xyz, &uniform.sh0_codebook));        // resolve sh0 to 11,11,10 bits
        let alpha = u32(sh0Sample.w * 255.0);
        let qmode = u32(quatsSample.w * 255.0) - 252u;

        output.color = vec4u(
            pack8888(vec4f(meansLSample, shLabelsSample.x)),
            pack8888(vec4f(meansUSample, shLabelsSample.y)),
            pack8888(vec4f(quatsSample.xyz, 0.0)) | (qmode << 6) | (alpha >> 2u),
            (scale << 2u) | (alpha & 0x3u)
        );

        output.color1 = unpack8888(sh0);

        return output;
    }
`;
