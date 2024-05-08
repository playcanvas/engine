attribute vec3 aPosition;
attribute vec2 aUv0;
attribute vec3 aNormal;

uniform mat4 matrix_model;
uniform mat4 matrix_viewProjection;
uniform mat3 matrix_normal;

varying vec2 vUv0;
varying vec3 worldNormal;

void main(void)
{
    vUv0 = aUv0;
    worldNormal = normalize(matrix_normal * aNormal);
    gl_Position = matrix_viewProjection * matrix_model * vec4(aPosition, 1.0);
}
