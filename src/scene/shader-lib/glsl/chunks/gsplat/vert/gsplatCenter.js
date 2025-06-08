export default /* glsl */`
uniform mat4 matrix_model;
uniform mat4 matrix_view;

// tranform splat PRS to view space
void transformPRS(in SplatPRS prs, out SplatPRS viewPRS) {
    mat4 modelView = matrix_view * matrix_model;
    vec4 v = modelView * vec4(prs.position, 1.0);
    mat3 r = mat3(modelView) * prs.rotation;

    viewPRS.position = v.xyz / v.w;
    viewPRS.rotation = r;
    viewPRS.scale = prs.scale;
}
`;
