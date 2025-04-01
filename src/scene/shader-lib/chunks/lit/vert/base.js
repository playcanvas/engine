export default /* glsl */`
attribute vec4 vertex_tangent;
attribute vec2 vertex_texCoord0;
attribute vec2 vertex_texCoord1;
//magnopus patched additional UVS
attribute vec2 vertex_texCoord2;
attribute vec2 vertex_texCoord3;
attribute vec2 vertex_texCoord4;
attribute vec4 vertex_color;

vec3 dPositionW;
mat4 dModelMatrix;

#include "transformCoreVS"
`;
