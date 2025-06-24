export default /* glsl */`
uniform mediump sampler2D sh0;
uniform highp sampler2D sh_labels;
uniform mediump sampler2D sh_result;

uniform vec4 sh0_mins;
uniform vec4 sh0_maxs;

float SH_C0 = 0.28209479177387814;

// unpack 11, 11, 10 normalized value from rgba8 texture sample
vec3 unpackRgb(vec4 v) {
    uvec4 uv = uvec4(v * 255.0);
    uint bits = (uv.x << 24) | (uv.y << 16) | (uv.z << 8) | uv.w;
    uvec3 vb = (uvec3(bits) >> uvec3(21, 10, 0)) & uvec3(0x7ffu, 0x7ffu, 0x3ffu);
    return vec3(vb) / vec3(2047.0, 2047.0, 1023.0);
}

vec4 readColor(in SplatSource source) {
    // sample base color
    vec4 baseSample = mix(sh0_mins, sh0_maxs, texelFetch(sh0, source.uv, 0));

    // resolve base color
    vec4 base = vec4(vec3(0.5) + baseSample.xyz * SH_C0, 1.0 / (1.0 + exp(-baseSample.w)));

    // extract spherical harmonics palette index
    ivec2 labelSample = ivec2(texelFetch(sh_labels, source.uv, 0).xy * 255.0);
    int n = labelSample.x + labelSample.y * 256;

    vec4 shSample = texelFetch(sh_result, ivec2(n % 64, n / 64), 0);
    vec3 sh = (unpackRgb(shSample) - vec3(0.5)) * 4.0;

    return vec4(base.xyz + sh, base.w);
}
`;
