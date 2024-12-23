export default /* glsl */`
attribute vec3 aPosition;

#ifndef VIEWMATRIX
#define VIEWMATRIX
uniform mat4 matrix_view;
#endif

uniform mat4 matrix_projectionSkybox;
uniform mat3 cubeMapRotationMatrix;

varying vec3 vViewDir;

#ifdef SKYMESH
    uniform mat4 matrix_model;
    varying vec3 vWorldPos;
#endif

void main(void) {

    mat4 view = matrix_view;

    #ifdef SKYMESH

        vec4 worldPos = matrix_model * vec4(aPosition, 1.0);
        vWorldPos = worldPos.xyz;
        gl_Position = matrix_projectionSkybox * view * worldPos;

    #else

        view[3][0] = view[3][1] = view[3][2] = 0.0;
        gl_Position = matrix_projectionSkybox * view * vec4(aPosition, 1.0);
        vViewDir = aPosition * cubeMapRotationMatrix;

    #endif

    // Force skybox to far Z, regardless of the clip planes on the camera
    // Subtract a tiny fudge factor to ensure floating point errors don't
    // still push pixels beyond far Z. See:
    // https://community.khronos.org/t/skybox-problem/61857

    gl_Position.z = gl_Position.w - 1.0e-7;
}
`;
