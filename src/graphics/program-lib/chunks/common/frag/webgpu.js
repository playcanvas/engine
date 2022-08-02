export default /* glsl */`
out highp vec4 pc_fragColor;
#define gl_FragColor pc_fragColor

#define texture2D(res, uv) texture(sampler2D(res, res ## _sampler), uv)

// TODO: implement other texture sampling macros
// #define textureCube texture
// #define texture2DProj textureProj
// #define texture2DLodEXT textureLod
// #define texture2DProjLodEXT textureProjLod
// #define textureCubeLodEXT textureLod
// #define texture2DGradEXT textureGrad
// #define texture2DProjGradEXT textureProjGrad
// #define textureCubeGradEXT textureGrad
#define GL2
#define SUPPORTS_TEXLOD
`;
