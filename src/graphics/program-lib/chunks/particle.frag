varying vec4 texCoordsAlphaLife;

uniform sampler2D colorMap;
uniform sampler2D internalTex3;
uniform float graphSampleSize;
uniform float graphNumSamples;
uniform float camera_far;
uniform float softening;
uniform float colorMult;

float saturate(float x) {
    return clamp(x, 0.0, 1.0);
}

float unpackFloat(vec4 rgbaDepth) {
    const vec4 bitShift = vec4(1.0 / (256.0 * 256.0 * 256.0), 1.0 / (256.0 * 256.0), 1.0 / 256.0, 1.0);
    float depth = dot(rgbaDepth, bitShift);
    return depth;
}

#define W0 0.5545497
#define W1 0.308517
// as is this will start to show defects outside of
// the interval [-2048, 2048]
float hash(in vec2 c)
{
  float x = c.x*fract(c.x * W0);
  float y = c.y*fract(c.y * W1);

  // NOTICE: as is - if a sampling an integer lattice
  // any zero input will cause a black line in that
  // direction.
  return fract(x*y);
}

void main(void) {
    psInternalData data;
    vec4 tex         = texture2DSRGB(colorMap, texCoordsAlphaLife.xy);
    vec4 ramp     = texture2DSRGB(internalTex3, vec2(texCoordsAlphaLife.w, 0.0));
    ramp.rgb *= colorMult;

    ramp.a += texCoordsAlphaLife.z;

    vec3 rgb =     tex.rgb * ramp.rgb;
    float a =         tex.a * ramp.a;
