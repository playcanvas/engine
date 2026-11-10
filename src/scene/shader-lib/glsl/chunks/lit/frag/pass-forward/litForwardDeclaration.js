// shader declarations for the lit material for forward rendering
export default /* glsl */`

// The world position the lighting is evaluated at, and its view depth, which selects the shadow
// cascade and limits the shadow distance. Both are the rasterized fragment's unless the front end sets
// them; a front end setting the position also sets dVertexNormalW, dViewDirW and dViewDepth to match.
// The position is declared here rather than with the other litArgs, as the fog reads it before a
// front end declares those
vec3 litArgs_worldPosition;
float dViewDepth;

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

#ifdef LIT_DIFFUSE_TRANSMISSION
    // the light arriving at the back of the surface, which the diffuse transmission lets through
    vec3 dDiffuseTransmissionLight = vec3(0.0);
#endif

// FRAGMENT SHADER INPUTS: UNIFORMS

#ifndef LIT_OPACITY_FADES_SPECULAR
    uniform float material_alphaFade;
#endif

#ifdef LIT_AO
    uniform float material_occludeDirect;
#endif

#ifdef LIT_NEEDS_NORMAL
    uniform float material_twoSidedLighting;
#endif

#ifdef LIT_SSAO
    uniform sampler2D ssaoTexture;
    uniform vec2 ssaoTextureSizeInv;
#endif

// dynamic refraction
#ifdef LIT_SCENE_COLOR
    uniform sampler2D uSceneColorMap;
#endif

#ifdef LIT_SCREEN_SIZE
    uniform vec4 screen_size;
#endif

#ifdef LIT_TRANSFORMS
    uniform mat4 matrix_viewProjection;
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

// lightmap baking
#ifdef STD_LIGHTMAP_DIR
    uniform float bakeDir;
#endif
#ifdef LIT_LIGHTMAP_BAKING_ADD_AMBIENT
    uniform float ambientBakeOcclusionContrast;
    uniform float ambientBakeOcclusionBrightness;
#endif
`;
