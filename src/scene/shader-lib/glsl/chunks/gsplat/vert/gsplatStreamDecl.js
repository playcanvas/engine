// Template for gsplat stream declaration - uniform and load function
// Placeholders: {name}, {sampler}, {returnType}, {funcName}
export default /* glsl */`
uniform highp {sampler} {name};
{returnType} load{funcName}() { return texelFetch({name}, splatUV, 0); }
`;
