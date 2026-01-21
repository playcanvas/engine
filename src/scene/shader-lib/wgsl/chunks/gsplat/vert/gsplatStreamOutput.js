// Template for gsplat stream output - write function for MRT
// Placeholders: {funcName}, {returnType}, {colorSlot}
// Note: {colorSlot} is 'color' for index 0, 'color1', 'color2', etc. for others
export default /* wgsl */`
fn write{funcName}(value: {returnType}) { processOutput.{colorSlot} = value; }
`;
