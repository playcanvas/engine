export default /* glsl */`
uniform highp sampler2D packedSh0;

uniform float sh0_mins;
uniform float sh0_maxs;

float SH_C0 = 0.28209479177387814;

vec4 readColor(in SplatSource source) {
    vec3 clr = mix(vec3(sh0_mins), vec3(sh0_maxs), unpack111110(pack8888(texelFetch(packedSh0, source.uv, 0))));
    float alpha = float(packedSample.z & 0xffu) / 255.0;
    return vec4(vec3(0.5) + clr.xyz * SH_C0, alpha);
}
`;
