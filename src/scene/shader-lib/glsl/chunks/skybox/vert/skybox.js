export default /* glsl */`
attribute vec4 aPosition;

uniform mat4 matrix_view;
uniform mat4 matrix_projectionSkybox;
uniform mat3 cubeMapRotationMatrix;

varying vec3 vViewDir;

#ifdef PREPASS_PASS
    // when skydome renders depth during prepass, generate linear depth
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

        #ifdef PREPASS_PASS
            // linear depth from the worldPosition, see getLinearDepth
            vLinearDepth = -(matrix_view * vec4(vWorldPos, 1.0)).z;
        #endif

    #else

        view[3][0] = view[3][1] = view[3][2] = 0.0;
        gl_Position = matrix_projectionSkybox * (view * aPosition);
        vViewDir = aPosition.xyz * cubeMapRotationMatrix;

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
