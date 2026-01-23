// Template for gsplat stream output - write function for MRT
// Placeholders: {funcName}, {returnType}, {colorSlot}, {defineGuard}
// Note: {colorSlot} is 'color' for index 0, 'color1', 'color2', etc. for others
// {defineGuard} is 1 for real output, 0 for no-op stub
export default /* wgsl */`
fn write{funcName}(value: {returnType}) {
#if {defineGuard}
    processOutput.{colorSlot} = value;
#endif
}
`;
