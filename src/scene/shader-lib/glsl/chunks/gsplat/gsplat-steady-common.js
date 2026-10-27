export default /* glsl */`
uniform vec2 steadySize;
uniform float alphaClipForward;
uniform int steadyValid;
uniform highp usampler2D steadySamples;
uniform highp sampler2D steadyGaussians;
uniform highp usampler2D steadyHistory0;
uniform highp usampler2D steadyHistory1;
uniform highp usampler2D steadyHistory2;
uniform highp usampler2D steadyHistory3;

const ivec2 STEADY_NEIGHBORS[4] = ivec2[4](ivec2(1, 0), ivec2(-1, 0), ivec2(0, 1), ivec2(0, -1));

uvec4 steadyEntryAt(ivec2 p, int k) {
    if (steadyValid == 0) return uvec4(0u);
    if (k == 0) return texelFetch(steadyHistory0, p, 0);
    if (k == 1) return texelFetch(steadyHistory1, p, 0);
    if (k == 2) return texelFetch(steadyHistory2, p, 0);
    return texelFetch(steadyHistory3, p, 0);
}

float steadyAlpha(vec4 gaussian, vec2 center, vec2 pixel) {
    vec2 delta = pixel - center;
    float radius = gaussian.x * delta.x * delta.x + 2.0 * gaussian.y * delta.x * delta.y + gaussian.z * delta.y * delta.y;
    float alpha = clamp(gaussian.w * (exp(-4.0 * radius) - exp(-4.0)) / (1.0 - exp(-4.0)), 0.0, 0.999);
    return radius <= 1.0 && alpha >= alphaClipForward ? alpha : 0.0;
}

vec4 steadyNeighborAlphas(ivec2 p, uvec4 sampleData, vec4 gaussian) {
    vec2 center = uintBitsToFloat(sampleData.zw);
    vec4 result;
    for (int n = 0; n < 4; n++) {
        result[n] = steadyAlpha(gaussian, center, vec2(p + STEADY_NEIGHBORS[n]) + 0.5);
    }
    return result;
}

vec4 steadyWeightsAt(ivec2 p) {
    uvec4 sampleData = texelFetch(steadySamples, p, 0);
    float depth = sampleData.x == 0u ? 3.402823e38 : uintBitsToFloat(sampleData.y);
    vec4 ratio = vec4(1.0);
    if (sampleData.x != 0u) {
        vec4 gaussian = texelFetch(steadyGaussians, p, 0);
        float alpha = steadyAlpha(gaussian, uintBitsToFloat(sampleData.zw), vec2(p) + 0.5);
        ratio = steadyNeighborAlphas(p, sampleData, gaussian) / max(alpha, 1e-20);
    }
    for (int k = 0; k < 4; k++) {
        uvec4 entry = steadyEntryAt(p, k);
        if (entry.x != 0u && entry.x != sampleData.x && uintBitsToFloat(entry.y) < depth) {
            ratio *= vec4(unpackHalf2x16(entry.z), unpackHalf2x16(entry.w));
        }
    }
    return ratio;
}
`;
