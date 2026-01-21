// Template for gsplat stream output - write function for MRT
// Placeholders: {funcName}, {returnType}, {index}
export default /* glsl */`
void write{funcName}({returnType} value) { pcFragColor{index} = value; }
`;
