export default /* glsl */`

// WEBGL_multi_draw
#extension GL_ANGLE_multi_draw : enable

#define attribute in
#define varying out
#define texture2D texture
#define utexture2D texture
#define itexture2D texture
#define GL2
#define VERTEXSHADER

#define TEXTURE_PASS(name) name
#define TEXTURE_ACCEPT(name) sampler2D name
#define TEXTURE_ACCEPT_HIGHP(name) highp sampler2D name
`;
