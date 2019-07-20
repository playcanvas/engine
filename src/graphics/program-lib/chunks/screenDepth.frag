uniform sampler2D uDepthMap;

#ifndef SCREENSIZE
#define SCREENSIZE
uniform vec4 uScreenSize;
#endif

#ifndef VIEWMATRIX
#define VIEWMATRIX
uniform mat4 matrix_view;
#endif

#ifndef CAMERAPLANES
#define CAMERAPLANES
uniform vec4 camera_params; // 1 / camera_far,      camera_far,     (1 - f / n) / 2,        (1 + f / n) / 2
#endif

#ifdef GL2
    float linearizeDepth(float z) {
        z = z * 2.0 - 1.0;
        return 1.0 / (camera_params.z * z + camera_params.w);
    }
#else
    #ifndef UNPACKFLOAT
    #define UNPACKFLOAT
    float unpackFloat(vec4 rgbaDepth) {
        const vec4 bitShift = vec4(1.0 / (256.0 * 256.0 * 256.0), 1.0 / (256.0 * 256.0), 1.0 / 256.0, 1.0);
        return dot(rgbaDepth, bitShift);
    }
    #endif
#endif

// Retrieves rendered linear camera depth by UV
float getLinearScreenDepth(vec2 uv) {
    #ifdef GL2
        return linearizeDepth(texture2D(uDepthMap, uv).r) * camera_params.y;
    #else
        return unpackFloat(texture2D(uDepthMap, uv)) * camera_params.y;
    #endif
}

#ifndef VERTEXSHADER
// Retrieves rendered linear camera depth under the current pixel
float getLinearScreenDepth() {
    vec2 uv = gl_FragCoord.xy * uScreenSize.zw;
    return getLinearScreenDepth(uv);
}
#endif

// Generates linear camera depth for the given world position
float getLinearDepth(vec3 pos) {
    return -(matrix_view * vec4(pos, 1.0)).z;
}
