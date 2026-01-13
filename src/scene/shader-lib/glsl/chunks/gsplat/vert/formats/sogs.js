// SOGS GSplat format - work variables, helpers, and read functions
// packedTexture is auto-generated from GSplatFormat streams
export default /* glsl */`
#include "gsplatPackingPS"

// uniform declarations for dequantization
uniform vec3 means_mins;
uniform vec3 means_maxs;

uniform float scales_mins;
uniform float scales_maxs;

// SH0 color uniforms and texture
uniform float sh0_mins;
uniform float sh0_maxs;
uniform highp sampler2D packedSh0;

// SH_C0 coefficient for 0th degree spherical harmonic
const float SH_C0 = 0.28209479177387814;

// work value
uvec4 packedSample;

const float norm = sqrt(2.0);

// read the model-space center of the gaussian
vec3 readCenter(SplatSource source) {
    // Initialize splatUV for generated load functions
    splatUV = source.uv;

    // read the packed texture sample using generated load function
    packedSample = loadPackedTexture();

    vec3 l = unpack8888(packedSample.x).xyz;
    vec3 u = unpack8888(packedSample.y).xyz;
    vec3 n = (l + u * 256.0) / 257.0;
    vec3 v = mix(means_mins, means_maxs, n);

    return sign(v) * (exp(abs(v)) - 1.0);
}

vec4 readColor(in SplatSource source) {
    vec3 clr = mix(vec3(sh0_mins), vec3(sh0_maxs), unpack111110(pack8888(texelFetch(packedSh0, source.uv, 0))));
    float alpha = float(packedSample.z & 0xffu) / 255.0;
    return vec4(vec3(0.5) + clr * SH_C0, alpha);
}

vec4 getRotation() {
    // decode rotation quaternion
    vec3 qdata = unpack8888(packedSample.z).xyz;
    uint qmode = packedSample.w & 0x3u;
    vec3 abc = (qdata - 0.5) * norm;
    float d = sqrt(max(0.0, 1.0 - dot(abc, abc)));

    return (qmode == 0u) ? vec4(d, abc) :
           ((qmode == 1u) ? vec4(abc.x, d, abc.yz) :
           ((qmode == 2u) ? vec4(abc.xy, d, abc.z) : vec4(abc, d)));
}

vec3 getScale() {
    vec3 sdata = unpack101010(packedSample.w >> 2u);
    return exp(mix(vec3(scales_mins), vec3(scales_maxs), sdata));
}

#include "gsplatSogsSHVS"
`;
