export default /* glsl */`

/**
 * Soft directional shadows PCSS - with and without blocker search.
 */

highp float fractSinRand( const in vec2 uv ) {
    const highp float a = 12.9898, b = 78.233, c = 43758.5453;
    highp float dt = dot(uv.xy, vec2(a, b)), sn = mod(dt, PI);
    return fract(sin(sn) * c);
}

// struct to hold precomputed constants and current state
struct PoissonDiskData {
    float invNumSamples;
    float angleStep;
    float initialAngle;
    float currentRadius;
    float currentAngle;
};

// prepare the Poisson disk constants and initialize the current state in the struct
void preparePoissonConstants(out PoissonDiskData data, int sampleCount, int numRings, float randomSeed) {
    const float pi2 = 6.28318530718;
    data.invNumSamples = 1.0 / float(sampleCount);
    data.angleStep = pi2 * float(numRings) * data.invNumSamples;
    data.initialAngle = randomSeed * pi2;
    data.currentRadius = data.invNumSamples;
    data.currentAngle = data.initialAngle;
}

// generate a Poisson sample using the precomputed struct
vec2 generatePoissonSample(inout PoissonDiskData data) {
    vec2 offset = vec2(cos(data.currentAngle), sin(data.currentAngle)) * pow(data.currentRadius, 0.75);
    data.currentRadius += data.invNumSamples;
    data.currentAngle += data.angleStep;
    return offset;
}

void PCSSFindBlocker(TEXTURE_ACCEPT(shadowMap), out float avgBlockerDepth, out int numBlockers,
    vec2 shadowCoords, float z, int shadowBlockerSamples, float penumbraSize, float invShadowMapSize, float randomSeed) {

    PoissonDiskData poissonData;
    preparePoissonConstants(poissonData, shadowBlockerSamples, 11, randomSeed);

    float searchWidth = penumbraSize * invShadowMapSize;
    float blockerSum = 0.0;
    numBlockers = 0;

    for( int i = 0; i < shadowBlockerSamples; ++i ) {
        vec2 poissonUV = generatePoissonSample(poissonData);
        vec2 sampleUV = shadowCoords + poissonUV * searchWidth;
        float shadowMapDepth = texture2DLod(shadowMap, sampleUV, 0.0).r;
        if ( shadowMapDepth < z ) {
            blockerSum += shadowMapDepth;
            numBlockers++;
        }
    }
    avgBlockerDepth = blockerSum / float(numBlockers);
}

float PCSSFilter(TEXTURE_ACCEPT(shadowMap), vec2 uv, float receiverDepth, int shadowSamples, float filterRadius, float randomSeed) {
 
    PoissonDiskData poissonData;
    preparePoissonConstants(poissonData, shadowSamples, 11, randomSeed);

    float sum = 0.0f;
    for ( int i = 0; i < shadowSamples; ++i )
    {
        vec2 poissonUV = generatePoissonSample(poissonData);
        vec2 sampleUV = uv + poissonUV * filterRadius;
        float depth = texture2DLod(shadowMap, sampleUV, 0.0).r;
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
