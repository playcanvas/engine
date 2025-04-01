export default /* glsl */`
uniform highp usampler2D transformA;
uniform highp sampler2D transformB;

// work values
uint tAw;

// read the model-space center of the gaussian
vec3 readCenter(SplatSource source) {
    // read transform data
    uvec4 tA = texelFetch(transformA, source.uv, 0);
    tAw = tA.w;
    return uintBitsToFloat(tA.xyz);
}

mat3 quatToMat3(vec4 R) {
    float x = R.w;
    float y = R.x;
    float z = R.y;
    float w = R.z;
    return mat3(
        1.0 - 2.0 * (z * z + w * w),
              2.0 * (y * z + x * w),
              2.0 * (y * w - x * z),
              2.0 * (y * z - x * w),
        1.0 - 2.0 * (y * y + w * w),
              2.0 * (z * w + x * y),
              2.0 * (y * w + x * z),
              2.0 * (z * w - x * y),
        1.0 - 2.0 * (y * y + z * z)
    );
}

vec4 unpackRotation(vec3 packed) {
    return vec4(packed.xyz, sqrt(1.0 - dot(packed, packed)));
}

// sample covariance vectors
void readCovariance(in SplatSource source, out vec3 covA, out vec3 covB) {
    vec4 tB = texelFetch(transformB, source.uv, 0);

    mat3 rot = quatToMat3(unpackRotation(vec3(unpackHalf2x16(tAw), tB.w)));
    vec3 scale = tB.xyz;
    
    // M = S * R
    mat3 M = transpose(mat3(
        scale.x * rot[0],
        scale.y * rot[1],
        scale.z * rot[2]
    ));

    covA = vec3(dot(M[0], M[0]), dot(M[0], M[1]), dot(M[0], M[2]));
    covB = vec3(dot(M[1], M[1]), dot(M[1], M[2]), dot(M[2], M[2]));
}
`;
