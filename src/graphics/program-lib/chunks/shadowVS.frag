
float getShadowHardVS(inout psInternalData data, sampler2D shadowMap, vec3 shadowParams) {
    float depth = unpackFloat(texture2DProj(shadowMap, vMainShadowUv));
    return (depth < min(vMainShadowUv.z + shadowParams.z, 1.0)) ? 0.0 : 1.0;
}

float getShadowMaskVS(inout psInternalData data, sampler2D shadowMap, vec3 shadowParams) {
    return unpackMask(texture2DProj(shadowMap, vMainShadowUv));
}

float getShadowPCF3x3VS(inout psInternalData data, sampler2D shadowMap, vec3 shadowParams) {
    data.shadowCoord = vMainShadowUv.xyz;
    data.shadowCoord.z += shadowParams.z;
    data.shadowCoord.xyz /= vMainShadowUv.w;
    data.shadowCoord.z = min(data.shadowCoord.z, 1.0);
    return _getShadowPCF3x3(data, shadowMap, shadowParams);
}

float getShadowPCF3x3_YZWVS(inout psInternalData data, sampler2D shadowMap, vec3 shadowParams) {
    data.shadowCoord = vMainShadowUv.xyz;
    data.shadowCoord.z += shadowParams.z;
    data.shadowCoord.xyz /= vMainShadowUv.w;
    data.shadowCoord.z = min(data.shadowCoord.z, 1.0);
    return _getShadowPCF3x3_YZW(data, shadowMap, shadowParams);
}

