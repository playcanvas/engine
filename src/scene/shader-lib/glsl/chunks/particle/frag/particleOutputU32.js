export default /* glsl */`
// Writes particle state to an RGBA32U integer texture, storing exact float bits.
// Used as the fallback when float textures are not renderable. The fragment output
// type is set to uvec4 via fragmentOutputTypes. The layout matches particleOutputFloat.
void writeOutput() {
    if (gl_FragCoord.y < 1.0) {
        gl_FragColor = uvec4(floatBitsToUint(outPos), floatBitsToUint((outAngle + 1000.0) * visMode));
    } else {
        gl_FragColor = uvec4(floatBitsToUint(outVel), floatBitsToUint(outLife));
    }
}
`;
