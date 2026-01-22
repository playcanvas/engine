// Base format declarations
export default /* wgsl */`
uniform splatTextureSize: u32;

// Splat UV coordinate for texture fetches
var<private> splatUV: vec2i;
`;
