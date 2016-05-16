// ----- Direct/Spot Sampling -----

float getShadowHard(sampler2D shadowMap, vec3 shadowParams) {
    float depth = unpackFloat(texture2D(shadowMap, dShadowCoord.xy));
    return (depth < dShadowCoord.z) ? 0.0 : 1.0;
}

float getShadowSpotHard(sampler2D shadowMap, vec4 shadowParams) {
    float depth = unpackFloat(texture2D(shadowMap, dShadowCoord.xy));
    return (depth < (length(dLightDirW) * shadowParams.w + shadowParams.z)) ? 0.0 : 1.0;
}

// ----- Point Sampling -----

float getShadowPointHard(samplerCube shadowMap, vec4 shadowParams) {
    float depth = unpackFloat(textureCube(shadowMap, dLightDirNormW));
    return float(depth > length(dLightDirW) * shadowParams.w + shadowParams.z);
}

void normalOffsetPointShadow(vec4 shadowParams) {
    float distScale = length(dLightDirW);
    vec3 wPos = vPositionW + vNormalW * shadowParams.y * clamp(1.0 - dot(vNormalW, -dLightDirNormW), 0.0, 1.0) * distScale; //0.02
    vec3 dir = wPos - dLightPosW;
    dLightDirW = dir;
}

