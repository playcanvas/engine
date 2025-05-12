export default /* glsl */`
uniform mediump sampler2D sh0;

uniform vec4 sh0_mins;
uniform vec4 sh0_maxs;

float SH_C0 = 0.28209479177387814;

vec4 readColor(in SplatSource source) {
    vec4 clr = mix(sh0_mins, sh0_maxs, texelFetch(sh0, source.uv, 0));
    return vec4(vec3(0.5) + clr.xyz * SH_C0, 1.0 / (1.0 + exp(-clr.w)));
}
`;
