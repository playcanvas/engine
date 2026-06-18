export default /* glsl */`
// Writes particle state to the state texture. The fragment output type (vec4 / uvec4) is set via
// fragmentOutputTypes to match the texture format; when not float-renderable the floats are
// reinterpreted to their uint bit patterns (RGBA32U), which is lossless.
void writeOutput() {
    vec4 row = gl_FragCoord.y < 1.0 ?
        vec4(outPos, (outAngle + 1000.0) * visMode) :
        vec4(outVel, outLife);

    #ifdef CAPS_TEXTURE_FLOAT_RENDERABLE
        gl_FragColor = row;
    #else
        gl_FragColor = floatBitsToUint(row);
    #endif
}
`;
