export default /* glsl */`
uniform highp usampler2D packedTexture;

uniform vec3 means_mins;
uniform vec3 means_maxs;

uniform vec3 scales_mins;
uniform vec3 scales_maxs;

uniform vec4 scales_codebook[64];

vec4 unpackU32(uint v) {
    return vec4((uvec4(v) >> uvec4(24u, 16u, 8u, 0u)) & 0xffu) / 255.0;
}

uvec4 packedSample;

// read the model-space center of the gaussian
vec3 readCenter(SplatSource source) {

    // read the packed texture sample
    packedSample = texelFetch(packedTexture, source.uv, 0);

    vec3 l = unpackU32(packedSample.x).xyz;
    vec3 u = unpackU32(packedSample.y).xyz;
    vec3 n = (l * 255.0 + u * 255.0 * 256.0) / 65535.0;
    vec3 v = mix(means_mins, means_maxs, n);

    return sign(v) * (exp(abs(v)) - 1.0);
}

const float norm = 2.0 / sqrt(2.0);

// sample covariance vectors
void readCovariance(in SplatSource source, out vec3 covA, out vec3 covB) {
    // decode rotation quaternion
    vec4 qdata = unpackU32(packedSample.z);

    vec3 abc = (qdata.xyz - 0.5) * norm;
    float d = sqrt(max(0.0, 1.0 - dot(abc, abc)));

    uint mode = uint(qdata.w * 255.0 + 0.5) - 252u;

    vec4 quat = (mode == 0u) ? vec4(d, abc) :
                ((mode == 1u) ? vec4(abc.x, d, abc.yz) :
                ((mode == 2u) ? vec4(abc.xy, d, abc.z) : vec4(abc, d)));

    mat3 rot = quatToMat3(quat);

    // decode scale
    uvec3 idx = (uvec3(packedSample.w) >> uvec3(24u, 16u, 8u)) & 0xffu;
    vec3 scale = exp(vec3(
        (scales_codebook[idx.x >> 2u])[idx.x & 3u],
        (scales_codebook[idx.y >> 2u])[idx.y & 3u],
        (scales_codebook[idx.z >> 2u])[idx.z & 3u]
    ));

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
