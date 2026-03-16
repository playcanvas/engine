// Declarations for Container GSplat format
export default /* glsl */`
// Format-provided declarations (textures, load functions, uniforms)
#include "gsplatContainerDeclarationsVS"

// Interface variables set by user's read code
vec3 splatCenter;
vec4 splatColor;
vec3 splatScale;
vec4 splatRotation;
`;
