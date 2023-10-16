export default /* glsl */`

/**
 * PCSS is a shadow sampling method that provides contact hardening soft shadows. 
 * Based on: 
 * - https://www.gamedev.net/tutorials/programming/graphics/effect-area-light-shadows-part-1-pcss-r4971/
 * - https://github.com/pboechat/PCSS 
 */


#define PCSS_SAMPLE_COUNT 16
uniform float pcssDiskSamples[PCSS_SAMPLE_COUNT];
uniform float pcssSphereSamples[PCSS_SAMPLE_COUNT];

vec2 vogelDisk(int sampleIndex, float count, float phi, float r) {
    const float GoldenAngle = 2.4;
    float theta = float(sampleIndex) * GoldenAngle + phi;

    float sine = sin(theta);
    float cosine = cos(theta);
    return vec2(r * cosine, r * sine);
}

vec3 vogelSphere(int sampleIndex, float count, float phi, float r) {
    const float GoldenAngle = 2.4;
    float theta = float(sampleIndex) * GoldenAngle + phi;

    float weight = float(sampleIndex) / count;
    return vec3(cos(theta) * r, weight, sin(theta) * r);
}

float noise(vec2 screenPos) {
    const float PHI = 1.61803398874989484820459;  // Φ = Golden Ratio   
    return fract(sin(dot(screenPos * PHI, screenPos)) * screenPos.x);
}

#ifndef UNPACKFLOAT
#define UNPACKFLOAT
float unpackFloat(vec4 rgbaDepth) {
    const vec4 bitShift = vec4(1.0 / (256.0 * 256.0 * 256.0), 1.0 / (256.0 * 256.0), 1.0 / 256.0, 1.0);
    return dot(rgbaDepth, bitShift);
}
#endif

float viewSpaceDepth(float depth, mat4 invProjection) {
    float z = depth * 2.0 - 1.0;
    vec4 clipSpace = vec4(0.0, 0.0, z, 1.0);
    vec4 viewSpace = invProjection * clipSpace;
    return viewSpace.z;
}

float PCSSBlockerDistance(TEXTURE_ACCEPT(shadowMap), vec2 sampleCoords[PCSS_SAMPLE_COUNT], vec2 shadowCoords, vec2 searchSize, float z) {

    float blockers = 0.0;
    float averageBlocker = 0.0;
    for (int i = 0; i < PCSS_SAMPLE_COUNT; i++) {
        vec2 offset = sampleCoords[i] * searchSize;
        vec2 sampleUV = shadowCoords + offset;

    #ifdef GL2
        float blocker = textureLod(shadowMap, sampleUV, 0.0).r;
    #else // GL1
        float blocker = unpackFloat(texture2D(shadowMap, sampleUV));
    #endif        
        float isBlocking = step(blocker, z);
        blockers += isBlocking;
        averageBlocker += blocker * isBlocking;
    }

    if (blockers > 0.0)
        return averageBlocker /= blockers;
    return -1.0;
}

float PCSS(TEXTURE_ACCEPT(shadowMap), vec3 shadowCoords, vec4 cameraParams, vec2 shadowSearchArea) {
    float receiverDepth = shadowCoords.z;
#ifndef GL2
    // If using packed depth on GL1, we need to normalize to get the correct receiver depth
    receiverDepth *= 1.0 / (cameraParams.y - cameraParams.z);
#endif

    vec2 samplePoints[PCSS_SAMPLE_COUNT];
    float noise = noise( gl_FragCoord.xy ) * 2.0 * PI;
    for (int i = 0; i < PCSS_SAMPLE_COUNT; i++) {
        float pcssPresample = pcssDiskSamples[i];
        samplePoints[i] = vogelDisk(i, float(PCSS_SAMPLE_COUNT), noise, pcssPresample);
    }

    float averageBlocker = PCSSBlockerDistance(TEXTURE_PASS(shadowMap), samplePoints, shadowCoords.xy, shadowSearchArea, receiverDepth);
    if (averageBlocker == -1.0) {
        return 1.0;
    } else {

        vec2 filterRadius = ((receiverDepth - averageBlocker) / averageBlocker) * shadowSearchArea * cameraParams.x;

        float shadow = 0.0;

        for (int i = 0; i < PCSS_SAMPLE_COUNT; i ++)
        {
            vec2 sampleUV = samplePoints[i] * filterRadius;
            sampleUV = shadowCoords.xy + sampleUV;

        #ifdef GL2
            float depth = textureLod(shadowMap, sampleUV, 0.0).r;
        #else // GL1
            float depth = unpackFloat(texture2D(shadowMap, sampleUV));
        #endif
            shadow += step(receiverDepth, depth);
        }
        return shadow / float(PCSS_SAMPLE_COUNT);
    } 
}

float PCSSCubeBlockerDistance(samplerCube shadowMap, vec3 lightDirNorm, vec3 samplePoints[PCSS_SAMPLE_COUNT], float z, float shadowSearchArea) {
    float blockers = 0.0;
    float averageBlocker = 0.0;
    for (int i = 0; i < PCSS_SAMPLE_COUNT; i++) {
        vec3 sampleDir = lightDirNorm + samplePoints[i] * shadowSearchArea;
        sampleDir = normalize(sampleDir);

    #ifdef GL2
        float blocker = textureCubeLodEXT(shadowMap, sampleDir, 0.0).r;
    #else // GL1
        float blocker = unpackFloat(textureCube(shadowMap, sampleDir));
    #endif
        float isBlocking = step(blocker, z);
        blockers += isBlocking;
        averageBlocker += blocker * isBlocking;
    }

    if (blockers > 0.0)
        return averageBlocker /= float(blockers);
    return -1.0;
}

float PCSSCube(samplerCube shadowMap, vec4 shadowParams, vec3 shadowCoords, vec4 cameraParams, float shadowSearchArea, vec3 lightDir) {
    
    vec3 samplePoints[PCSS_SAMPLE_COUNT];
    float noise = noise( gl_FragCoord.xy ) * 2.0 * PI;
    for (int i = 0; i < PCSS_SAMPLE_COUNT; i++) {
        float r = pcssSphereSamples[i];
        samplePoints[i] = vogelSphere(i, float(PCSS_SAMPLE_COUNT), noise, r);
    }

    float receiverDepth = length(lightDir) * shadowParams.w + shadowParams.z;
    vec3 lightDirNorm = normalize(lightDir);
    
    float averageBlocker = PCSSCubeBlockerDistance(shadowMap, lightDirNorm, samplePoints, receiverDepth, shadowSearchArea);
    if (averageBlocker == -1.0) {
        return 1.0;
    } else {

        float filterRadius = ((receiverDepth - averageBlocker) / averageBlocker) * shadowSearchArea;

        float shadow = 0.0;
        for (int i = 0; i < PCSS_SAMPLE_COUNT; i++)
        {
            vec3 offset = samplePoints[i] * filterRadius;
            vec3 sampleDir = lightDirNorm + offset;
            sampleDir = normalize(sampleDir);

            #ifdef GL2
                float depth = textureCubeLodEXT(shadowMap, sampleDir, 0.0).r;
            #else // GL1
                float depth = unpackFloat(textureCube(shadowMap, sampleDir));
            #endif
            shadow += step(receiverDepth, depth);
        }
        return shadow / float(PCSS_SAMPLE_COUNT);
    }
}

float getShadowPointPCSS(samplerCube shadowMap, vec3 shadowCoord, vec4 shadowParams, vec4 cameraParams, vec2 shadowSearchArea, vec3 lightDir) {
    return PCSSCube(shadowMap, shadowParams, shadowCoord, cameraParams, shadowSearchArea.x, lightDir);
}

float getShadowSpotPCSS(TEXTURE_ACCEPT(shadowMap), vec3 shadowCoord, vec4 shadowParams, vec4 cameraParams, vec2 shadowSearchArea, vec3 lightDir) {
    return PCSS(TEXTURE_PASS(shadowMap), shadowCoord, cameraParams, shadowSearchArea);
}

float getShadowPCSS(TEXTURE_ACCEPT(shadowMap), vec3 shadowCoord, vec4 shadowParams, vec4 cameraParams, vec2 shadowSearchArea, vec3 lightDir) {
    return PCSS(TEXTURE_PASS(shadowMap), shadowCoord, cameraParams, shadowSearchArea);
}

`;
