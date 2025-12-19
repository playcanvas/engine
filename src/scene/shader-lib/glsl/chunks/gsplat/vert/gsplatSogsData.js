export default /* glsl */`
#include "gsplatPackingPS"

uniform highp usampler2D packedTexture;

uniform vec3 means_mins;
uniform vec3 means_maxs;

uniform float scales_mins;
uniform float scales_maxs;

uvec4 packedSample;

// read the model-space center of the gaussian
vec3 readCenter(SplatSource source) {

    // read the packed texture sample
    packedSample = texelFetch(packedTexture, source.uv, 0);

    vec3 l = unpack8888(packedSample.x).xyz;
    vec3 u = unpack8888(packedSample.y).xyz;
    vec3 n = (l + u * 256.0) / 257.0;
    vec3 v = mix(means_mins, means_maxs, n);

    return sign(v) * (exp(abs(v)) - 1.0);
}

const float norm = sqrt(2.0);

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
`;
