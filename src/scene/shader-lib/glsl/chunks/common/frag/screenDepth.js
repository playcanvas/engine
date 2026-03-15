export default /* glsl */`
uniform highp sampler2D uSceneDepthMap;

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
        #ifdef SCENE_DEPTHMAP_FLOAT
            return texture2D(uSceneDepthMap, uv).r;
        #else

            ivec2 textureSize = textureSize(uSceneDepthMap, 0);
            ivec2 texel = ivec2(uv * vec2(textureSize));
            vec4 data = texelFetch(uSceneDepthMap, texel, 0);

            uint intBits = 
                (uint(data.r * 255.0) << 24u) |
                (uint(data.g * 255.0) << 16u) |
                (uint(data.b * 255.0) << 8u) |
                uint(data.a * 255.0);

            return uintBitsToFloat(intBits);
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
