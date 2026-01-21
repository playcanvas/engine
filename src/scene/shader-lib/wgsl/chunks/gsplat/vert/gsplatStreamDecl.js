// Template for gsplat stream declaration - var and load function
// Placeholders: {name}, {textureType}, {returnType}, {funcName}
export default /* wgsl */`
var {name}: {textureType};
fn load{funcName}() -> {returnType} { return textureLoad({name}, splatUV, 0); }
`;
