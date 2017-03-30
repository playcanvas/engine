float getShadowPCF5x5VS(sampler2DShadow shadowMap, vec3 shadowParams) {
    dShadowCoord = vMainShadowUv.xyz;

    dShadowCoord.z = saturate(dShadowCoord.z) - 0.0001;
    dShadowCoord.z += getShadowBias(shadowParams.x, shadowParams.z);

    return _getShadowPCF5x5(shadowMap, shadowParams);
}

