export default /* glsl */`
vec4 encodePickOutput(uint id) {
    const vec4 inv = vec4(1.0 / 255.0);
    const uvec4 shifts = uvec4(16, 8, 0, 24);
    uvec4 col = (uvec4(id) >> shifts) & uvec4(0xff);
    return vec4(col) * inv;
}

#ifndef PICK_CUSTOM_ID
    uniform uint meshInstanceId;

    vec4 getPickOutput() {
        return encodePickOutput(meshInstanceId);
    }
#endif

#ifdef DEPTH_PICK_PASS
    #include "floatAsUintPS"

    vec4 getPickDepth() {
        return float2uint(gl_FragCoord.z);
    }
#endif
`;
