// Template for gsplat stream declaration - var and load function
// Placeholders: {name}, {textureType}, {returnType}, {funcName}
export default /* wgsl */`
var {name}: {textureType};
fn load{funcName}() -> {returnType} { return textureLoad({name}, splat.uv, 0); }
fn load{funcName}WithIndex(index: u32) -> {returnType} { return textureLoad({name}, vec2i(i32(index % uniform.splatTextureSize), i32(index / uniform.splatTextureSize)), 0); }
`;
