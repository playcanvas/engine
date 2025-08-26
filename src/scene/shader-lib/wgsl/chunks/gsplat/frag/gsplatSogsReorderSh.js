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
    output.color = unpack8888(pack111110(resolveCodebook(shNSample, &uniform.shN_codebook)));
#endif

    return output;
}
`;
