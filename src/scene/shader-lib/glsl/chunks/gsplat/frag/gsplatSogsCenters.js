export default /* glsl */`
#include "gsplatPackingPS"

uniform highp sampler2D means_l;
uniform highp sampler2D means_u;

uniform highp uint numSplats;
uniform highp vec3 means_mins;
uniform highp vec3 means_maxs;

void main(void) {
    int w = int(textureSize(means_l, 0).x);
    ivec2 uv = ivec2(gl_FragCoord.xy);
    if (uint(uv.x + uv.y * w) >= numSplats) {
        discard;
    }

    vec3 l = texelFetch(means_l, uv, 0).xyz;
    vec3 u = texelFetch(means_u, uv, 0).xyz;
    vec3 n = (l + u * 256.0) / 257.0;
    vec3 v = mix(means_mins, means_maxs, n);
    vec3 center = sign(v) * (exp(abs(v)) - 1.0);

    // store float bits into u32 RGBA, alpha unused
    pcFragColor0 = uvec4(floatBitsToUint(center), 0u);
}
`;
