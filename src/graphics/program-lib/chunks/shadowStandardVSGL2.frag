float getShadowHardVS(sampler2DShadow shadowMap, vec3 shadowParams) {
    dShadowCoord = vMainShadowUv.xyz;
    dShadowCoord.z += getShadowBias(shadowParams.x, shadowParams.z);
    dShadowCoord.xyz /= vMainShadowUv.w;
    return texture2Dshadow(shadowMap, dShadowCoord);
}

float getShadowPCF3x3VS(sampler2DShadow shadowMap, vec3 shadowParams) {
    dShadowCoord = vMainShadowUv.xyz;

    dShadowCoord.z += getShadowBias(shadowParams.x, shadowParams.z);

    dShadowCoord.xyz /= vMainShadowUv.w;
    dShadowCoord.z = min(dShadowCoord.z, 1.0);
    return _getShadowPCF3x3(shadowMap, shadowParams);
}

