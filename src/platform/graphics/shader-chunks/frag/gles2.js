export default /* glsl */`
#define texture2DBias texture2D

// pass / accept shadow map or texture as a function parameter, on webgl this is simply passsed as is
// but this is needed for WebGPU
#define SHADOWMAP_PASS(name) name
#define SHADOWMAP_ACCEPT(name) sampler2D name
#define TEXTURE_PASS(name) name
#define TEXTURE_ACCEPT(name) sampler2D name

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
