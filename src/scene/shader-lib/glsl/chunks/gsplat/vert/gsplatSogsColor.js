export default /* glsl */`
uniform mediump sampler2D sh0;
uniform highp sampler2D sh_labels;
uniform mediump sampler2D sh_result;

uniform vec4 sh0_mins;
uniform vec4 sh0_maxs;

float SH_C0 = 0.28209479177387814;

vec4 readColor(in SplatSource source) {
    // sample base color
    vec4 baseSample = mix(sh0_mins, sh0_maxs, texelFetch(sh0, source.uv, 0));

    // resolve base color
    vec4 base = vec4(vec3(0.5) + baseSample.xyz * SH_C0, 1.0 / (1.0 + exp(-baseSample.w)));

    // extract spherical harmonics palette index
    ivec2 labelSample = ivec2(texelFetch(sh_labels, source.uv, 0).xy * 255.0);
    int n = labelSample.x + labelSample.y * 256;

    vec3 shSample = texelFetch(sh_result, ivec2(n % 64, n / 64), 0).xyz;
    vec3 sh = (shSample - vec3(0.5)) * 4.0;

    return vec4(base.xyz + sh, base.w);
}
`;
