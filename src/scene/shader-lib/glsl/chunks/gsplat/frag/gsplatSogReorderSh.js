export default /* glsl */`
#include "gsplatPackingPS"

uniform highp sampler2D sh_centroids;

uniform vec4 shN_codebook[64];

void main(void) {
    ivec2 uv = ivec2(gl_FragCoord.xy);

    vec3 shNSample = texelFetch(sh_centroids, uv, 0).xyz;

#ifdef REORDER_V1
    pcFragColor0 = unpack8888(pack111110(shNSample));
#else
    pcFragColor0 = unpack8888(pack111110(resolveCodebook(shNSample, shN_codebook)));
#endif
}
`;
