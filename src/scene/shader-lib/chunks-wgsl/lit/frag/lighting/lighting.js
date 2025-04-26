// functionality includes for lighting / shadowing code.
export default /* wgsl */`

#ifdef LIT_CLUSTERED_LIGHTS
    // all this functionality that needs to be included for clustered lighting
    #define LIT_CODE_FALLOFF_LINEAR
    #define LIT_CODE_FALLOFF_SQUARED
    #define LIT_CODE_LIGHTS_POINT
    #define LIT_CODE_LIGHTS_SPOT
#endif

#ifdef AREA_LIGHTS
    var areaLightsLutTex1: texture_2d<f32>;
    var areaLightsLutTex1Sampler: sampler;
    var areaLightsLutTex2: texture_2d<f32>;
    var areaLightsLutTex2Sampler: sampler;
#endif

#ifdef LIT_LIGHTING
    #include "lightDiffuseLambertPS"

    // area lights
    #if defined(AREA_LIGHTS) || defined(LIT_CLUSTERED_AREA_LIGHTS)
        #include "ltcPS"
    #endif
#endif

#ifdef SHADOW_DIRECTIONAL
    #include "shadowCascadesPS"
#endif

#if defined(SHADOW_KIND_PCF1)
    #include "shadowPCF1PS"
#endif

#if defined(SHADOW_KIND_PCF3)
    #include "shadowPCF3PS"
#endif

#if defined(SHADOW_KIND_PCF5)
    #include "shadowPCF5PS"
#endif

#if defined(SHADOW_KIND_PCSS)
    #include "linearizeDepthPS"

    // omni / spot PCSS is not supported on WebGPU currently, as this is only for non-clustered lights
    // #include "shadowPCSSPS"
    #include "shadowSoftPS"
#endif

#if defined(SHADOW_KIND_VSM)
    #include "shadowEVSMPS"
#endif

#ifdef LIT_CODE_FALLOFF_LINEAR
    #include "falloffLinearPS"
#endif

#ifdef LIT_CODE_FALLOFF_SQUARED
    #include "falloffInvSquaredPS"
#endif

#ifdef LIT_CODE_LIGHTS_POINT
    #include "lightDirPointPS"
#endif

#ifdef LIT_CODE_LIGHTS_SPOT
    #include "spotPS"
#endif

#ifdef LIT_CODE_COOKIE
    #include "cookiePS"
#endif

// clustered lighting
#ifdef LIT_CLUSTERED_LIGHTS
    #include "clusteredLightPS"
#endif

#ifdef LIGHT_COUNT > 0
    // LOOP - generate shadow evaluation functions for all non-clustered lights
    #include "lightFunctionShadowPS, LIGHT_COUNT"

    // LOOP - generate light evaluation functions for all non-clustered lights
    #include "lightFunctionLightPS, LIGHT_COUNT"
#endif
`;
