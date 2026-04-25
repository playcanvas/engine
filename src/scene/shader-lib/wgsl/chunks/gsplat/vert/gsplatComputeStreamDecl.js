// Template for compute shader stream declaration - binding, var, and load functions
// Placeholders: {binding}, {name}, {textureType}, {returnType}, {funcName}
// Uses uniforms.splatTextureSize (compute uniform struct) instead of uniform.splatTextureSize (vertex)
export default /* wgsl */`
@group(0) @binding({binding}) var {name}: {textureType};
fn load{funcName}() -> {returnType} { return textureLoad({name}, splat.uv, 0); }
fn load{funcName}WithIndex(index: u32) -> {returnType} { return textureLoad({name}, vec2i(i32(index % uniforms.splatTextureSize), i32(index / uniforms.splatTextureSize)), 0); }
`;
