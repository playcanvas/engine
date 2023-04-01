export default /* glsl */`

// texelFetch support and others
#extension GL_EXT_samplerless_texture_functions : require

layout(location = 0) out highp vec4 pc_fragColor;
#define gl_FragColor pc_fragColor

#define texture2D(res, uv) texture(sampler2D(res, res ## _sampler), uv)
#define texture2DBias(res, uv, bias) texture(sampler2D(res, res ## _sampler), uv, bias)
#define texture2DLodEXT(res, uv, lod) textureLod(sampler2D(res, res ## _sampler), uv, lod)
#define textureCube(res, uv) texture(samplerCube(res, res ## _sampler), uv)
#define textureCubeLodEXT(res, uv, lod) textureLod(samplerCube(res, res ## _sampler), uv, lod)
#define textureShadow(res, uv) textureLod(sampler2DShadow(res, res ## _sampler), uv, 0.0)

// TODO: implement other texture sampling macros
// #define texture2DProj textureProj
// #define texture2DProjLodEXT textureProjLod
// #define texture2DGradEXT textureGrad
// #define texture2DProjGradEXT textureProjGrad
// #define textureCubeGradEXT textureGrad

// pass / accept shadow map as a function parameter, passes both the texture as well as sampler
// as the combined sampler can be only created at a point of use
#define SHADOWMAP_PASS(name) name, name ## _sampler
#define SHADOWMAP_ACCEPT(name) texture2D name, sampler name ## _sampler
#define TEXTURE_PASS(name) name, name ## _sampler
#define TEXTURE_ACCEPT(name) texture2D name, sampler name ## _sampler

#define GL2
#define WEBGPU
#define SUPPORTS_TEXLOD
`;
