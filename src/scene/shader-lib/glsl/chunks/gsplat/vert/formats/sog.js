// SOG GSplat format - reads directly from source textures (no packed texture step)
export default /* glsl */`
// means dequantization (both V1 and V2)
uniform vec3 means_mins;
uniform vec3 means_maxs;

#ifndef SOG_V2
    // V1: linear min/max dequantization (no codebooks)
    uniform vec3 scales_mins;
    uniform vec3 scales_maxs;
    uniform vec4 sh0_mins;
    uniform vec4 sh0_maxs;
#endif

// SH_C0 coefficient for 0th degree spherical harmonic
const float SH_C0 = 0.28209479177387814;
const float norm = sqrt(2.0);

#ifdef SOG_V2
    // 256x1 RGBA32F LUT:
    //   .r = scales codebook, .g = sh0 codebook, .b = shN codebook, .a unused
    float lutScales(int b) { return texelFetch(sogCodebook, ivec2(b, 0), 0).r; }
    float lutSh0(int b)    { return texelFetch(sogCodebook, ivec2(b, 0), 0).g; }
    float lutShN(int b)    { return texelFetch(sogCodebook, ivec2(b, 0), 0).b; }
#endif

// read the model-space center of the gaussian (16-bit per-axis, low + high byte)
vec3 getCenter() {
    vec3 l = texelFetch(means_l, splat.uv, 0).xyz;
    vec3 u = texelFetch(means_u, splat.uv, 0).xyz;
    vec3 n = (l + u * 256.0) / 257.0;
    vec3 v = mix(means_mins, means_maxs, n);
    return sign(v) * (exp(abs(v)) - 1.0);
}

// decode rotation quaternion (3 components + 2-bit mode selecting the omitted axis)
vec4 getRotation() {
    vec4 q = texelFetch(quats, splat.uv, 0);
    uint qmode = uint(q.w * 255.0 + 0.5) - 252u;
    vec3 abc = (q.xyz - 0.5) * norm;
    float d = sqrt(max(0.0, 1.0 - dot(abc, abc)));
    return (qmode == 0u) ? vec4(d, abc) :
           ((qmode == 1u) ? vec4(abc.x, d, abc.yz) :
           ((qmode == 2u) ? vec4(abc.xy, d, abc.z) : vec4(abc, d)));
}

vec3 getScale() {
    vec3 s = texelFetch(scales, splat.uv, 0).xyz;
    #ifdef SOG_V2
        ivec3 i = ivec3(s * 255.0 + 0.5);
        vec3 logS = vec3(lutScales(i.x), lutScales(i.y), lutScales(i.z));
    #else
        vec3 logS = mix(scales_mins, scales_maxs, s);
    #endif
    return exp(logS);
}

vec4 getColor() {
    vec4 c = texelFetch(sh0, splat.uv, 0);
    #ifdef SOG_V2
        ivec3 i = ivec3(c.xyz * 255.0 + 0.5);
        vec3 rgb = vec3(lutSh0(i.x), lutSh0(i.y), lutSh0(i.z));
        float alpha = c.w;
    #else
        vec3 rgb = mix(sh0_mins.xyz, sh0_maxs.xyz, c.xyz);
        float logitAlpha = mix(sh0_mins.w, sh0_maxs.w, c.w);
        float alpha = 1.0 / (1.0 + exp(-logitAlpha));
    #endif
    return vec4(vec3(0.5) + rgb * SH_C0, alpha);
}

#include "gsplatSogSHVS"
`;
