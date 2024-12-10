export default /* glsl */`
#if SH_BANDS > 0

uniform highp usampler2D shTexture0;
uniform highp usampler2D shTexture1;
uniform highp usampler2D shTexture2;

vec4 unpack8888s(in uint bits) {
    return vec4((uvec4(bits) >> uvec4(0u, 8u, 16u, 24u)) & 0xffu) * (8.0 / 255.0) - 4.0;
}

void readSHData(in SplatSource source, out vec3 sh[15], out float scale) {
    // read the sh coefficients
    uvec4 shData0 = texelFetch(shTexture0, source.uv, 0);
    uvec4 shData1 = texelFetch(shTexture1, source.uv, 0);
    uvec4 shData2 = texelFetch(shTexture2, source.uv, 0);

    vec4 r0 = unpack8888s(shData0.x);
    vec4 r1 = unpack8888s(shData0.y);
    vec4 r2 = unpack8888s(shData0.z);
    vec4 r3 = unpack8888s(shData0.w);

    vec4 g0 = unpack8888s(shData1.x);
    vec4 g1 = unpack8888s(shData1.y);
    vec4 g2 = unpack8888s(shData1.z);
    vec4 g3 = unpack8888s(shData1.w);

    vec4 b0 = unpack8888s(shData2.x);
    vec4 b1 = unpack8888s(shData2.y);
    vec4 b2 = unpack8888s(shData2.z);
    vec4 b3 = unpack8888s(shData2.w);

    sh[0] =  vec3(r0.x, g0.x, b0.x);
    sh[1] =  vec3(r0.y, g0.y, b0.y);
    sh[2] =  vec3(r0.z, g0.z, b0.z);
    sh[3] =  vec3(r0.w, g0.w, b0.w);
    sh[4] =  vec3(r1.x, g1.x, b1.x);
    sh[5] =  vec3(r1.y, g1.y, b1.y);
    sh[6] =  vec3(r1.z, g1.z, b1.z);
    sh[7] =  vec3(r1.w, g1.w, b1.w);
    sh[8] =  vec3(r2.x, g2.x, b2.x);
    sh[9] =  vec3(r2.y, g2.y, b2.y);
    sh[10] = vec3(r2.z, g2.z, b2.z);
    sh[11] = vec3(r2.w, g2.w, b2.w);
    sh[12] = vec3(r3.x, g3.x, b3.x);
    sh[13] = vec3(r3.y, g3.y, b3.y);
    sh[14] = vec3(r3.z, g3.z, b3.z);

    scale = 1.0;
}

#endif
`;
