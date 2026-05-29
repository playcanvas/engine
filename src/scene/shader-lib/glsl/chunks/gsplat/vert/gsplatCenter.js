export default /* glsl */`

uniform mat4 matrix_model;
uniform mat4 matrix_view;
#ifndef GSPLAT_CENTER_NOPROJ
    uniform vec4 camera_params;             // 1 / far, far, near, isOrtho
    uniform mat4 matrix_projection;
    #ifdef GSPLAT_FISHEYE
        uniform float fisheye_k;
        uniform float fisheye_inv_k;        // 1.0 / fisheye_k (precomputed on CPU)
        uniform float fisheye_projMat00;    // projection scale X (precomputed on CPU)
        uniform float fisheye_projMat11;    // projection scale Y (precomputed on CPU)
    #endif
#endif

// project the model space gaussian center to view and clip space
bool initCenter(vec3 modelCenter, inout SplatCenter center) {
    mat4 modelView = matrix_view * matrix_model;
    vec4 centerView = modelView * vec4(modelCenter, 1.0);

    #ifndef GSPLAT_CENTER_NOPROJ

        #ifdef GSPLAT_FISHEYE

            // Generalized fisheye: g(θ) = k·tan(θ/k)
            // k=2: stereographic, k→∞: equidistant
            vec3 v = centerView.xyz;
            float r_xy = length(v.xy);
            float neg_z = -v.z;
            float theta = atan(r_xy, neg_z);

            // Cull near the singularity at θ = k·π/2, and at camera origin
            float maxTheta = min(fisheye_k * 1.5707963, 3.13);
            if (theta > maxTheta - 0.01 || dot(v, v) < 0.0001) {
                return false;
            }

            float tk = theta * fisheye_inv_k;
            float sin_tk = sin(tk);
            float cos_tk = cos(tk);
            float g_theta = fisheye_k * sin_tk / cos_tk;
            float fisheye_s = (r_xy > 1e-4) ? g_theta / r_xy : (neg_z > 0.0 ? 1.0 / neg_z : 0.0);

            vec2 ndc = vec2(fisheye_projMat00 * fisheye_s * v.x, fisheye_projMat11 * fisheye_s * v.y);

            float near = camera_params.z;
            float far = camera_params.y;
            float linearDepth = neg_z;
            #if WEBGPU
                float depthNdc = clamp((linearDepth - near) / (far - near), 0.0, 1.0);
            #else
                float depthNdc = clamp(2.0 * (linearDepth - near) / (far - near) - 1.0, -1.0, 1.0);
            #endif

            center.proj = vec4(ndc, depthNdc, 1.0);
            center.projMat00 = fisheye_projMat00;
            center.fisheyeSinTK = sin_tk;
            center.fisheyeCosTK = cos_tk;
            center.fisheyeRxy = r_xy;

        #else

            // early out if splat is behind the camera (perspective only)
            // orthographic projections don't need this check as frustum culling handles it
            if (camera_params.w != 1.0 && centerView.z > 0.0) {
                return false;
            }

            vec4 centerProj = matrix_projection * centerView;

            // ensure gaussians are not clipped by camera near and far
            #if WEBGPU
                centerProj.z = clamp(centerProj.z, 0, abs(centerProj.w));
            #else
                centerProj.z = clamp(centerProj.z, -abs(centerProj.w), abs(centerProj.w));
            #endif

            center.proj = centerProj;
            center.projMat00 = matrix_projection[0][0];

        #endif

    #endif

    center.view = centerView.xyz / centerView.w;
    center.modelView = modelView;
    return true;
}
`;
