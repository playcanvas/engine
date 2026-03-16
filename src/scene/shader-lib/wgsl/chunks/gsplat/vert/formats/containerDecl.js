// Declarations for Container GSplat format
export default /* wgsl */`
// Format-provided declarations (textures, load functions, uniforms)
#include "gsplatContainerDeclarationsVS"

// Interface variables set by user's read code
var<private> splatCenter: vec3f;
var<private> splatColor: vec4f;
var<private> splatScale: vec3f;
var<private> splatRotation: vec4f;
`;
