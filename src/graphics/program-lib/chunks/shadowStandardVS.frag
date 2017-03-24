float getShadowPCF3x3VS(sampler2D shadowMap, vec3 shadowParams) {
    dShadowCoord = vMainShadowUv.xyz;

    dShadowCoord.z = saturate(dShadowCoord.z) - 0.0001;
    dShadowCoord.z += getShadowBias(shadowParams.x, shadowParams.z);

    return _getShadowPCF3x3(shadowMap, shadowParams);
}

