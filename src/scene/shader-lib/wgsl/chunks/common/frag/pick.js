export default /* wgsl */`
fn encodePickOutput(id: u32) -> vec4f {
    let inv: vec4f = vec4f(1.0 / 255.0);
    let shifts: vec4u = vec4u(16u, 8u, 0u, 24u);
    let col: vec4u = (vec4u(id) >> shifts) & vec4u(0xffu);
    return vec4f(col) * inv;
}

#ifndef PICK_CUSTOM_ID
    uniform meshInstanceId: u32;

    fn getPickOutput() -> vec4f {
        return encodePickOutput(uniform.meshInstanceId);
    }
#endif

#ifdef DEPTH_PICK_PASS
    #include "floatAsUintPS"

    fn getPickDepth() -> vec4f {
        return float2uint(pcPosition.z);
    }
#endif
`;
