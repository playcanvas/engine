export default /* glsl */`
attribute float vertex_boneIndices;

uniform highp sampler2D texture_poseMap;

mat4 getBoneMatrix(const in float indexFloat) {

    int width = textureSize(texture_poseMap, 0).x;
    int index = int(indexFloat + 0.5) * 3;
    int iy = index / width;
    int ix = index % width;

    // read elements of 4x3 matrix
    vec4 v1 = texelFetch(texture_poseMap, ivec2(ix + 0, iy), 0);
    vec4 v2 = texelFetch(texture_poseMap, ivec2(ix + 1, iy), 0);
    vec4 v3 = texelFetch(texture_poseMap, ivec2(ix + 2, iy), 0);

    // transpose to 4x4 matrix
    return mat4(
        v1.x, v2.x, v3.x, 0,
        v1.y, v2.y, v3.y, 0,
        v1.z, v2.z, v3.z, 0,
        v1.w, v2.w, v3.w, 1
    );
}
`;
