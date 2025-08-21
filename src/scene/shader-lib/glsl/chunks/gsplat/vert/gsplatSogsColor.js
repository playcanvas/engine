export default /* glsl */`
uniform mediump sampler2D packedSh0;

uniform float sh0_mins;
uniform float sh0_maxs;

float SH_C0 = 0.28209479177387814;

uint pack8888(vec4 v) {
    uvec4 t = uvec4(v * 255.0) << uvec4(24u, 16u, 8u, 0u);
    return t.x | t.y | t.z | t.w;
}

vec3 unpack111110(uint v) {
    return vec3((uvec3(v) >> uvec3(21u, 10u, 0u)) & uvec3(0x7ffu, 0x7ffu, 0x3ffu)) / vec3(2047.0, 2047.0, 1023.0);
}

vec4 readColor(in SplatSource source) {
    vec3 clr = mix(vec3(sh0_mins), vec3(sh0_maxs), unpack111110(pack8888(texelFetch(packedSh0, source.uv, 0))));
    float alpha = float(((packedSample.z & 0x3fu) << 2) + (packedSample.w & 0x3u)) / 255.0;
    return vec4(vec3(0.5) + clr.xyz * SH_C0, alpha);
}
`;
