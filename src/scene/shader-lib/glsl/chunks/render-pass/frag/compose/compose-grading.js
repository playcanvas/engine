export default /* glsl */`
    #ifdef GRADING
        uniform vec3 brightnessContrastSaturation;
        uniform vec3 tint;

        // for all parameters, 1.0 is the no-change value
        vec3 colorGradingHDR(vec3 color, float brt, float sat, float con) {
            // tint
            color *= tint;

            // brightness
            color = color * brt;

            // saturation
            float grey = dot(color, vec3(0.3, 0.59, 0.11));
            grey = grey / max(1.0, max(color.r, max(color.g, color.b)));    // Normalize luminance in HDR to preserve intensity
            color = mix(vec3(grey), color, sat);

            // contrast
            return mix(vec3(0.5), color, con);
        }

        vec3 applyGrading(vec3 color) {
            return colorGradingHDR(color, 
                brightnessContrastSaturation.x, 
                brightnessContrastSaturation.z, 
                brightnessContrastSaturation.y);
        }
    #endif
`;
