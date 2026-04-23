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
    #ifndef CAMERAPLANES
        #define CAMERAPLANES
        uniform camera_params: vec4f; // x: 1/far, y: far, z: near, w: isOrtho
    #endif
    fn getPickDepth() -> vec4f {
        var linearDepth: f32;
        if (uniform.camera_params.w > 0.5) {
            linearDepth = pcPosition.z;
        } else {
            let viewDist = 1.0 / pcPosition.w;
            linearDepth = (viewDist - uniform.camera_params.z) / (uniform.camera_params.y - uniform.camera_params.z);
        }
        return float2uint(linearDepth);
    }
#endif
`;
