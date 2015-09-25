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

void main(void) {
    psInternalData data;
    vec4 tex         = texture2DSRGB(colorMap, texCoordsAlphaLife.xy);
    vec4 ramp     = texture2DSRGB(internalTex3, vec2(texCoordsAlphaLife.w, 0.0));
    ramp.rgb *= colorMult;

    ramp.a += texCoordsAlphaLife.z;

    vec3 rgb =     tex.rgb * ramp.rgb;
    float a =         tex.a * ramp.a;

