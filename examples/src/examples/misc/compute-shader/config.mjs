/**
 * @type {import('../../../../types.mjs').ExampleConfig}
 */
export default {
    WEBGPU_REQUIRED: true,
    HIDDEN: true,
    FILES: {
        'shader.wgsl': `
            @group(0) @binding(0) var outputTexture: texture_storage_2d<rgba8unorm, write>;

            @compute @workgroup_size(1, 1, 1)
            fn main(@builtin(global_invocation_id) global_id : vec3u) {
                let clearColor: vec4<f32> = vec4<f32>(0.5);
                textureStore(outputTexture, vec2<i32>(global_id.xy), clearColor);
            }
        `
    }
};
