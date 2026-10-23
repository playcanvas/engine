export default /* glsl */`
varying highp vec2 gaussianUV;
flat varying highp vec4 gaussianColor;
flat varying highp vec2 steadyCenter;
flat varying highp float steadyDepth;
flat varying highp uint steadyId;
flat varying highp uint steadyNoisePhase;
uniform highp sampler3D steadyNoise;
uniform uint steadyFrame;
uniform uint steadyNoiseShift;
uniform float alphaClipForward;

void main(void) {
    // Derivatives are evaluated before discards. They recover the rasterized Gaussian's
    // quadratic form, so reuse and visibility agree without a compute projection cache.
    vec2 dx = dFdx(gaussianUV);
    vec2 dy = dFdy(gaussianUV);
    vec3 conic = vec3(dot(dx, dx), dot(dx, dy), dot(dy, dy));
    float radius = dot(gaussianUV, gaussianUV);
    float alpha = clamp(gaussianColor.a * (exp(-4.0 * radius) - exp(-4.0)) / (1.0 - exp(-4.0)), 0.0, 0.999);
    if (radius > 1.0 || alpha < alphaClipForward || alpha <= 0.0) {
        discard;
    }
    uvec2 offset = (steadyId * uvec2(3242174889u, 2447445415u)) >> 27u;
    ivec3 coord = ivec3(ivec2((uvec2(gl_FragCoord.xy) + offset) & 31u), int(steadyFrame & 63u));
    uint rank = uint(texelFetch(steadyNoise, coord, 0).r * 255.0 + 0.5);
    if (alpha <= steadyNoiseThreshold(rank, steadyNoisePhase, steadyNoiseShift)) {
        discard;
    }
    pcFragColor0 = vec4(gaussianColor.rgb, 1.0);
    pcFragColor1 = uvec4(steadyId, floatBitsToUint(steadyDepth), floatBitsToUint(steadyCenter));
    pcFragColor2 = vec4(conic, gaussianColor.a);
}
`;
