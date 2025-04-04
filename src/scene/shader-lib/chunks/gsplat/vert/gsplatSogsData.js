export default /* glsl */`
uniform highp sampler2D means_u;
uniform highp sampler2D means_l;
uniform highp sampler2D quats;
uniform highp sampler2D scales;

uniform vec3 means_mins;
uniform vec3 means_maxs;

uniform vec3 quats_mins;
uniform vec3 quats_maxs;

uniform vec3 scales_mins;
uniform vec3 scales_maxs;

// read the model-space center of the gaussian
vec3 readCenter(SplatSource source) {
    vec3 u = texelFetch(means_u, source.uv, 0).xyz;
    vec3 l = texelFetch(means_l, source.uv, 0).xyz;
    vec3 n = (l * 255.0 + u * 255.0 * 256.0) / 65535.0;

    vec3 v = mix(means_mins, means_maxs, n);
    return sign(v) * (exp(abs(v)) - 1.0);
}

mat3 quatToMat3(vec3 R) {
    float x = R.x;
    float y = R.y;
    float z = R.z;
    float w2 = clamp(1.0 - (x*x + y*y + z*z), 0.0, 1.0);
    float w  = sqrt(w2);
    return mat3(
        1.0 - 2.0 * (z * z + w2),
              2.0 * (y * z + x * w),
              2.0 * (y * w - x * z),
              2.0 * (y * z - x * w),
        1.0 - 2.0 * (y * y + w2),
              2.0 * (z * w + x * y),
              2.0 * (y * w + x * z),
              2.0 * (z * w - x * y),
        1.0 - 2.0 * (y * y + z * z)
    );
}

// sample covariance vectors
void readCovariance(in SplatSource source, out vec3 covA, out vec3 covB) {
    vec3 quat = mix(quats_mins, quats_maxs, texelFetch(quats, source.uv, 0).xyz);
    mat3 rot = quatToMat3(quat);
    vec3 scale = exp(mix(scales_mins, scales_maxs, texelFetch(scales, source.uv, 0).xyz));

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
