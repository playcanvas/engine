export default /* glsl */`
attribute vec4 aPosition;

uniform mat4 matrix_view;
uniform mat4 matrix_projectionSkybox;
uniform mat3 cubeMapRotationMatrix;

varying vec3 vViewDir;

#ifdef SKY_FISHEYE
    varying vec3 vClipXYW;
    uniform float projectionFlipY;
#endif

#if defined(PREPASS_PASS) || (defined(SCENE_TEXTURE_DEPTH) && defined(SKYMESH))
    // Depth-based effects can use either the prepass or the scene pass depth output.
    varying float vLinearDepth;
#endif

#ifdef SKYMESH
    uniform mat4 matrix_model;
    varying vec3 vWorldPos;
#endif

void main(void) {

    mat4 view = matrix_view;

    #ifdef SKYMESH

        vec4 worldPos = matrix_model * aPosition;
        vWorldPos = worldPos.xyz;
        gl_Position = matrix_projectionSkybox * (view * worldPos);

        #if defined(PREPASS_PASS) || defined(SCENE_TEXTURE_DEPTH)
            // linear depth from the worldPosition, see getLinearDepth
            vLinearDepth = -(matrix_view * vec4(vWorldPos, 1.0)).z;
        #endif

    #else

        view[3][0] = view[3][1] = view[3][2] = 0.0;
        vViewDir = aPosition.xyz * cubeMapRotationMatrix;

        #ifdef SKY_FISHEYE
            // Bypass matrix_projectionSkybox which degenerates at extreme FOVs.
            // Use a fixed ~90° perspective (p00=p11=1) so the box always covers the
            // screen. The fragment shader recomputes view direction from screen
            // coordinates, so only rasterization coverage matters here.
            vec4 viewPos = view * aPosition;
            vClipXYW = vec3(viewPos.xy, -viewPos.z);

            // apply the per-pass target flip, so the rasterized position (and winding, which the
            // renderer compensates for) matches the target orientation
            gl_Position = vec4(viewPos.x, viewPos.y * projectionFlipY, 0.0, -viewPos.z);
        #else
            gl_Position = matrix_projectionSkybox * (view * aPosition);
        #endif

        #ifdef PREPASS_PASS
            // for infinite skybox, use negative gl_Position.w to get positive linear depth
            vLinearDepth = -gl_Position.w;
        #endif
    #endif

    // Force skybox to far Z, regardless of the clip planes on the camera
    // Subtract a tiny fudge factor to ensure floating point errors don't
    // still push pixels beyond far Z. See:
    // https://community.khronos.org/t/skybox-problem/61857

    gl_Position.z = gl_Position.w - 1.0e-7;
}
`;
