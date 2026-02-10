export default /* wgsl */`
#include "gsplatPackingPS"

var sh_centroids: texture_2d<f32>;

uniform shN_codebook: array<vec4f, 64>;

@fragment
fn fragmentMain(input: FragmentInput) -> FragmentOutput {
    var output: FragmentOutput;

    var uv = vec2i(input.position.xy);

    var shNSample = textureLoad(sh_centroids, uv, 0).xyz;

#ifdef REORDER_V1
    output.color = unpack8888(pack111110(shNSample));
#else
    // resolve shN codebook
    let shNIdx = vec3u(shNSample * 255.0);
    let shNV = vec3f(
        uniform.shN_codebook[shNIdx.x >> 2u][shNIdx.x & 3u],
        uniform.shN_codebook[shNIdx.y >> 2u][shNIdx.y & 3u],
        uniform.shN_codebook[shNIdx.z >> 2u][shNIdx.z & 3u]
    );
    output.color = unpack8888(pack111110((shNV - uniform.shN_codebook[0].x) / (uniform.shN_codebook[63].w - uniform.shN_codebook[0].x)));
#endif

    return output;
}
`;
