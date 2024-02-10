/**
 * @type {import('../../../../types.mjs').ExampleConfig}
 */
export default {
    WEBGPU_REQUIRED: true,
    HIDDEN: true,
    NO_MINISTATS: true,
    FILES: {
        'shader.wgsl': `
            @group(0) @binding(0) var inputTexture: texture_2d<f32>;
            // @group(0) @binding(1) is a sampler of the inputTexture, but we don't need it in the shader.
            @group(0) @binding(2) var<storage, read_write> inout: array<atomic<u32>>;

            @compute @workgroup_size(1)
            fn main(@builtin(global_invocation_id) global_id : vec3u) {
                let position = vec2i(global_id.xy);
                var color = textureLoad(inputTexture, position, 0).rgb;
                var input = vec3u(atomicLoad(&inout[0]), atomicLoad(&inout[1]), atomicLoad(&inout[2]));
                var compare = vec3f(input) / 255.0;

                atomicAdd(&inout[3], 1u);

                if (color.r >= compare.r && color.g >= compare.g && color.b >= compare.b) {
                    atomicAdd(&inout[4], 1u);
                }
            }
        `
    }
};
