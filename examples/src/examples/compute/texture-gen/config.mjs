/**
 * @type {import('../../../../types.mjs').ExampleConfig}
 */
export default {
    HIDDEN: true,
    WEBGPU_REQUIRED: true,
    FILES: {
        'compute-shader.wgsl': /* wgsl */`
            @group(0) @binding(0) var inputTexture: texture_2d<f32>;
            // @group(0) @binding(1) is a sampler of the inputTexture, but we don't need it in the shader.
            @group(0) @binding(2) var outputTexture: texture_storage_2d<rgba8unorm, write>;

            // color used to tint the source texture
            const tintColor: vec4<f32> = vec4<f32>(1.0, 0.7, 0.7, 1.0);

            @compute @workgroup_size(1, 1, 1)
            fn main(@builtin(global_invocation_id) global_id : vec3u) {

                let uv = vec2i(global_id.xy);

                // load a color from the source texture
                var texColor = textureLoad(inputTexture, uv, 0);

                // tint it
                texColor *= tintColor;

                // write it to the output texture
                textureStore(outputTexture, vec2<i32>(global_id.xy), texColor);
            }
        `
    }
};
