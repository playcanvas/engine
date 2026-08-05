export default /* wgsl */`

var uSceneDepthMap: texture_2d<uff>;

#ifndef SCREENSIZE
    #define SCREENSIZE
    uniform uScreenSize: vec4f;
#endif

#ifndef VIEWMATRIX
    #define VIEWMATRIX
    uniform matrix_view: mat4x4f;
#endif

#ifndef LINEARIZE_DEPTH
    #define LINEARIZE_DEPTH

    #ifndef CAMERAPLANES
        #define CAMERAPLANES
        uniform camera_params: vec4f; // x: 1 / camera_far,      y: camera_far,     z: camera_near,        w: is_ortho
    #endif

    fn linearizeDepth(z: f32) -> f32 {
        if (uniform.camera_params.w == 0.0) { // Perspective
            return (uniform.camera_params.z * uniform.camera_params.y) / (uniform.camera_params.y + z * (uniform.camera_params.z - uniform.camera_params.y));
        } else {
            return uniform.camera_params.z + z * (uniform.camera_params.y - uniform.camera_params.z);
        }
    }
#endif

fn delinearizeDepth(linearDepth: f32) -> f32 {
    if (uniform.camera_params.w == 0.0) {
        return (uniform.camera_params.y * (uniform.camera_params.z - linearDepth)) / (linearDepth * (uniform.camera_params.z - uniform.camera_params.y));
    } else {
        return (linearDepth - uniform.camera_params.z) / (uniform.camera_params.y - uniform.camera_params.z);
    }
}

// Retrieves rendered linear camera depth by UV
fn getLinearScreenDepth(uv: vec2f) -> f32 {
    let textureSize = textureDimensions(uSceneDepthMap, 0);
    let texel: vec2i = vec2i(uv * vec2f(textureSize));

    #ifdef SCENE_DEPTHMAP_LINEAR
        return textureLoad(uSceneDepthMap, texel, 0).r;
    #else
        return linearizeDepth(textureLoad(uSceneDepthMap, texel, 0).r);
    #endif
}

#ifndef VERTEXSHADER
    // Retrieves rendered linear camera depth under the current pixel
    fn getLinearScreenDepthFrag() -> f32 {
        let uv: vec2f = pcPosition.xy * uniform.uScreenSize.zw;
        return getLinearScreenDepth(uv);
    }
#endif

// Generates linear camera depth for the given world position
fn getLinearDepth(pos: vec3f) -> f32 {
    return -(uniform.matrix_view * vec4f(pos, 1.0)).z;
}
`;
