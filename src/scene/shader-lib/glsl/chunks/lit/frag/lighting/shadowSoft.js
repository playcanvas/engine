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
    vec2 shadowCoords, float z, int shadowBlockerSamples, float penumbraSize, float invShadowMapSize, float randomSeed) {

    VogelDiskData diskData;
    prepareDiskConstants(diskData, shadowBlockerSamples, randomSeed);

    float searchWidth = penumbraSize * invShadowMapSize;
    float blockerSum = 0.0;
    numBlockers = 0;

    for( int i = 0; i < shadowBlockerSamples; ++i ) {
        vec2 diskUV = generateDiskSample(diskData);
        vec2 sampleUV = shadowCoords + diskUV * searchWidth;
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

float getPenumbra(float dblocker, float dreceiver, float penumbraSize, float penumbraFalloff) {
    float dist = dreceiver - dblocker;
    float penumbra = 1.0 - pow(1.0 - dist, penumbraFalloff);
    return penumbra * penumbraSize;
}

float PCSSDirectional(TEXTURE_ACCEPT(shadowMap), vec3 shadowCoords, vec4 cameraParams, vec4 softShadowParams) {

    float receiverDepth = shadowCoords.z;
    float randomSeed = fractSinRand(gl_FragCoord.xy);
    int shadowSamples = int(softShadowParams.x);
    int shadowBlockerSamples = int(softShadowParams.y);
    float penumbraSize = softShadowParams.z;
    float penumbraFalloff = softShadowParams.w;

    // normalized inverse shadow map size to preserve the shadow softness regardless of the shadow resolution
    int shadowMapSize = textureSize(shadowMap, 0).x;
    float invShadowMapSize = 1.0 / float(shadowMapSize);
    invShadowMapSize *= float(shadowMapSize) / 2048.0;

    float penumbra;

    // contact hardening path
    if (shadowBlockerSamples > 0) {

        // find average blocker depth
        float avgBlockerDepth = 0.0;
        int numBlockers = 0;
        PCSSFindBlocker(TEXTURE_PASS(shadowMap), avgBlockerDepth, numBlockers, shadowCoords.xy, receiverDepth, shadowBlockerSamples, penumbraSize, invShadowMapSize, randomSeed);

        // early out when no blockers are present
        if (numBlockers < 1)
            return 1.0f;

        // penumbra size is based on the blocker depth
        penumbra = getPenumbra(avgBlockerDepth, shadowCoords.z, penumbraSize, penumbraFalloff);

    } else {

        // constant filter size, no contact hardening
        penumbra = penumbraSize;
    }

    float filterRadius = penumbra * invShadowMapSize;

    // filtering
    return PCSSFilter(TEXTURE_PASS(shadowMap), shadowCoords.xy, receiverDepth, shadowSamples, filterRadius, randomSeed);
}

float getShadowPCSS(TEXTURE_ACCEPT(shadowMap), vec3 shadowCoord, vec4 shadowParams, vec4 cameraParams, vec4 softShadowParams, vec3 lightDir) {
    return PCSSDirectional(TEXTURE_PASS(shadowMap), shadowCoord, cameraParams, softShadowParams);
}

`;
