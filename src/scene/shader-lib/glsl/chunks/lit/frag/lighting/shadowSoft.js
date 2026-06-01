// Soft directional shadows PCSS - with and without blocker search.
export default /* glsl */`

highp float fractSinRand(const in vec2 uv) {
    const float PI = 3.141592653589793;
    const highp float a = 12.9898, b = 78.233, c = 43758.5453;
    highp float dt = dot(uv.xy, vec2(a, b)), sn = mod(dt, PI);
    return fract(sin(sn) * c);
}

// struct to hold precomputed constants and current state
struct VogelDiskData {
    float invNumSamples;
    float initialAngle;
    float currentPointId;
};

// prepare the Vogel disk constants and initialize the current state in the struct
void prepareDiskConstants(out VogelDiskData data, int sampleCount, float randomSeed) {
    const float pi2 = 6.28318530718;
    data.invNumSamples = 1.0 / float(sampleCount);
    data.initialAngle = randomSeed * pi2;
    data.currentPointId = 0.0;
}


vec2 generateDiskSample(inout VogelDiskData data) {
    const float GOLDEN_ANGLE = 2.399963;
    float r = sqrt((data.currentPointId + 0.5) * data.invNumSamples);
    float theta = data.currentPointId * GOLDEN_ANGLE + data.initialAngle;

    vec2 offset = vec2(cos(theta), sin(theta)) * pow(r, 1.33);

    data.currentPointId += 1.0;
    return offset;
}

void PCSSFindBlocker(TEXTURE_ACCEPT(shadowMap), out float avgBlockerDepth, out int numBlockers,
    vec2 shadowCoords, float z, int shadowBlockerSamples, float searchWidthUv, float randomSeed) {

    VogelDiskData diskData;
    prepareDiskConstants(diskData, shadowBlockerSamples, randomSeed);

    float blockerSum = 0.0;
    numBlockers = 0;

    for( int i = 0; i < shadowBlockerSamples; ++i ) {
        vec2 diskUV = generateDiskSample(diskData);
        vec2 sampleUV = shadowCoords + diskUV * searchWidthUv;
        float shadowMapDepth = texture2DLod(shadowMap, sampleUV, 0.0).r;
        if ( shadowMapDepth < z ) {
            blockerSum += shadowMapDepth;
            numBlockers++;
        }
    }
    avgBlockerDepth = blockerSum / float(numBlockers);
}

float PCSSFilter(TEXTURE_ACCEPT(shadowMap), vec2 uv, float receiverDepth, int shadowSamples, float filterRadius, float randomSeed) {

    VogelDiskData diskData;
    prepareDiskConstants(diskData, shadowSamples, randomSeed);

    float sum = 0.0;
    for (int i = 0; i < shadowSamples; i++) {
        vec2 offsetUV = generateDiskSample(diskData) * filterRadius;
        float depth = texture2DLod(shadowMap, uv + offsetUV, 0.0).r;
        sum += step(receiverDepth, depth);
    }
    return sum / float(shadowSamples);
}

float PCSSDirectional(TEXTURE_ACCEPT(shadowMap), vec3 shadowCoords, vec4 cameraParams, vec4 softShadowParams) {

    float receiverDepth = shadowCoords.z;
    // for sampling against the shadow map we clamp so cleared cells (depth = 1) don't get
    // treated as blockers when the receiver sits outside the tightened cascade range.
    // worldDist further down uses the *unclamped* receiverDepth so it stays cascade-stable.
    float receiverDepthClamped = min(receiverDepth, 0.9999);
    float randomSeed = fractSinRand(gl_FragCoord.xy);
    int shadowSamples = int(softShadowParams.x);
    int shadowBlockerSamples = int(softShadowParams.y);
    float penumbraSize = softShadowParams.z;          // world-space "area size of the light"
    float penumbraFalloff = softShadowParams.w;       // curve shape (>= 1)

    // World-space PCSS. cameraParams.x is the ortho radius (world half-extent) of the
    // directional shadow camera; cameraParams.y/z are far/near. Working in world units
    // makes softness invariant to how the shadow camera tightens its depth bounds per
    // light direction.
    float orthoRadius = cameraParams.x;
    float depthRange = cameraParams.y - cameraParams.z;
    float worldPerUv = 2.0 * orthoRadius;

    float filterRadius;

    // contact hardening path
    if (shadowBlockerSamples > 0) {

        // search width bounds the largest possible penumbra (blocker at far end of depth range)
        float searchWidthUv = (penumbraSize * depthRange) / worldPerUv;

        float avgBlockerDepth = 0.0;
        int numBlockers = 0;
        PCSSFindBlocker(TEXTURE_PASS(shadowMap), avgBlockerDepth, numBlockers, shadowCoords.xy, receiverDepthClamped, shadowBlockerSamples, searchWidthUv, randomSeed);

        // early out when no blockers are present
        if (numBlockers < 1)
            return 1.0f;

        // World-space PCSS with shape control. The saturating curve reaches penumbraSize*depthRange
        // when the blocker sits at the far end of the caster depth range; higher penumbraFalloff
        // makes the softening climb faster (so the same blocker distance produces a wider penumbra).
        // falloff=1 is the linear baseline.
        float worldDist = max((receiverDepth - avgBlockerDepth) * depthRange, 0.0);
        float t = clamp(worldDist / depthRange, 0.0, 1.0);
        float shape = 1.0 - pow(1.0 - t, penumbraFalloff);
        float penumbraWorld = shape * penumbraSize * depthRange;
        filterRadius = penumbraWorld / worldPerUv;

    } else {

        // constant filter size, no contact hardening — penumbraSize is the world-space radius
        filterRadius = penumbraSize / worldPerUv;
    }

    // filtering
    return PCSSFilter(TEXTURE_PASS(shadowMap), shadowCoords.xy, receiverDepthClamped, shadowSamples, filterRadius, randomSeed);
}

float getShadowPCSS(TEXTURE_ACCEPT(shadowMap), vec3 shadowCoord, vec4 shadowParams, vec4 cameraParams, vec4 softShadowParams, vec3 lightDir) {
    return PCSSDirectional(TEXTURE_PASS(shadowMap), shadowCoord, cameraParams, softShadowParams);
}

`;
