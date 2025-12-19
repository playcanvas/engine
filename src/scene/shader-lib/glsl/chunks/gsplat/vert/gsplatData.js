export default /* glsl */`
uniform highp usampler2D transformA;
uniform highp sampler2D transformB;

// work values
uint tAw;
vec4 tBcached;

// read the model-space center of the gaussian
vec3 readCenter(SplatSource source) {
    // read transform data
    uvec4 tA = texelFetch(transformA, source.uv, 0);
    tAw = tA.w;
    tBcached = texelFetch(transformB, source.uv, 0);
    return uintBitsToFloat(tA.xyz);
}

vec4 unpackRotation(vec3 packed) {
    return vec4(packed.xyz, sqrt(max(0.0, 1.0 - dot(packed, packed))));
}

vec4 getRotation() {
    return unpackRotation(vec3(unpackHalf2x16(tAw), tBcached.w)).wxyz;
}

vec3 getScale() {
    return tBcached.xyz;
}
`;
