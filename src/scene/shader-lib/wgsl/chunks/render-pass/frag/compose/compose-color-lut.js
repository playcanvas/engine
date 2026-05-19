export default /* wgsl */`
    #ifdef COLOR_LUT
        // LUT textures are fixed-size 256x16 "horizontal strip" 2D images representing
        // an unwrapped 16x16x16 3D LUT (Unreal format). The constants below derive from
        // N = 16 slices, N^2 = 256 strip width, allowing the lookup math to be folded
        // into compile-time literals.
        const COLOR_LUT_N: f32 = 16.0;
        const COLOR_LUT_W: f32 = 256.0;
        const COLOR_LUT_MAX: f32 = COLOR_LUT_N - 1.0;         // 15.0
        const COLOR_LUT_HALF_PX_X: f32 = 0.5 / COLOR_LUT_W;   // 1/512
        const COLOR_LUT_HALF_PX_Y: f32 = 0.5 / COLOR_LUT_N;   // 1/32
        const COLOR_LUT_R_SCALE: f32 = COLOR_LUT_MAX / COLOR_LUT_W; // (N-1)/N^2 = 15/256
        const COLOR_LUT_G_SCALE: f32 = COLOR_LUT_MAX / COLOR_LUT_N; // (N-1)/N    = 15/16
        const COLOR_LUT_SLICE: f32 = 1.0 / COLOR_LUT_N;       // 1/N

        // colorLUTParams.x: LUT1 intensity (0..1)
        // colorLUTParams.y: LUT2 intensity (0..1, only used when COLOR_LUT2 is set)
        // colorLUTParams.z: blend (0..1, only used when COLOR_LUT2 is set; 0 = only LUT1, 1 = only LUT2)
        uniform colorLUTParams: vec3f;

        var colorLUT: texture_2d<f32>;
        var colorLUTSampler: sampler;
        #ifdef COLOR_LUT2
            var colorLUT2: texture_2d<f32>;
            var colorLUT2Sampler: sampler;
        #endif

        // 3D LUTs (Unreal-format unwrapped 2D strips) are authored in sRGB display space:
        // both the lookup coordinate and the stored value are sRGB-encoded. The compose
        // pipeline operates in linear space, so we convert the linear input to sRGB for the
        // lookup coordinate. The LUT texture is expected to be loaded in an sRGB pixel
        // format, so hardware sampling returns linear values directly, allowing the LUT
        // result to be blended with the linear input without an extra decode.
        fn sampleColorLUT(lut: texture_2d<f32>, lutSampler: sampler, uv_l: vec2f, uv_h: vec2f, t: f32) -> vec3f {
            let color_l: vec3f = textureSampleLevel(lut, lutSampler, uv_l, 0.0).rgb;
            let color_h: vec3f = textureSampleLevel(lut, lutSampler, uv_h, 0.0).rgb;
            return mix(color_l, color_h, vec3f(t));
        }

        fn applyColorLUT(color: vec3f) -> vec3f {
            // Encode linear → sRGB for the lookup coordinate. The clamp keeps the lookup
            // inside the LUT for HDR inputs where the linear value can exceed 1.0.
            let srgbCoord: vec3f = pow(max(color, vec3f(0.0)) + vec3f(0.0000001), vec3f(1.0 / 2.2));
            let c: vec3f = clamp(srgbCoord, vec3f(0.0), vec3f(1.0));

            // Calculate blue axis slice
            let cell: f32 = c.b * COLOR_LUT_MAX;
            let cell_l: f32 = floor(cell);
            let cell_h: f32 = ceil(cell);
            let t: f32 = fract(cell);

            // Red and green offsets within a tile
            let r_offset: f32 = COLOR_LUT_HALF_PX_X + c.r * COLOR_LUT_R_SCALE;
            let g_offset: f32 = COLOR_LUT_HALF_PX_Y + c.g * COLOR_LUT_G_SCALE;

            // Texture coordinates for the two blue slices (shared between LUT1 and LUT2)
            let uv_l: vec2f = vec2f(cell_l * COLOR_LUT_SLICE + r_offset, g_offset);
            let uv_h: vec2f = vec2f(cell_h * COLOR_LUT_SLICE + r_offset, g_offset);

            // Sample LUT1. Textures are sRGB-formatted so the GPU returns linear values.
            let lut1: vec3f = sampleColorLUT(colorLUT, colorLUTSampler, uv_l, uv_h, t);

            #ifdef COLOR_LUT2
                // Sample LUT2 and crossfade graded results in linear space:
                //   A = mix(color, lut1, intensity1)
                //   B = mix(color, lut2, intensity2)
                //   O = mix(A, B, blend)
                // Folded form below avoids the intermediate A/B vectors.
                let lut2: vec3f = sampleColorLUT(colorLUT2, colorLUT2Sampler, uv_l, uv_h, t);
                let w1: f32 = uniform.colorLUTParams.x * (1.0 - uniform.colorLUTParams.z);
                let w2: f32 = uniform.colorLUTParams.y * uniform.colorLUTParams.z;
                return color + (lut1 - color) * w1 + (lut2 - color) * w2;
            #else
                return mix(color, lut1, vec3f(uniform.colorLUTParams.x));
            #endif
        }
    #endif
`;
