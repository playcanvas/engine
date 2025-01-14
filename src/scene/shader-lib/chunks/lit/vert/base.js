export default /* glsl */`
attribute vec4 vertex_tangent;
attribute vec2 vertex_texCoord0;
attribute vec2 vertex_texCoord1;
attribute vec4 vertex_color;

vec3 dPositionW;
mat4 dModelMatrix;

#include "transformCoreVS"
`;
