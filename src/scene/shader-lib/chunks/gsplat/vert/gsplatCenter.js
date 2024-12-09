export default /* glsl */`
uniform mat4 matrix_model;
uniform mat4 matrix_view;
uniform mat4 matrix_projection;

// project the model space gaussian center to view and clip space
bool initCenter(SplatSource source, vec3 modelCenter, out SplatCenter center) {
    mat4 modelView = matrix_view * matrix_model;
    vec4 centerView = modelView * vec4(modelCenter, 1.0);
    vec4 centerProj = matrix_projection * centerView;
    if (centerProj.z < -centerProj.w) {
        return false;
    }
    center.view = centerView.xyz / centerView.w;
    center.proj = centerProj;
    center.projMat00 = matrix_projection[0][0];
    center.modelView = modelView;
    return true;
}
`;
