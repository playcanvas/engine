export default /* wgsl */`
#include "gsplatPackingPS"

var means_l: texture_2d<f32>;
var means_u: texture_2d<f32>;
var quats: texture_2d<f32>;
var scales: texture_2d<f32>;
var sh0: texture_2d<f32>;
var sh_labels: texture_2d<f32>;

uniform numSplats: u32;

#ifdef REORDER_V1
    fn sigmoid(x: f32) -> f32 { return 1.0 / (1.0 + exp(-x)); }
    fn vmin(v: vec3f) -> vec3f { return vec3f(min(min(v.x, v.y), v.z)); }
    fn vmax(v: vec3f) -> vec3f { return vec3f(max(max(v.x, v.y), v.z)); }
    fn resolve(m: vec3f, M: vec3f, v: vec3f) -> vec3f { return (mix(m, M, v) - vmin(m)) / (vmax(M) - vmin(m)); }

    uniform scalesMins: vec3f;
    uniform scalesMaxs: vec3f;
    uniform sh0Mins: vec4f;
    uniform sh0Maxs: vec4f;
#else
    uniform scales_codebook: array<vec4f, 64>;
    uniform sh0_codebook: array<vec4f, 64>;
#endif

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

    #ifdef REORDER_V1
        let scale = pack101010(resolve(uniform.scalesMins, uniform.scalesMaxs, scalesSample));
        let sh0 = pack111110(resolve(uniform.sh0Mins.xyz, uniform.sh0Maxs.xyz, sh0Sample.xyz));
        let alpha = sigmoid(mix(uniform.sh0Mins.w, uniform.sh0Maxs.w, sh0Sample.w));
    #else
        // resolve scale codebook to 10,10,10 bits
        let scalesIdx = vec3u(scalesSample * 255.0);
        let scalesV = vec3f(
            uniform.scales_codebook[scalesIdx.x >> 2u][scalesIdx.x & 3u],
            uniform.scales_codebook[scalesIdx.y >> 2u][scalesIdx.y & 3u],
            uniform.scales_codebook[scalesIdx.z >> 2u][scalesIdx.z & 3u]
        );
        let scale = pack101010((scalesV - uniform.scales_codebook[0].x) / (uniform.scales_codebook[63].w - uniform.scales_codebook[0].x));

        // resolve sh0 codebook to 11,11,10 bits
        let sh0Idx = vec3u(sh0Sample.xyz * 255.0);
        let sh0V = vec3f(
            uniform.sh0_codebook[sh0Idx.x >> 2u][sh0Idx.x & 3u],
            uniform.sh0_codebook[sh0Idx.y >> 2u][sh0Idx.y & 3u],
            uniform.sh0_codebook[sh0Idx.z >> 2u][sh0Idx.z & 3u]
        );
        let sh0 = pack111110((sh0V - uniform.sh0_codebook[0].x) / (uniform.sh0_codebook[63].w - uniform.sh0_codebook[0].x));
        let alpha = sh0Sample.w;
    #endif

    let qmode = u32(quatsSample.w * 255.0) - 252u;

    output.color = vec4u(
        pack8888(vec4f(meansLSample, shLabelsSample.x)),
        pack8888(vec4f(meansUSample, shLabelsSample.y)),
        pack8888(vec4f(quatsSample.xyz, alpha)),
        (scale << 2u) | qmode
    );

    output.color1 = unpack8888(sh0);

    return output;
}
`;
