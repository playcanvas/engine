// shader declarations for the lit material for forward rendering
export default /* wgsl */`

// globals
var<private> sReflection: vec3f;
var<private> dVertexNormalW: vec3f;
var<private> dTangentW: vec3f;
var<private> dBinormalW: vec3f;
var<private> dViewDirW: vec3f;
var<private> dReflDirW: vec3f;
var<private> ccReflDirW: vec3f;

// Per-light temporaries
var<private> dLightDirNormW: vec3f;
var<private> dAtten: f32;

// Outputs
var<private> dTBN: mat3x3f;
var<private> dReflection: vec4f;
var<private> dDiffuseLight: vec3f;
var<private> dSpecularLight: vec3f;
var<private> ccFresnel: f32;
var<private> ccReflection: vec3f;
var<private> ccSpecularLight: vec3f;
var<private> ccSpecularityNoFres: f32;
var<private> sSpecularLight: vec3f;

// FRAGMENT SHADER INPUTS: UNIFORMS

#ifdef LIT_DISPERSION
    uniform material_dispersion: f32;
#endif

#ifndef LIT_OPACITY_FADES_SPECULAR
    uniform material_alphaFade: f32;
#endif

#ifdef LIT_SSAO
    var ssaoTexture : texture_2d<f32>;
    var ssaoTextureSampler : sampler;
    uniform ssaoTextureSizeInv: vec2f;
#endif

// lighting and shadowing declarations

#ifdef LIT_SHADOW_CATCHER
    // a variable to accumulate shadows for shadow catcher materials
    var<private> dShadowCatcher: f32 = 1.0;
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
    uniform bakeDir: f32;
#endif
#ifdef LIT_LIGHTMAP_BAKING_ADD_AMBIENT
    uniform ambientBakeOcclusionContrast: f32;
    uniform ambientBakeOcclusionBrightness: f32;
#endif
`;
