export default /* glsl */`

#define pcFragColor0 gl_FragData[0]

#if COLOR_ATTACHMENT_1
#define pcFragColor1 gl_FragData[1]
#endif

#if COLOR_ATTACHMENT_2
#define pcFragColor2 gl_FragData[2]
#endif

#if COLOR_ATTACHMENT_3
#define pcFragColor3 gl_FragData[3]
#endif

#if COLOR_ATTACHMENT_4
#define pcFragColor4 gl_FragData[4]
#endif

#if COLOR_ATTACHMENT_5
#define pcFragColor5 gl_FragData[5]
#endif

#if COLOR_ATTACHMENT_6
#define pcFragColor6 gl_FragData[6]
#endif

#if COLOR_ATTACHMENT_7
#define pcFragColor7 gl_FragData[7]
#endif

#define texture2DBias texture2D
#define itexture2D texture2D
#define utexture2D texture2D

// pass / accept shadow map or texture as a function parameter, on webgl this is simply passed as is
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

#ifdef SUPPORTS_MRT
    #define gl_FragColor pcFragColor0
#endif

`;
