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

vec3 VogelSphere(float sampleIndex, float count, float phi) {
    float weight = sampleIndex / count;
    float radius = sqrt(1.0 - weight * weight);
    const float GoldenAngle = 2.4;

    float theta = GoldenAngle * sampleIndex + phi;

    return vec3(cos(theta) * radius, weight, sin(theta) * radius);
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


float PCSSBlockerDistance(TEXTURE_ACCEPT(shadowMap), vec2 sampleCoords[PCSS_SAMPLE_COUNT], vec2 shadowCoords, float searchSize, float z) {

    float blockers = 0.0;
    float averageBlocker = 0.0;
    for (int i = 0; i < PCSS_SAMPLE_COUNT; i++) {
        vec2 offset = sampleCoords[i] * searchSize;
        vec2 sampleUV = shadowCoords + offset;

    #ifdef GL2
        float blocker = texture2D(shadowMap, sampleUV).r;
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

float PCSS(TEXTURE_ACCEPT(shadowMap), vec3 shadowCoords, vec4 cameraParams, float oneOverShadowMapSize, float lightSize) {
    float linearDepth = linearizeDepth(shadowCoords.z, cameraParams);
#ifndef GL2
    linearDepth *= 1.0 / (cameraParams.y - cameraParams.z);
#endif

    vec2 samplePoints[PCSS_SAMPLE_COUNT];
    float noise = GradientNoise( gl_FragCoord.xy );
    for (int i = 0; i < PCSS_SAMPLE_COUNT; i++) {
        samplePoints[i] = VogelDisk(float(i), float(PCSS_SAMPLE_COUNT), noise);
    }

    float averageBlocker = PCSSBlockerDistance(TEXTURE_PASS(shadowMap), samplePoints, shadowCoords.xy, oneOverShadowMapSize * lightSize, linearDepth);
    if (averageBlocker == -1.0) {
        return 1.0;
    } else {

        float filterRadius = ((linearDepth - averageBlocker) / averageBlocker) * lightSize * oneOverShadowMapSize;

        float shadow = 0.0;
        float noise = GradientNoise(gl_FragCoord.xy);

        for (int i = 0; i < PCSS_SAMPLE_COUNT; i ++)
        {
            vec2 sampleUV = samplePoints[i] * (filterRadius);
            sampleUV = shadowCoords.xy + sampleUV;

        #ifdef GL2
            float depth = texture2D(shadowMap, sampleUV).r;
        #else // GL1
            float depth = unpackFloat(texture2D(shadowMap, sampleUV));
        #endif
            shadow += step(linearDepth, depth);
        }
        return shadow / float(PCSS_SAMPLE_COUNT);
    } 
}

float PCSSCubeBlockerDistance(samplerCube shadowMap, vec3 lightDirNorm, vec3 samplePoints[PCSS_SAMPLE_COUNT], float z, float lightSize) {
    float blockers = 0.0;
    float averageBlocker = 0.0;
    for (int i = 0; i < PCSS_SAMPLE_COUNT; i++) {
        vec3 sampleDir = lightDirNorm + samplePoints[i] * lightSize;
        sampleDir = normalize(sampleDir);

    #ifdef GL2
        float blocker = textureCube(shadowMap, sampleDir).r;
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

float PCSSCube(samplerCube shadowMap, vec4 shadowParams, vec3 shadowCoords, float lightSize, vec3 lightDir) {

    vec3 samplePoints[PCSS_SAMPLE_COUNT];
    float noise = GradientNoise( gl_FragCoord.xy );
    for (int i = 0; i < PCSS_SAMPLE_COUNT; i++) {
        samplePoints[i] = VogelSphere(float(i), float(PCSS_SAMPLE_COUNT), noise);
    }

    float receiverDepth = length(lightDir) * shadowParams.w + shadowParams.z;
    vec3 lightDirNorm = normalize(lightDir) * 10.0;
    float averageBlocker = PCSSCubeBlockerDistance(shadowMap, lightDirNorm, samplePoints, receiverDepth, lightSize);
    if (averageBlocker == -1.0) {
        return 1.0;
    } else {

        float filterRadius = ((receiverDepth - averageBlocker) / averageBlocker) * lightSize;

        float shadow = 0.0;
        for (int i = 0; i < PCSS_SAMPLE_COUNT; i++)
        {
            vec3 offset = samplePoints[i] * filterRadius;
            vec3 sampleDir = lightDirNorm + offset;
            sampleDir = normalize(sampleDir);

            #ifdef GL2
                float depth = textureCube(shadowMap, sampleDir).r;
            #else // GL1
                float depth = unpackFloat(textureCube(shadowMap, sampleDir));
            #endif
            shadow += step(receiverDepth, depth);
        }
        return shadow / float(PCSS_SAMPLE_COUNT);
    }
}

float getShadowPointPCSS(samplerCube shadowMap, vec3 shadowCoord, vec4 shadowParams, vec4 cameraParams, float lightSize, vec3 lightDir) {
    return PCSSCube(shadowMap, shadowParams, shadowCoord, lightSize, lightDir);
}

float getShadowSpotPCSS(TEXTURE_ACCEPT(shadowMap), vec3 shadowCoord, vec4 shadowParams, vec4 cameraParams, float lightSize, vec3 lightDir) {
    return PCSS(TEXTURE_PASS(shadowMap), shadowCoord, cameraParams, (1.0 / shadowParams.x), lightSize);
}

float getShadowPCSS(TEXTURE_ACCEPT(shadowMap), vec3 shadowCoord, vec4 shadowParams, vec4 cameraParams, float lightSize, vec3 lightDir) {
    return PCSS(TEXTURE_PASS(shadowMap), shadowCoord, cameraParams, (1.0 / shadowParams.x), lightSize);
}

`;
