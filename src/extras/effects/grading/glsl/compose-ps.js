export default /* glsl */`
    uniform vec3 brightnessContrastSaturation;
    uniform vec3 gradingMixerRed;
    uniform vec3 gradingMixerGreen;
    uniform vec3 gradingMixerBlue;

    // for all parameters, 1.0 is the no-change value
    vec3 colorGradingHDR(vec3 color, float brt, float sat, float con) {
        // channel mixer, with the tint folded into its rows
        color = vec3(dot(gradingMixerRed, color), dot(gradingMixerGreen, color), dot(gradingMixerBlue, color));

        // brightness
        color = color * brt;

        // saturation
        float gray = dot(color, vec3(0.3, 0.59, 0.11));
        gray = gray / max(1.0, max(color.r, max(color.g, color.b)));    // Normalize luminance in HDR to preserve intensity
        color = mix(vec3(gray), color, sat);

        // contrast
        return mix(vec3(0.5), color, con);
    }

    vec3 applyGrading(vec3 color, vec2 uv) {
        return colorGradingHDR(color, 
            brightnessContrastSaturation.x, 
            brightnessContrastSaturation.z, 
            brightnessContrastSaturation.y);
    }
`;
