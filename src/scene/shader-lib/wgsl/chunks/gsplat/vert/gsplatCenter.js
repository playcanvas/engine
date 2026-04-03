export default /* wgsl */`

uniform matrix_model: mat4x4f;
uniform matrix_view: mat4x4f;
#ifndef GSPLAT_CENTER_NOPROJ
    uniform camera_params: vec4f;             // 1 / far, far, near, isOrtho
    uniform matrix_projection: mat4x4f;
    #ifdef GSPLAT_FISHEYE
        uniform fisheye_k: f32;
        uniform fisheye_inv_k: f32;           // 1.0 / fisheye_k (precomputed on CPU)
        uniform fisheye_projMat00: f32;       // projection scale X (precomputed on CPU)
        uniform fisheye_projMat11: f32;       // projection scale Y (precomputed on CPU)
    #endif
#endif

// project the model space gaussian center to view and clip space
fn initCenter(modelCenter: vec3f, center: ptr<function, SplatCenter>) -> bool {
    let modelView: mat4x4f = uniform.matrix_view * uniform.matrix_model;
    let centerView: vec4f = modelView * vec4f(modelCenter, 1.0);

    #ifndef GSPLAT_CENTER_NOPROJ

        #ifdef GSPLAT_FISHEYE

            // Generalized fisheye: g(θ) = k·tan(θ/k)
            // k=2: stereographic, k→∞: equidistant
            let v: vec3f = centerView.xyz;
            let r_xy: f32 = length(v.xy);
            let neg_z: f32 = -v.z;
            let theta: f32 = atan2(r_xy, neg_z);

            // Cull near the singularity at θ = k·π/2, and at camera origin
            let maxTheta: f32 = min(uniform.fisheye_k * 1.5707963, 3.13);
            if (theta > maxTheta - 0.01 || dot(v, v) < 0.0001) {
                return false;
            }

            let tk: f32 = theta * uniform.fisheye_inv_k;
            let sin_tk: f32 = sin(tk);
            let cos_tk: f32 = cos(tk);
            let g_theta: f32 = uniform.fisheye_k * sin_tk / cos_tk;
            let fisheye_s: f32 = select(select(0.0, 1.0 / neg_z, neg_z > 0.0), g_theta / r_xy, r_xy > 1e-4);

            let ndc: vec2f = vec2f(uniform.fisheye_projMat00 * fisheye_s * v.x, uniform.fisheye_projMat11 * fisheye_s * v.y);

            let near: f32 = uniform.camera_params.z;
            let far: f32 = uniform.camera_params.y;
            let linearDepth: f32 = neg_z;
            let depthNdc: f32 = clamp((linearDepth - near) / (far - near), 0.0, 1.0);

            center.proj = vec4f(ndc, depthNdc, 1.0);
            center.projMat00 = uniform.fisheye_projMat00;
            center.fisheyeSinTK = sin_tk;
            center.fisheyeCosTK = cos_tk;
            center.fisheyeRxy = r_xy;

        #else

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

    #endif

    center.view = centerView.xyz / centerView.w;
    center.modelView = modelView;
    return true;
}
`;
