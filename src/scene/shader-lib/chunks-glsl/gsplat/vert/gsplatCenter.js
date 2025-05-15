export default /* glsl */`
uniform mat4 matrix_model;
uniform mat4 matrix_view;
uniform mat4 matrix_projection;

// project the model space gaussian center to view and clip space
bool initCenter(vec3 modelCenter, out SplatCenter center) {
    mat4 modelView = matrix_view * matrix_model;
    vec4 centerView = modelView * vec4(modelCenter, 1.0);

    // early out if splat is behind the camera
    if (centerView.z > 0.0) {
        return false;
    }

    vec4 centerProj = matrix_projection * centerView;

    // ensure gaussians are not clipped by camera near and far
    #if WEBGPU
        centerProj.z = clamp(centerProj.z, 0, abs(centerProj.w));
    #else
        centerProj.z = clamp(centerProj.z, -abs(centerProj.w), abs(centerProj.w));
    #endif

    center.view = centerView.xyz / centerView.w;
    center.proj = centerProj;
    center.projMat00 = matrix_projection[0][0];
    center.modelView = modelView;
    return true;
}
`;
