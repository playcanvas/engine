// backend shader implementation code which executes after the front end code.
export default /* wgsl */`

#ifdef LIT_NEEDS_NORMAL
    #include "cubeMapRotatePS"
    #include "cubeMapProjectPS"
    #include "envProcPS"
#endif

// ----- specular or reflections -----
#ifdef LIT_SPECULAR_OR_REFLECTION
    #ifdef LIT_METALNESS
        #include "metalnessModulatePS"
    #endif

    #if LIT_FRESNEL_MODEL == SCHLICK
        #include "fresnelSchlickPS"
    #endif

    #ifdef LIT_IRIDESCENCE
        #include "iridescenceDiffractionPS"
    #endif
#endif

// ----- ambient occlusion -----
#ifdef LIT_AO
    #include "aoDiffuseOccPS"
    #include "aoSpecOccPS"
#endif

#if LIT_REFLECTION_SOURCE == ENVATLASHQ
    #include "envAtlasPS"
    #include "reflectionEnvHQPS"
#elif LIT_REFLECTION_SOURCE == ENVATLAS
    #include "envAtlasPS"
    #include "reflectionEnvPS"
#elif LIT_REFLECTION_SOURCE == CUBEMAP
    #include "reflectionCubePS"
#elif LIT_REFLECTION_SOURCE == SPHEREMAP
    #include "reflectionSpherePS"
#endif

#ifdef LIT_REFLECTIONS
    #ifdef LIT_CLEARCOAT
        #include "reflectionCCPS"
    #endif

    #ifdef LIT_SHEEN
        #include "reflectionSheenPS"
    #endif
#endif

#ifdef LIT_REFRACTION
    #if defined(LIT_DYNAMIC_REFRACTION)
        #include "refractionDynamicPS"
    #elif defined(LIT_REFLECTIONS)
        #include "refractionCubePS"
    #endif
#endif

#ifdef LIT_SHEEN
    #include "lightSheenPS"
#endif

uniform material_ambient: vec3f;

#ifdef LIT_SPECULAR
    #ifdef LIT_LIGHTING
        #ifdef LIT_GGX_SPECULAR
            #include "lightSpecularAnisoGGXPS"
        #else
            #include "lightSpecularBlinnPS"
        #endif
    #endif
#endif

#include "combinePS"

#ifdef LIT_LIGHTMAP
    #include "lightmapAddPS"
#endif

#ifdef LIT_ADD_AMBIENT
    #include "ambientPS"
#endif

#ifdef LIT_MSDF
    #include "msdfPS"
#endif

#ifdef LIT_NEEDS_NORMAL
    #include "viewDirPS"
    #ifdef LIT_SPECULAR
        #ifdef LIT_GGX_SPECULAR
            #include "reflDirAnisoPS"
        #else
            #include "reflDirPS"
        #endif
    #endif
#endif

// lighting functionality
#include "lightingPS"

`;
