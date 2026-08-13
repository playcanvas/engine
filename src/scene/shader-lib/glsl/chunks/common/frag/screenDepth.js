export default /* glsl */`
uniform highp sampler2D uSceneDepthMap;

#if defined(SCENE_DEPTHMAP_LINEAR) && defined(SCENE_DEPTHMAP_PACKED)
    #include "floatAsUintPS"
#endif

#ifndef SCREENSIZE
    #define SCREENSIZE
    uniform vec4 uScreenSize;
#endif

#ifndef VIEWMATRIX
    #define VIEWMATRIX
    uniform mat4 matrix_view;
#endif

#ifndef LINEARIZE_DEPTH
    #define LINEARIZE_DEPTH
    
    #ifndef CAMERAPLANES
        #define CAMERAPLANES
        uniform vec4 camera_params; // x: 1 / camera_far,      y: camera_far,     z: camera_near,        w: is_ortho
    #endif

    float linearizeDepth(float z) {
        if (camera_params.w == 0.0)
            return (camera_params.z * camera_params.y) / (camera_params.y + z * (camera_params.z - camera_params.y));
        else
            return camera_params.z + z * (camera_params.y - camera_params.z);
    }
#endif

float delinearizeDepth(float linearDepth) {
    if (camera_params.w == 0.0) {
        return (camera_params.y * (camera_params.z - linearDepth)) / (linearDepth * (camera_params.z - camera_params.y));
    } else {
        return (linearDepth - camera_params.z) / (camera_params.y - camera_params.z);
    }
}

// Retrieves rendered linear camera depth by UV
float getLinearScreenDepth(vec2 uv) {
    #ifdef SCENE_DEPTHMAP_LINEAR
        #ifdef SCENE_DEPTHMAP_PACKED

            // the depth is a float bit-packed into an RGBA8 texel, so it has to be read without
            // any filtering to keep the individual bytes intact
            ivec2 texel = ivec2(uv * vec2(textureSize(uSceneDepthMap, 0)));
            return uint2float(texelFetch(uSceneDepthMap, texel, 0));
        #else
            return texture2D(uSceneDepthMap, uv).r;
        #endif
    #else
        return linearizeDepth(texture2D(uSceneDepthMap, uv).r);
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
`;
