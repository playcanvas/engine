export default /* glsl */`
uniform highp usampler2D transformA;
uniform highp sampler2D transformB;

// work values
uint tAw;
vec4 tB;

// read the model-space center of the gaussian
vec3 readPosition(SplatSource source) {
    // read transform data
    uvec4 tA = texelFetch(transformA, source.uv, 0);
    tAw = tA.w;
    return uintBitsToFloat(tA.xyz);
}

vec4 unpackRotation(vec3 packed) {
    return vec4(packed.xyz, sqrt(max(0.0, 1.0 - dot(packed, packed))));
}

// sample covariance vectors
void readRotationAndScale(in SplatSource source, out vec4 rotation, out vec3 scale) {
    rotation = unpackRotation(vec3(unpackHalf2x16(tAw), tB.w)).wxyz;
    scale = tB.xyz;
}
`;
