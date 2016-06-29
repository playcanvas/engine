attribute vec3 aPosition;
attribute vec2 aUv0;

varying vec2 vUv0;

uniform mat4 uProjection2d;

void main(void)
{
    vUv0 = aUv0;
    gl_Position = vec4((uProjection2d * vec4(aPosition, 1.0)).xy, 0.0, 1.0);
}
