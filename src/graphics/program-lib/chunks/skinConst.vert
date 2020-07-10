attribute vec4 vertex_boneWeights;
attribute vec4 vertex_boneIndices;

uniform vec4 matrix_pose[BONE_LIMIT * 3];

void getBoneMatrix(const in float i, out vec4 v1, out vec4 v2, out vec4 v3) {
    // read 4x3 matrix
    v1 = matrix_pose[int(3.0 * i)];
    v2 = matrix_pose[int(3.0 * i + 1.0)];
    v3 = matrix_pose[int(3.0 * i + 2.0)];
}

mat4 getSkinMatrix(const in vec4 indices, const in vec4 weights) {
    // get 4 bone matrices
    vec4 a1, a2, a3;
    getBoneMatrix(indices.x, a1, a2, a3);

    vec4 b1, b2, b3;
    getBoneMatrix(indices.y, b1, b2, b3);

    vec4 c1, c2, c3;
    getBoneMatrix(indices.z, c1, c2, c3);

    vec4 d1, d2, d3;
    getBoneMatrix(indices.w, d1, d2, d3);

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
