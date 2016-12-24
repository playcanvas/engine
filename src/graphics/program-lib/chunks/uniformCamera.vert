uniform perCamera {
    mat4 matrix_viewProjection;
    mat4 matrix_view;
    mat4 matrix_projection;
    vec4 view_position; // w unused
    vec4 cameraClip; // near, far
} uniformCamera;

