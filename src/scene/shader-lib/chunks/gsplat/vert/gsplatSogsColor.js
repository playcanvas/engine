export default /* glsl */`
uniform mediump sampler2D sh0;
uniform mediump sampler2D opacities;

uniform vec3 sh0_mins;
uniform vec3 sh0_maxs;

uniform float opacities_mins;
uniform float opacities_maxs;

float SH_C0 = 0.28209479177387814;

vec4 readColor(in SplatSource source) {
    vec3 clr = mix(sh0_mins, sh0_maxs, texelFetch(sh0, source.uv, 0).xyz);
    float opacity = mix(opacities_mins, opacities_maxs, texelFetch(opacities, source.uv, 0).x);

    return vec4(vec3(0.5) + clr * SH_C0, 1.0 / (1.0 + exp(opacity * -1.0)));
}
`;
