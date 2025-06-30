export default /* glsl */`
mat3 quatToMat3(vec4 R) {
    vec4 R2 = R + R;
    float X = R2.x * R.w;
    vec4 Y  = R2.y * R;
    vec4 Z  = R2.z * R;
    float W = R2.w * R.w;

    return mat3(
        1.0 - Z.z - W,
              Y.z + X,
              Y.w - Z.x,
              Y.z - X,
        1.0 - Y.y - W,
              Z.w + Y.x,
              Y.w + Z.x,
              Z.w - Y.x,
        1.0 - Y.y - Z.z
    );
}
`;
