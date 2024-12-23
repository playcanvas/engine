export default /* glsl */`

#ifndef outType_0
#define outType_0 vec4
#endif

layout(location = 0) out highp outType_0 pc_fragColor;

#ifndef REMOVE_COLOR_ATTACHMENT_1
#if COLOR_ATTACHMENT_1
layout(location = 1) out highp outType_1 pc_fragColor1;
#endif
#endif

#ifndef REMOVE_COLOR_ATTACHMENT_2
#if COLOR_ATTACHMENT_2
layout(location = 2) out highp outType_2 pc_fragColor2;
#endif
#endif

#ifndef REMOVE_COLOR_ATTACHMENT_3
#if COLOR_ATTACHMENT_3
layout(location = 3) out highp outType_3 pc_fragColor3;
#endif
#endif

#ifndef REMOVE_COLOR_ATTACHMENT_4
#if COLOR_ATTACHMENT_4
layout(location = 4) out highp outType_4 pc_fragColor4;
#endif
#endif

#ifndef REMOVE_COLOR_ATTACHMENT_5
#if COLOR_ATTACHMENT_5
layout(location = 5) out highp outType_5 pc_fragColor5;
#endif
#endif

#ifndef REMOVE_COLOR_ATTACHMENT_6
#if COLOR_ATTACHMENT_6
layout(location = 6) out highp outType_6 pc_fragColor6;
#endif
#endif

#ifndef REMOVE_COLOR_ATTACHMENT_7
#if COLOR_ATTACHMENT_7
layout(location = 7) out highp outType_7 pc_fragColor7;
#endif
#endif

#define gl_FragColor pc_fragColor

#define pcFragColor0 pc_fragColor
#define pcFragColor1 pc_fragColor1
#define pcFragColor2 pc_fragColor2
#define pcFragColor3 pc_fragColor3
#define pcFragColor4 pc_fragColor4
#define pcFragColor5 pc_fragColor5
#define pcFragColor6 pc_fragColor6
#define pcFragColor7 pc_fragColor7

#define varying in

#define texture2D texture
#define texture2DBias texture
#define textureCube texture
#define texture2DProj textureProj
#define texture2DLod textureLod
#define texture2DProjLod textureProjLod
#define textureCubeLod textureLod
#define texture2DGrad textureGrad
#define texture2DProjGrad textureProjGrad
#define textureCubeGrad textureGrad
#define utexture2D texture
#define itexture2D texture

// deprecated defines
#define texture2DLodEXT texture2DLodEXT_is_no_longer_supported_use_texture2DLod_instead
#define texture2DProjLodEXT texture2DProjLodEXT_is_no_longer_supported_use_texture2DProjLod
#define textureCubeLodEXT textureCubeLodEXT_is_no_longer_supported_use_textureCubeLod_instead
#define texture2DGradEXT texture2DGradEXT_is_no_longer_supported_use_texture2DGrad_instead
#define texture2DProjGradEXT texture2DProjGradEXT_is_no_longer_supported_use_texture2DProjGrad_instead
#define textureCubeGradEXT textureCubeGradEXT_is_no_longer_supported_use_textureCubeGrad_instead

// sample shadows using textureGrad to remove derivatives in the dynamic loops (which are used by
// clustered lighting) - as DirectX shader compiler tries to unroll the loops and takes long time
// to compile the shader. Using textureLod would be even better, but WebGl does not translate it to
// lod instruction for DirectX correctly and uses SampleCmp instead of SampleCmpLevelZero or similar.
#define textureShadow(res, uv) textureGrad(res, uv, vec2(1, 1), vec2(1, 1))

// pass / accept shadow map or texture as a function parameter, on webgl this is simply passed as is
// but this is needed for WebGPU
#define SHADOWMAP_PASS(name) name
#define SHADOWMAP_ACCEPT(name) sampler2DShadow name
#define TEXTURE_PASS(name) name
#define TEXTURE_ACCEPT(name) sampler2D name
#define TEXTURE_ACCEPT_HIGHP(name) highp sampler2D name

#define GL2
`;
