export default /* glsl */`

const int PCSS_SAMPLE_COUNT = 16;
uniform vec3 pcssSamples[PCSS_SAMPLE_COUNT];

float2 PcssRotate(vec2 v, vec3 rotation) {
}

vec2 PcssBlockerDistance(vec3 shadowCoord, float searchUv, vec3 rotation) {
    int blockers = 0;
    float averageBlocker = 0.0;
    for (int i = 0; i < PCSS_SAMPLE_COUNT; i++) {
        vec2 offset = pcssSamples[i] * searchUv;
        offset = PcssRotate(offset, rotation);

        float blocker = texture2D(shadowMap, shadowCoord.xy + offset).r;
        if (blocker < shadowCoord.z) {
            blockers++;
            averageBlocker += blocker;
        }
    }

    averageBlocker /= blockers;

    return vec2(averageBlocker, (float)blockers);
}
`;
