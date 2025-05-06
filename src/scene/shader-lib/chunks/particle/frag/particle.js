export default /* glsl */`
varying vec4 texCoordsAlphaLife;

uniform sampler2D colorMap;
uniform sampler2D colorParam;
uniform float graphSampleSize;
uniform float graphNumSamples;

#ifndef CAMERAPLANES
    #define CAMERAPLANES
    uniform vec4 camera_params;
#endif

uniform float softening;
uniform float colorMult;

float saturate(float x) {
    return clamp(x, 0.0, 1.0);
}

void main(void) {
    vec4 tex  = texture2D(colorMap, vec2(texCoordsAlphaLife.x, 1.0 - texCoordsAlphaLife.y));
    vec4 ramp = texture2D(colorParam, vec2(texCoordsAlphaLife.w, 0.0));
    ramp.rgb *= colorMult;

    ramp.a += texCoordsAlphaLife.z;

    vec3 rgb = tex.rgb * ramp.rgb;
    float a  = tex.a * ramp.a;
`;
