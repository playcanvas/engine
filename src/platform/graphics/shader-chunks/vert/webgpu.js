export default /* glsl */`
#define texture2D(res, uv) texture(sampler2D(res, res ## _sampler), uv)

#define GL2
#define WEBGPU
#define VERTEXSHADER
`;
