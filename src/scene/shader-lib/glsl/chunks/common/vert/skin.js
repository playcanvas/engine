export default /* glsl */`

attribute vec4 vertex_boneWeights;
attribute vec4 vertex_boneIndices;

uniform highp sampler2D texture_poseMap;

void getBoneMatrix(const in int width, const in int index, out vec4 v1, out vec4 v2, out vec4 v3) {

    int v = index / width;
    int u = index % width;

    v1 = texelFetch(texture_poseMap, ivec2(u + 0, v), 0);
    v2 = texelFetch(texture_poseMap, ivec2(u + 1, v), 0);
    v3 = texelFetch(texture_poseMap, ivec2(u + 2, v), 0);
}

mat4 getSkinMatrix(const in vec4 indicesFloat, const in vec4 weights) {

    int width = textureSize(texture_poseMap, 0).x;
    ivec4 indices = ivec4(indicesFloat + 0.5) * 3;

    // get 4 bone matrices
    vec4 a1, a2, a3;
    getBoneMatrix(width, indices.x, a1, a2, a3);

    vec4 b1, b2, b3;
    getBoneMatrix(width, indices.y, b1, b2, b3);

    vec4 c1, c2, c3;
    getBoneMatrix(width, indices.z, c1, c2, c3);

    vec4 d1, d2, d3;
    getBoneMatrix(width, indices.w, d1, d2, d3);

    // multiply them by weights and add up to get final 4x3 matrix
    vec4 v1 = a1 * weights.x + b1 * weights.y + c1 * weights.z + d1 * weights.w;
    vec4 v2 = a2 * weights.x + b2 * weights.y + c2 * weights.z + d2 * weights.w;
    vec4 v3 = a3 * weights.x + b3 * weights.y + c3 * weights.z + d3 * weights.w;

    // add up weights
    float one = dot(weights, vec4(1.0));

    // transpose to 4x4 matrix
    return mat4(
        v1.x, v2.x, v3.x, 0,
        v1.y, v2.y, v3.y, 0,
        v1.z, v2.z, v3.z, 0,
        v1.w, v2.w, v3.w, one
    );
}
`;
