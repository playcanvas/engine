// Core include for lighting / shadowing code.
export default /* glsl */`

// clustered lighting
#ifdef CLUSTERED_LIGHTS
    // include this before shadow / cookie code
    #include "clusteredLightUtilsPS"
    #ifdef CLUSTER_COOKIES
        #include "clusteredLightCookiesPS"
    #endif
#endif

#ifdef AREA_LIGHTS
    uniform highp sampler2D areaLightsLutTex1;
    uniform highp sampler2D areaLightsLutTex2;
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
    #include "shadowPCSSPS"
    #include "shadowSoftPS"
#endif

#if defined(SHADOW_KIND_VSM)
    #include "shadowEVSMPS"
#endif
`;
