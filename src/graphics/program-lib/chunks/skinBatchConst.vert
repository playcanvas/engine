attribute float vertex_boneIndices;

uniform vec4 matrix_pose[BONE_LIMIT * 3];

mat4 getBoneMatrix(const in float i) {
    // read 4x3 matrix
    vec4 v1 = matrix_pose[int(3.0 * i)];
    vec4 v2 = matrix_pose[int(3.0 * i + 1.0)];
    vec4 v3 = matrix_pose[int(3.0 * i + 2.0)];

    // transpose to 4x4 matrix
    return mat4(
        v1.x, v2.x, v3.x, 0,
        v1.y, v2.y, v3.y, 0,
        v1.z, v2.z, v3.z, 0,
        v1.w, v2.w, v3.w, 1
    );
}
