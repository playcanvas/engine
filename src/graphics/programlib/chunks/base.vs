
// Compiler should remove unneeded stuff
attribute vec3 vertex_position;
attribute vec3 vertex_normal;
attribute vec4 vertex_tangent;
attribute vec2 vertex_texCoord0;
attribute vec2 vertex_texCoord1;
attribute vec4 vertex_color;

uniform mat4 matrix_viewProjection;
uniform mat4 matrix_model;
uniform mat3 matrix_normal;
$sharedUniform vec3 view_position;

varying vec3 vPositionW;
varying vec3 vNormalW;
varying vec3 vTangentW;
varying vec3 vBinormalW;
varying vec2 vUv0;
varying vec2 vUv1;
varying vec4 vVertexColor;
varying vec3 vNormalV;

struct vsInternalData {
    vec3 positionW;
    mat4 modelMatrix;
    mat3 normalMatrix;
};

