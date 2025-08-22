export default /* glsl */`
#include "gsplatPackingPS"

uniform highp sampler2D means_l;
uniform highp sampler2D means_u;
uniform highp sampler2D quats;
uniform highp sampler2D scales;
uniform highp sampler2D sh0;
uniform highp sampler2D sh_labels;

uniform highp uint numSplats;

uniform vec4 scales_codebook[64];
uniform vec4 sh0_codebook[64];

void main(void) {
    int w = int(textureSize(means_l, 0).x);
    ivec2 uv = ivec2(gl_FragCoord.xy);
    if (uint(uv.x + uv.y * w) >= numSplats) {
        discard;
    }

    vec3 meansLSample   = texelFetch(means_l, uv, 0).xyz;
    vec3 meansUSample   = texelFetch(means_u, uv, 0).xyz;
    vec4 quatsSample    = texelFetch(quats, uv, 0);
    vec3 scalesSample   = texelFetch(scales, uv, 0).xyz;
    vec4 sh0Sample      = texelFetch(sh0, uv, 0);
    vec2 shLabelsSample = texelFetch(sh_labels, uv, 0).xy;

    uint scale = pack101010(resolveCodebook(scalesSample, scales_codebook));    // resolve scale to 10,10,10 bits
    uint sh0 = pack111110(resolveCodebook(sh0Sample.xyz, sh0_codebook));        // resolve sh0 to 11,11,10 bits
    uint alpha = uint(sh0Sample.w * 255.0);
    uint qmode = uint(quatsSample.w * 255.0) - 252u;

    pcFragColor0 = uvec4(
        pack8888(vec4(meansLSample, shLabelsSample.x)),
        pack8888(vec4(meansUSample, shLabelsSample.y)),
        pack8888(vec4(quatsSample.xyz, 0.0)) | (qmode << 6) | (alpha >> 2u),
        (scale << 2u) | (alpha & 0x3u)
    );
    pcFragColor1 = unpack8888(sh0);
}
`;
