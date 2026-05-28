export default /* glsl */`
    #ifdef COLOR_LUT
        // LUT textures are fixed-size 256x16 "horizontal strip" 2D images representing
        // an unwrapped 16x16x16 3D LUT (Unreal format). The constants below derive from
        // N = 16 slices, N^2 = 256 strip width, allowing the lookup math to be folded
        // into compile-time literals.
        const float COLOR_LUT_N = 16.0;
        const float COLOR_LUT_W = 256.0;
        const float COLOR_LUT_MAX = COLOR_LUT_N - 1.0;         // 15.0
        const float COLOR_LUT_HALF_PX_X = 0.5 / COLOR_LUT_W;   // 1/512
        const float COLOR_LUT_HALF_PX_Y = 0.5 / COLOR_LUT_N;   // 1/32
        const float COLOR_LUT_R_SCALE = COLOR_LUT_MAX / COLOR_LUT_W; // (N-1)/N^2 = 15/256
        const float COLOR_LUT_G_SCALE = COLOR_LUT_MAX / COLOR_LUT_N; // (N-1)/N    = 15/16
        const float COLOR_LUT_SLICE = 1.0 / COLOR_LUT_N;       // 1/N

        // colorLUTParams.x: LUT1 intensity (0..1)
        // colorLUTParams.y: LUT2 intensity (0..1, only used when COLOR_LUT2 is set)
        // colorLUTParams.z: blend (0..1, only used when COLOR_LUT2 is set; 0 = only LUT1, 1 = only LUT2)
        uniform vec3 colorLUTParams;

        uniform sampler2D colorLUT;
        #ifdef COLOR_LUT2
            uniform sampler2D colorLUT2;
        #endif

        // 3D LUTs (Unreal-format unwrapped 2D strips) are authored in sRGB display space:
        // both the lookup coordinate and the stored value are sRGB-encoded. The compose
        // pipeline operates in linear space, so we convert the linear input to sRGB for the
        // lookup coordinate. The LUT texture is expected to be loaded in an sRGB pixel
        // format, so hardware sampling returns linear values directly, allowing the LUT
        // result to be blended with the linear input without an extra decode.
        vec3 sampleColorLUT(sampler2D lut, vec2 uv_l, vec2 uv_h, float t) {
            vec3 color_l = texture2DLod(lut, uv_l, 0.0).rgb;
            vec3 color_h = texture2DLod(lut, uv_h, 0.0).rgb;
            return mix(color_l, color_h, t);
        }

        vec3 applyColorLUT(vec3 color) {
            // Encode linear → sRGB for the lookup coordinate. The clamp keeps the lookup
            // inside the LUT for HDR inputs where the linear value can exceed 1.0.
            vec3 srgbCoord = pow(max(color, vec3(0.0)) + 0.0000001, vec3(1.0 / 2.2));
            vec3 c = clamp(srgbCoord, 0.0, 1.0);

            // Calculate blue axis slice
            float cell = c.b * COLOR_LUT_MAX;
            float cell_l = floor(cell);
            float cell_h = ceil(cell);
            float t = fract(cell);

            // Red and green offsets within a tile
            float r_offset = COLOR_LUT_HALF_PX_X + c.r * COLOR_LUT_R_SCALE;
            float g_offset = COLOR_LUT_HALF_PX_Y + c.g * COLOR_LUT_G_SCALE;

            // Texture coordinates for the two blue slices (shared between LUT1 and LUT2)
            vec2 uv_l = vec2(cell_l * COLOR_LUT_SLICE + r_offset, g_offset);
            vec2 uv_h = vec2(cell_h * COLOR_LUT_SLICE + r_offset, g_offset);

            // Sample LUT1. Textures are sRGB-formatted so the GPU returns linear values.
            vec3 lut1 = sampleColorLUT(colorLUT, uv_l, uv_h, t);

            #ifdef COLOR_LUT2
                // Sample LUT2 and crossfade graded results in linear space:
                //   A = mix(color, lut1, intensity1)
                //   B = mix(color, lut2, intensity2)
                //   O = mix(A, B, blend)
                // Folded form below avoids the intermediate A/B vectors.
                vec3 lut2 = sampleColorLUT(colorLUT2, uv_l, uv_h, t);
                float w1 = colorLUTParams.x * (1.0 - colorLUTParams.z);
                float w2 = colorLUTParams.y * colorLUTParams.z;
                return color + (lut1 - color) * w1 + (lut2 - color) * w2;
            #else
                return mix(color, lut1, colorLUTParams.x);
            #endif
        }
    #endif
`;
