// Base format declarations and format-specific include
export default /* wgsl */`
uniform splatTextureSize: u32;
var<private> splatUV: vec2i;

#include "gsplatDeclarationsVS"
`;
