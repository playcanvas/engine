export default /* wgsl */`
    #ifdef COLOR_LUT
        var colorLUT: texture_2d<f32>;
        var colorLUTSampler: sampler;
        uniform colorLUTParams: vec4f; // width, height, maxColor, intensity

        fn applyColorLUT(color: vec3f) -> vec3f {
            var c: vec3f = clamp(color, vec3f(0.0), vec3f(1.0));

            let width: f32 = uniform.colorLUTParams.x;
            let height: f32 = uniform.colorLUTParams.y;
            let maxColor: f32 = uniform.colorLUTParams.z;

            // Calculate blue axis slice
            let cell: f32 = c.b * maxColor;
            let cell_l: f32 = floor(cell);
            let cell_h: f32 = ceil(cell);

            // Half-texel offsets
            let half_px_x: f32 = 0.5 / width;
            let half_px_y: f32 = 0.5 / height;

            // Red and green offsets within a tile
            let r_offset: f32 = half_px_x + c.r / height * (maxColor / height);
            let g_offset: f32 = half_px_y + c.g * (maxColor / height);

            // texture coordinates for the two blue slices
            let uv_l: vec2f = vec2f(cell_l / height + r_offset, g_offset);
            let uv_h: vec2f = vec2f(cell_h / height + r_offset, g_offset);

            // Sample both and interpolate
            let color_l: vec3f = textureSampleLevel(colorLUT, colorLUTSampler, uv_l, 0.0).rgb;
            let color_h: vec3f = textureSampleLevel(colorLUT, colorLUTSampler, uv_h, 0.0).rgb;

            let lutColor: vec3f = mix(color_l, color_h, fract(cell));
            return mix(color, lutColor, uniform.colorLUTParams.w);
        }
    #endif
`;
