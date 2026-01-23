// Template for gsplat stream output - write function for MRT
// Placeholders: {funcName}, {returnType}, {index}, {defineGuard}
// {defineGuard} is 1 for real output, 0 for no-op stub
export default /* glsl */`
void write{funcName}({returnType} value) {
#if {defineGuard}
    pcFragColor{index} = value;
#endif
}
`;
