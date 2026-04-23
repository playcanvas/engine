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
    #ifndef CAMERAPLANES
        #define CAMERAPLANES
        uniform vec4 camera_params; // x: 1/far, y: far, z: near, w: isOrtho
    #endif
    vec4 getPickDepth() {
        float linearDepth;
        if (camera_params.w > 0.5) {
            linearDepth = gl_FragCoord.z;
        } else {
            float viewDist = 1.0 / gl_FragCoord.w;
            linearDepth = (viewDist - camera_params.z) / (camera_params.y - camera_params.z);
        }
        return float2uint(linearDepth);
    }
#endif
`;
