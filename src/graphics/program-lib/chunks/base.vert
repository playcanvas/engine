
attribute0 vec3 vertex_position;
attribute1 vec3 vertex_normal;
attribute2 vec2 vertex_texCoord0;
attribute3 vec2 vertex_texCoord1;
attribute4 vec4 vertex_tangent;
attribute7 vec4 vertex_color;

uniform mat4 matrix_viewProjection;

uniform mat4 matrix_model;
uniform mat3 matrix_normal;

vec3 dPositionW;
mat4 dModelMatrix;
mat3 dNormalMatrix;
vec3 dLightPosW;
vec3 dLightDirNormW;
vec3 dNormalW;

