export default /* glsl */`

// texelFetch support and others
#extension GL_EXT_samplerless_texture_functions : require

#define texture2D(res, uv) texture(sampler2D(res, res ## _sampler), uv)

#define GL2
#define WEBGPU
#define VERTEXSHADER
`;
