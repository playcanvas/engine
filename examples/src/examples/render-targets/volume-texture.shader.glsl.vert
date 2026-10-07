attribute vec3 aPosition;

// the inverse of the camera view-projection matrix
uniform mat4 uInvViewProjection;

// world space position of the far plane under the pixel
varying vec3 vFarPosition;

void main(void)
{
    // a fullscreen quad, its corners at -1..1 in clip space
    vec2 ndc = aPosition.xy * 2.0;
    vec4 far = uInvViewProjection * vec4(ndc, 1.0, 1.0);
    vFarPosition = far.xyz / far.w;

    gl_Position = vec4(ndc, 0.5, 1.0);
}
