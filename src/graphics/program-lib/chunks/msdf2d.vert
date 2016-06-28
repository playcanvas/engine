attribute vec3 aPosition;
attribute vec2 aUv0;

varying vec2 vUv0;

uniform vec3 uResolution;
uniform vec3 uOffset;
uniform vec3 uScale;

float PIXEL_SCALE = 32.0; // original texture is 32x32

void main(void)
{
    vUv0 = aUv0;

    gl_Position = vec4(-2.0 * ((PIXEL_SCALE * uScale.y * aPosition.x - uOffset.x) / uResolution.x) - 1.0,
                        2.0 * ((PIXEL_SCALE * uScale.y * aPosition.y - uOffset.y) / uResolution.y) + 1.0,
                        0.0,
                        1.0);
}
