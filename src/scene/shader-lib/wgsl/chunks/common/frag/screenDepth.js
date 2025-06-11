export default /* wgsl */`

var uSceneDepthMap: texture_2d<f32>;
var uSceneDepthMapSampler: sampler;

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
    #ifdef SCENE_DEPTHMAP_LINEAR
        #ifdef SCENE_DEPTHMAP_FLOAT
            return textureSample(uSceneDepthMap, uSceneDepthMapSampler, uv).r;
        #else

            let textureSize = textureDimensions(uSceneDepthMap, 0);
            let texel: vec2i = vec2i(uv * vec2f(textureSize));
            let data: vec4f = textureLoad(uSceneDepthMap, texel, 0);

            let data_u32: vec4u = vec4u(data * 255.0);
            let intBits: u32 = (data_u32.r << 24u) | (data_u32.g << 16u) | (data_u32.b << 8u) | data_u32.a;

            return bitcast<f32>(intBits);

        #endif
    #else
        return linearizeDepth(textureSample(uSceneDepthMap, uSceneDepthMapSampler, uv).r);
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
