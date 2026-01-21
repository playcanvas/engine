// Uncompressed GSplat format - work variables, helpers, and read functions
// Texture declarations and load functions are auto-generated from GSplatFormat streams
export default /* glsl */`

// work values
uint tAw;
vec4 tBcached;

vec4 unpackRotation(vec3 packed) {
    return vec4(packed.xyz, sqrt(max(0.0, 1.0 - dot(packed, packed))));
}

// read the model-space center of the gaussian
vec3 getCenter(SplatSource source) {
    // Initialize splatUV for generated load functions
    splatUV = source.uv;

    // read transform data using generated load functions
    uvec4 tA = loadTransformA();
    tAw = tA.w;
    tBcached = loadTransformB();
    return uintBitsToFloat(tA.xyz);
}

vec4 getColor(in SplatSource source) {
    return loadSplatColor();
}

vec4 getRotation() {
    return unpackRotation(vec3(unpackHalf2x16(tAw), tBcached.w)).wxyz;
}

vec3 getScale() {
    return tBcached.xyz;
}

#include "gsplatUncompressedSHVS"
`;
