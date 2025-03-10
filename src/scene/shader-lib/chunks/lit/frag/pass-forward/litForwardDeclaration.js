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

// Outputs
mat3 dTBN;
vec4 dReflection;
vec3 dDiffuseLight;
vec3 dSpecularLight;
float dAtten;
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

// LOOP - uniform declarations for all non-clustered lights
#include "lightDeclarationPS, LIGHT_COUNT"

#ifdef LIT_SPECULAR
    #if LIT_FRESNEL_MODEL == NONE && !defined(LIT_REFLECTIONS) && !defined(LIT_DIFFUSE_MAP) 
        #define LIT_OLD_AMBIENT
    #endif
#endif
`;
