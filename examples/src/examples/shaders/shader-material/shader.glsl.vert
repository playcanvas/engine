attribute vec3 aPosition;
attribute vec2 aUv0;

uniform mat4 matrix_model;
uniform mat4 matrix_viewProjection;

varying vec4 vFragPosition;
varying vec2 vUv0;

void main(void)
{
    vec4 localPos = vec4(aPosition, 1.0);
    gl_Position = matrix_viewProjection * (matrix_model * localPos);
    vFragPosition = 0.5 * (localPos + vec4(1.0));
    vUv0 = aUv0;
}
