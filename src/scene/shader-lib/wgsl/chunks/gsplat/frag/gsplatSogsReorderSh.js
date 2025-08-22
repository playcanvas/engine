export default /* wgsl */`
#include "gsplatPackingPS"

var sh_centroids: texture_2d<f32>;

uniform shN_codebook: array<vec4f, 64>;

@fragment
fn fragmentMain(input: FragmentInput) -> FragmentOutput {
    var output: FragmentOutput;

    var uv = vec2i(pcPosition.xy);

    var shNSample = textureLoad(sh_centroids, uv, 0).xyz;

    output.color = unpack8888(pack111110(resolveCodebook(shNSample, &uniform.shN_codebook)));

    return output;
}
`;
