export default /* glsl */`


#define PCSS_SAMPLE_COUNT 16

vec2 VogelDisk(float sampleIndex, float count, float phi)
{
    const float GoldenAngle = 2.4;
    float r = sqrt(sampleIndex + 0.5) / sqrt(count);

    float theta = sampleIndex * GoldenAngle + phi;

    float sine, cosine;
    sine = sin(theta);
    cosine = cos(theta);

    return vec2(r * cosine, r * sine);
}

float GradientNoise(vec2 screenPos) {
    vec3 magic = vec3(0.06711056, 0.00583715, 52.9829189);
    return fract(magic.z * fract(dot(screenPos, magic.xy)));
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


float PCSSBlockerDistance(sampler2D shadowMap, vec2 sampleCoords[PCSS_SAMPLE_COUNT], vec2 shadowCoords, float searchSize, float z) {

    float blockers = 0.0;
    float averageBlocker = 0.0;
    for (int i = 0; i < PCSS_SAMPLE_COUNT; i++) {
        vec2 offset = sampleCoords[i] * searchSize;
        vec2 sampleUV = shadowCoords + offset;

        float blocker = unpackFloat(texture2D(shadowMap, sampleUV));
        float isBlocking = step(blocker, z);
        blockers += isBlocking;
        averageBlocker += blocker * isBlocking;
    }

    if (blockers > 0.0)
        return averageBlocker /= blockers;
    return -1.0;
}

float PCSS(sampler2D shadowMap, vec3 shadowCoords, float oneOverShadowMapSize, float lightSize) {
    vec2 samplePoints[PCSS_SAMPLE_COUNT];
    float noise = GradientNoise( gl_FragCoord.xy );

    for (int i = 0; i < PCSS_SAMPLE_COUNT; i++) {
        samplePoints[i] = VogelDisk(float(i), float(PCSS_SAMPLE_COUNT), noise);
    }

    float averageBlocker = PCSSBlockerDistance(shadowMap, samplePoints, shadowCoords.xy, oneOverShadowMapSize * lightSize, shadowCoords.z);
    if (averageBlocker == -1.0) {
        return 1.0;
    } else {

        float filterRadius = ((shadowCoords.z - averageBlocker) / averageBlocker) * lightSize * oneOverShadowMapSize;

        float shadow = 0.0;
        float noise = GradientNoise(gl_FragCoord.xy);

        for (int i = 0; i < PCSS_SAMPLE_COUNT; i ++)
        {
            vec2 sampleUV = samplePoints[i] * (filterRadius);
            sampleUV = shadowCoords.xy + sampleUV;

            float depth = unpackFloat(texture2D(shadowMap, sampleUV));
            shadow += step(shadowCoords.z, depth);
        }
        return shadow / float(PCSS_SAMPLE_COUNT);
    } 
}

/*
float PCSSCubeBlockerDistance(samplerCube shadowMap, vec3 lightDir, vec3 sampleDirX, vec3 sampleDirY, float oneOverShadowMapSize, float z, float lightSize) {
    int blockers = 0;
    float averageBlocker = 0.0;
    float noise = GradientNoise(gl_FragCoord.xy);
    for (int i = 0.0; i < PCSS_SAMPLE_COUNT; i += 1.0) {
        vec2 offset = VogelDisk(i, PCSS_SAMPLE_COUNT, noise) * lightSize * 2.0;
        vec3 sampleDir = lightDir + offset.x * sampleDirX + offset.y * sampleDirY;
        sampleDir = normalize(sampleDir);

        float blocker = unpackFloat(textureCube(shadowMap, sampleDir));
        if (blocker < z) {
            blockers++; 
            averageBlocker += blocker;
        }
    }

    if (blockers > 0)
        return averageBlocker /= float(blockers);
    return -1.0;
}

float PCSSCube(samplerCube shadowMap, vec4 shadowParams, vec3 shadowCoords, float oneOverShadowMapSize, float lightSize, vec3 lightDir) {

    vec3 tc = normalize(lightDir);
    vec3 tcAbs = abs(lightDir);
    float shadowZ = length(lightDir) * shadowParams.w + shadowParams.z;

    vec3 dirX = vec3(1,0,0);
    vec3 dirY = vec3(0,1,0);
    float majorAxisLength = tc.z;
    if ((tcAbs.x > tcAbs.y) && (tcAbs.x > tcAbs.z)) {
        dirX = vec3(0,0,1);
        dirY = vec3(0,1,0);
        majorAxisLength = tc.x;
    } else if ((tcAbs.y > tcAbs.x) && (tcAbs.y > tcAbs.z)) {
        dirX = vec3(1,0,0);
        dirY = vec3(0,0,1);
        majorAxisLength = tc.y;
    }
    
    float shadowParamsInFaceSpace = oneOverShadowMapSize * 2.0 * abs(majorAxisLength);
    dirX *= shadowParamsInFaceSpace;
    dirY *= shadowParamsInFaceSpace;

    float averageBlocker = PCSSCubeBlockerDistance(shadowMap, tc, dirX, dirY, oneOverShadowMapSize, shadowZ, lightSize);
    if (averageBlocker == -1.0) {
        return 1.0;
    } else {

        float filterRadius = (shadowZ - averageBlocker) / averageBlocker;

        float shadow = 0.0;
        float noise = GradientNoise(gl_FragCoord.xy);

        for (float i = 0.0; i < PCSS_SAMPLE_COUNT; i += 1.0)
        {
            vec2 offset = VogelDisk(i, PCSS_SAMPLE_COUNT, noise) * lightSize;
            vec3 sampleDir = tc + offset.x * dirX + offset.y * dirY;
            sampleDir = normalize(sampleDir);

            float depth = unpackFloat(textureCube(shadowMap, sampleDir));
            shadow += step(shadowZ, depth);
        }
        return shadow / PCSS_SAMPLE_COUNT;
    }
}
*/
float getShadowPointPCSS(samplerCube shadowMap, vec3 shadowCoord, vec4 shadowParams, float lightSize, vec3 lightDir) {
    //return PCSSCube(shadowMap, shadowParams, shadowCoord, (1.0 / shadowParams.x), lightSize, lightDir);
    return 1.0;
}

float getShadowSpotPCSS(sampler2D shadowMap, vec3 shadowCoord, vec4 shadowParams, float lightSize, vec3 lightDir) {
    return PCSS(shadowMap, shadowCoord, (1.0 / shadowParams.x), lightSize);
}

float getShadowPCSS(sampler2D shadowMap, vec3 shadowCoord, vec3 shadowParams, float lightSize, vec3 lightDir) {
    return PCSS(shadowMap, shadowCoord, (1.0 / shadowParams.x), lightSize);
}

`;
