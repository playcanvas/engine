// shader declarations for the lit material for forward rendering
export default /* glsl */`

// globals
vec3 sReflection;
vec3 dVertexNormalW;
vec3 dTangentW;
vec3 dBinormalW;
vec3 dViewDirW;
vec3 dReflDirW;
vec3 ccReflDirW;

// Per-light temporaries
vec3 dLightDirNormW;
float dAtten;

// Outputs
mat3 dTBN;
vec4 dReflection;
vec3 dDiffuseLight;
vec3 dSpecularLight;
float ccFresnel;
vec3 ccReflection;
vec3 ccSpecularLight;
float ccSpecularityNoFres;
vec3 sSpecularLight;

// FRAGMENT SHADER INPUTS: UNIFORMS

#ifdef LIT_DISPERSION
    uniform float material_dispersion;
#endif

#ifndef LIT_OPACITY_FADES_SPECULAR
    uniform float material_alphaFade;
#endif

#ifdef LIT_SSAO
    uniform sampler2D ssaoTexture;
    uniform vec2 ssaoTextureSizeInv;
#endif

// lighting and shadowing declarations

#ifdef LIT_SHADOW_CATCHER
    // a variable to accumulate shadows for shadow catcher materials
    float dShadowCatcher = 1.0;
#endif

// LOOP - uniform declarations for all non-clustered lights
#if LIGHT_COUNT > 0
    #include "lightDeclarationPS, LIGHT_COUNT"
#endif

#ifdef LIT_SPECULAR
    #if LIT_FRESNEL_MODEL == NONE && !defined(LIT_REFLECTIONS) && !defined(LIT_DIFFUSE_MAP) 
        #define LIT_OLD_AMBIENT
    #endif
#endif

// lightmap baking
#ifdef STD_LIGHTMAP_DIR
    uniform float bakeDir;
#endif
#ifdef LIT_LIGHTMAP_BAKING_ADD_AMBIENT
    uniform float ambientBakeOcclusionContrast;
    uniform float ambientBakeOcclusionBrightness;
#endif
`;
