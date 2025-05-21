export default /* wgsl */`
fn getOutput() -> vec4f {
    if (pcPosition.y < 1.0) {
        return vec4f(outPos, (outAngle + 1000.0) * visMode);
    } else {
        return vec4f(outVel, outLife);
    }
}
`;
