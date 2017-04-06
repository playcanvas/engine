float getShadowPCF5x5VS(sampler2DShadow shadowMap, vec3 shadowParams) {
    dShadowCoord = vMainShadowUv.xyz;
    return _getShadowPCF5x5(shadowMap, shadowParams);
}

