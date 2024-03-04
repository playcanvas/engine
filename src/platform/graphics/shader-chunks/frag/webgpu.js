export default /* glsl */`

// texelFetch support and others
#extension GL_EXT_samplerless_texture_functions : require

#ifndef outType_0
#define outType_0 vec4
#endif
#ifndef outType_1
#define outType_1 vec4
#endif
#ifndef outType_2
#define outType_2 vec4
#endif
#ifndef outType_3
#define outType_3 vec4
#endif
#ifndef outType_4
#define outType_4 vec4
#endif
#ifndef outType_5
#define outType_5 vec4
#endif
#ifndef outType_6
#define outType_6 vec4
#endif
#ifndef outType_7
#define outType_7 vec4
#endif

layout(location = 0) out highp outType_0 pc_fragColor;
layout(location = 1) out highp outType_1 pc_fragColor1;
layout(location = 2) out highp outType_2 pc_fragColor2;
layout(location = 3) out highp outType_3 pc_fragColor3;
layout(location = 4) out highp outType_4 pc_fragColor4;
layout(location = 5) out highp outType_5 pc_fragColor5;
layout(location = 6) out highp outType_6 pc_fragColor6;
layout(location = 7) out highp outType_7 pc_fragColor7;

#define gl_FragColor pc_fragColor

#define pcFragColor0 pc_fragColor
#define pcFragColor1 pc_fragColor1
#define pcFragColor2 pc_fragColor2
#define pcFragColor3 pc_fragColor3
#define pcFragColor4 pc_fragColor4
#define pcFragColor5 pc_fragColor5
#define pcFragColor6 pc_fragColor6
#define pcFragColor7 pc_fragColor7

#define texture2D(res, uv) texture(sampler2D(res, res ## _sampler), uv)
#define texture2DBias(res, uv, bias) texture(sampler2D(res, res ## _sampler), uv, bias)
#define texture2DLodEXT(res, uv, lod) textureLod(sampler2D(res, res ## _sampler), uv, lod)
#define textureCube(res, uv) texture(samplerCube(res, res ## _sampler), uv)
#define textureCubeLodEXT(res, uv, lod) textureLod(samplerCube(res, res ## _sampler), uv, lod)
#define textureShadow(res, uv) textureLod(sampler2DShadow(res, res ## _sampler), uv, 0.0)
#define itexture2D(res, uv) texture(isampler2D(res, res ## _sampler), uv)
#define utexture2D(res, uv) texture(usampler2D(res, res ## _sampler), uv)

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
#define SUPPORTS_MRT
`;
