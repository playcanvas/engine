attribute vec3 aPosition;

#ifndef VIEWMATRIX
#define VIEWMATRIX
uniform mat4 matrix_view;
#endif

uniform mat4 matrix_projection;

varying vec3 vViewDir;

void main(void)
{
    mat4 view = matrix_view;
    view[3][0] = view[3][1] = view[3][2] = 0.0;
    gl_Position = matrix_projection * view * vec4(aPosition, 1.0);

    // Force skybox to far Z, regardless of the clip planes on the camera
    // Subtract a tiny fudge factor to ensure floating point errors don't
    // still push pixels beyond far Z. See:
    // http://www.opengl.org/discussion_boards/showthread.php/171867-skybox-problem

    gl_Position.z = gl_Position.w - 0.00001;
    vViewDir = aPosition;
    vViewDir.x *= -1.0;
}

