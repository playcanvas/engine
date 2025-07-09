export default /* wgsl */`
uniform matrix_model: mat4x4f;
uniform matrix_view: mat4x4f;
uniform matrix_projection: mat4x4f;

// project the model space gaussian center to view and clip space
fn initCenter(modelCenter: vec3f, center: ptr<function, SplatCenter>) -> bool {
    let modelView: mat4x4f = uniform.matrix_view * uniform.matrix_model;
    let centerView: vec4f = modelView * vec4f(modelCenter, 1.0);

    // early out if splat is behind the camera
    if (centerView.z > 0.0) {
        return false;
    }

    var centerProj: vec4f = uniform.matrix_projection * centerView;

    // ensure gaussians are not clipped by camera near and far
    centerProj.z = clamp(centerProj.z, 0.0, abs(centerProj.w));

    center.view = centerView.xyz / centerView.w;
    center.proj = centerProj;
    center.projMat00 = uniform.matrix_projection[0][0];
    center.modelView = modelView;
    return true;
}
`;
