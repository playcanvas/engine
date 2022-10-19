export default /* glsl */`
#define texture2DBias texture2D

#ifndef SUPPORTS_TEXLOD

// fallback for lod instructions
#define texture2DLodEXT texture2D
#define texture2DProjLodEXT textureProj
#define textureCubeLodEXT textureCube
#define textureShadow texture2D

#else

#define textureShadow(res, uv) texture2DGradEXT(res, uv, vec2(1, 1), vec2(1, 1))

#endif

`;
