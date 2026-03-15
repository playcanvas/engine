export default /* wgsl */`
    #ifdef GRADING
        uniform brightnessContrastSaturation: vec3f;
        uniform tint: vec3f;

        // for all parameters, 1.0 is the no-change value
        fn colorGradingHDR(color: vec3f, brt: f32, sat: f32, con: f32) -> vec3f {
            // tint
            var colorOut = color * uniform.tint;

            // brightness
            colorOut = colorOut * brt;

            // saturation
            let grey = dot(colorOut, vec3f(0.3, 0.59, 0.11));
            let normalizedGrey = grey / max(1.0, max(colorOut.r, max(colorOut.g, colorOut.b)));    // Normalize luminance in HDR to preserve intensity
            colorOut = mix(vec3f(normalizedGrey), colorOut, sat);

            // contrast
            return mix(vec3f(0.5), colorOut, con);
        }

        fn applyGrading(color: vec3f) -> vec3f {
            return colorGradingHDR(color, 
                uniform.brightnessContrastSaturation.x, 
                uniform.brightnessContrastSaturation.z, 
                uniform.brightnessContrastSaturation.y);
        }
    #endif
`;
