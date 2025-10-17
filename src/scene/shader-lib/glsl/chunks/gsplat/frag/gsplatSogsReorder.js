export default /* glsl */`
#include "gsplatPackingPS"

uniform highp sampler2D means_l;
uniform highp sampler2D means_u;
uniform highp sampler2D quats;
uniform highp sampler2D scales;
uniform highp sampler2D sh0;
uniform highp sampler2D sh_labels;

uniform highp uint numSplats;

#ifdef REORDER_V1
    float sigmoid(float x) { return 1.0 / (1.0 + exp(-x)); }
    vec3 vmin(vec3 v) { return vec3(min(min(v.x, v.y), v.z)); }
    vec3 vmax(vec3 v) { return vec3(max(max(v.x, v.y), v.z)); }
    vec3 resolve(vec3 m, vec3 M, vec3 v) { return (mix(m, M, v) - vmin(m)) / (vmax(M) - vmin(m)); }
    
    uniform vec3 scalesMins;
    uniform vec3 scalesMaxs;
    uniform vec4 sh0Mins;
    uniform vec4 sh0Maxs;
#else
    uniform vec4 scales_codebook[64];
    uniform vec4 sh0_codebook[64];
#endif

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

    #ifdef REORDER_V1
        uint scale = pack101010(resolve(scalesMins, scalesMaxs, scalesSample));
        uint sh0 = pack111110(resolve(sh0Mins.xyz, sh0Maxs.xyz, sh0Sample.xyz));
        float alpha = sigmoid(mix(sh0Mins.w, sh0Maxs.w, sh0Sample.w));
    #else
        uint scale = pack101010(resolveCodebook(scalesSample, scales_codebook));    // resolve scale to 10,10,10 bits
        uint sh0 = pack111110(resolveCodebook(sh0Sample.xyz, sh0_codebook));        // resolve sh0 to 11,11,10 bits
        float alpha = sh0Sample.w;
    #endif

    uint qmode = uint(quatsSample.w * 255.0) - 252u;

    pcFragColor0 = uvec4(
        pack8888(vec4(meansLSample, shLabelsSample.x)),
        pack8888(vec4(meansUSample, shLabelsSample.y)),
        pack8888(vec4(quatsSample.xyz, alpha)),
        (scale << 2u) | qmode
    );
    pcFragColor1 = unpack8888(sh0);
}
`;
