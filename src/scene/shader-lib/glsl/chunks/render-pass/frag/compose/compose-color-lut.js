export default /* glsl */`
    #ifdef COLOR_LUT
        uniform sampler2D colorLUT;
        uniform vec4 colorLUTParams; // width, height, maxColor, intensity

        // 3D LUTs (Unreal-format unwrapped 2D strips) are authored in sRGB display space:
        // both the lookup coordinate and the stored value are sRGB-encoded. The compose
        // pipeline operates in linear space, so we convert the linear input to sRGB for the
        // lookup coordinate. The LUT texture is expected to be loaded in an sRGB pixel
        // format, so hardware sampling returns linear values directly, allowing the LUT
        // result to be blended with the linear input without an extra decode.
        vec3 applyColorLUT(vec3 color) {
            // Encode linear → sRGB for the lookup coordinate. The clamp keeps the lookup
            // inside the LUT for HDR inputs where the linear value can exceed 1.0.
            vec3 srgbCoord = pow(max(color, vec3(0.0)) + 0.0000001, vec3(1.0 / 2.2));
            vec3 c = clamp(srgbCoord, 0.0, 1.0);

            float width = colorLUTParams.x;
            float height = colorLUTParams.y;
            float maxColor = colorLUTParams.z;

            // Calculate blue axis slice
            float cell = c.b * maxColor;
            float cell_l = floor(cell);
            float cell_h = ceil(cell);

            // Half-texel offsets
            float half_px_x = 0.5 / width;
            float half_px_y = 0.5 / height;

            // Red and green offsets within a tile
            float r_offset = half_px_x + c.r / height * (maxColor / height);
            float g_offset = half_px_y + c.g * (maxColor / height);

            // texture coordinates for the two blue slices
            vec2 uv_l = vec2(cell_l / height + r_offset, g_offset);
            vec2 uv_h = vec2(cell_h / height + r_offset, g_offset);

            // Sample both and interpolate. Texture is sRGB-formatted so the GPU returns
            // linear values directly.
            vec3 color_l = texture2DLod(colorLUT, uv_l, 0.0).rgb;
            vec3 color_h = texture2DLod(colorLUT, uv_h, 0.0).rgb;

            vec3 lutColor = mix(color_l, color_h, fract(cell));

            // Blend pre-LUT and post-LUT in linear space.
            return mix(color, lutColor, colorLUTParams.w);
        }
    #endif
`;
