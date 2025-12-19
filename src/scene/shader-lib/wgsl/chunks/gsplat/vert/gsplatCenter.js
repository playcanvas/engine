export default /* wgsl */`
uniform matrix_model: mat4x4f;
uniform matrix_view: mat4x4f;
uniform camera_params: vec4f;             // 1 / far, far, near, isOrtho
#ifndef GSPLAT_CENTER_NOPROJ
    uniform matrix_projection: mat4x4f;
#endif

// project the model space gaussian center to view and clip space
fn initCenter(modelCenter: vec3f, center: ptr<function, SplatCenter>) -> bool {
    let modelView: mat4x4f = uniform.matrix_view * uniform.matrix_model;
    let centerView: vec4f = modelView * vec4f(modelCenter, 1.0);

    #ifndef GSPLAT_CENTER_NOPROJ

        // early out if splat is behind the camera (perspective only)
        // orthographic projections don't need this check as frustum culling handles it
        if (uniform.camera_params.w != 1.0 && centerView.z > 0.0) {
            return false;
        }

        var centerProj: vec4f = uniform.matrix_projection * centerView;

        // ensure gaussians are not clipped by camera near and far
        centerProj.z = clamp(centerProj.z, 0.0, abs(centerProj.w));

        center.proj = centerProj;
        center.projMat00 = uniform.matrix_projection[0][0];

    #endif

    center.view = centerView.xyz / centerView.w;
    center.modelView = modelView;
    return true;
}
`;
