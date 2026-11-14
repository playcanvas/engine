export default /* wgsl */`
    uniform brightnessContrastSaturation: vec3f;
    uniform gradingMixerRed: vec3f;
    uniform gradingMixerGreen: vec3f;
    uniform gradingMixerBlue: vec3f;

    // for all parameters, 1.0 is the no-change value
    fn colorGradingHDR(color: vec3f, brt: f32, sat: f32, con: f32) -> vec3f {
        // channel mixer, with the tint folded into its rows
        var colorOut = vec3f(
            dot(uniform.gradingMixerRed, color),
            dot(uniform.gradingMixerGreen, color),
            dot(uniform.gradingMixerBlue, color)
        );

        // brightness
        colorOut = colorOut * brt;

        // saturation
        let gray = dot(colorOut, vec3f(0.3, 0.59, 0.11));
        let normalizedGray = gray / max(1.0, max(colorOut.r, max(colorOut.g, colorOut.b)));    // Normalize luminance in HDR to preserve intensity
        colorOut = mix(vec3f(normalizedGray), colorOut, sat);

        // contrast
        return mix(vec3f(0.5), colorOut, con);
    }

    fn applyGrading(color: vec3f, uv: vec2f) -> vec3f {
        return colorGradingHDR(color, 
            uniform.brightnessContrastSaturation.x, 
            uniform.brightnessContrastSaturation.z, 
            uniform.brightnessContrastSaturation.y);
    }
`;
