#ifdef GL2
#define SHADOW_SAMPLERVS sampler2DShadow
#else
#define SHADOW_SAMPLERVS sampler2D
#endif

float getShadowPCF3x3VS(SHADOW_SAMPLERVS shadowMap, vec3 shadowParams) {
    dShadowCoord = vMainShadowUv.xyz;
    dShadowCoord.z = saturate(dShadowCoord.z) - 0.0001;

    #ifdef SHADOWBIAS
        dShadowCoord.z += getShadowBias(shadowParams.x, shadowParams.z);
    #endif

    return _getShadowPCF3x3(shadowMap, shadowParams);
}

