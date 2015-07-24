
attribute vec3 vertex_position;
attribute vec3 vertex_normal;
attribute vec4 vertex_tangent;
attribute vec2 vertex_texCoord0;
attribute vec2 vertex_texCoord1;
attribute vec4 vertex_color;

uniform mat4 matrix_viewProjection;
uniform mat4 matrix_model;
uniform mat3 matrix_normal;

struct vsInternalData {
    vec3 positionW;
    mat4 modelMatrix;
    mat3 normalMatrix;
    vec3 lightPosW;
    vec3 lightDirNormW;
    vec3 normalW;
};

