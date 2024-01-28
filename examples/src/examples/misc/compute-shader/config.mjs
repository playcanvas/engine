/**
 * @type {import('../../../../types.mjs').ExampleConfig}
 */
export default {
    WEBGPU_REQUIRED: true,
    HIDDEN: true,
    FILES: {
        'shader.wgsl': `
            @group(0) @binding(0) var inputTexture: texture_2d<f32>;
            // @binding(1) is a sampler of the inputTexture, but we don't need it in the shader.
            @group(0) @binding(2) var outputTexture: texture_storage_2d<rgba8unorm, write>;

            @compute @workgroup_size(1)
            fn main(@builtin(global_invocation_id) global_id : vec3u) {
                let position : vec2i = vec2i(global_id.xy);
                var color : vec4f = textureLoad(inputTexture, position, 0);

                color = vec4f(1.0) - color;

                textureStore(outputTexture, position, color);
            }
        `
    }
};
