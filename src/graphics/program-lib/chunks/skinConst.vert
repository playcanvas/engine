attribute vec4 vertex_boneWeights;
attribute vec4 vertex_boneIndices;

uniform mat4 matrix_pose[BONE_LIMIT];

mat4 getBoneMatrix(const in float i)
{
    mat4 bone = matrix_pose[int(i)];

    return bone;
}

