export default /* glsl */`
    #ifdef COLOR_ENHANCE
        uniform vec4 colorEnhanceParams; // x=shadows, y=highlights, z=vibrance, w=dehaze
        uniform float colorEnhanceMidtones;

        vec3 applyColorEnhance(vec3 color) {
            float maxChannel = max(color.r, max(color.g, color.b));
            float lum = dot(color, vec3(0.2126, 0.7152, 0.0722));

            // Shadows/Highlights - skip if both are zero (coherent branch, essentially free)
            // Uses exponential curve: pow(2, param) gives 0.5x at -1, 1x at 0, 2x at +1
            if (colorEnhanceParams.x != 0.0 || colorEnhanceParams.y != 0.0) {
                float logLum = log2(max(lum, 0.001)) / 10.0 + 0.5;
                logLum = clamp(logLum, 0.0, 1.0);

                float shadowWeight = pow(1.0 - logLum, 2.0);
                float highlightWeight = pow(logLum, 2.0);

                color *= pow(2.0, colorEnhanceParams.x * shadowWeight);
                color *= pow(2.0, colorEnhanceParams.y * highlightWeight);
            }

            // Midtones - localized exposure in log-luminance space
            if (colorEnhanceMidtones != 0.0) {
                const float pivot = 0.18;
                const float widthStops = 1.25;
                const float maxStops = 2.0;
                float y = max(dot(color, vec3(0.2126, 0.7152, 0.0722)), 1e-6);

                // 0 at pivot, +/-1 one stop away from pivot
                float d = log2(y / pivot);
                float w = exp(-(d * d) / (2.0 * widthStops * widthStops));
                float stops = colorEnhanceMidtones * maxStops * w;
                color *= exp2(stops);
            }

            // Vibrance - skip if zero (coherent branch)
            if (colorEnhanceParams.z != 0.0) {
                float minChannel = min(color.r, min(color.g, color.b));
                maxChannel = max(color.r, max(color.g, color.b));
                float sat = (maxChannel - minChannel) / max(maxChannel, 0.001);

                lum = dot(color, vec3(0.2126, 0.7152, 0.0722));
                float normalizedLum = lum / max(1.0, maxChannel);
                vec3 grey = vec3(normalizedLum) * maxChannel;

                float satBoost = colorEnhanceParams.z * (1.0 - sat);
                color = mix(grey, color, 1.0 + satBoost);
            }

            // Dehaze - skip if zero (coherent branch)
            // Based on dark channel prior: haze lifts the minimum RGB channel
            if (colorEnhanceParams.w != 0.0) {
                // Normalize to work in HDR
                maxChannel = max(color.r, max(color.g, color.b));
                float scale = max(1.0, maxChannel);
                vec3 normalized = color / scale;

                // Estimate transmission from dark channel (per-pixel approximation)
                float darkChannel = min(normalized.r, min(normalized.g, normalized.b));
                float atmosphericLight = 0.95;

                // transmission: 1 = clear, 0 = fully hazed
                // strength controls how aggressively we remove haze
                float t = 1.0 - colorEnhanceParams.w * darkChannel / atmosphericLight;
                t = max(t, 0.1); // prevent extreme amplification

                // Dehaze formula: J = (I - A) / t + A
                vec3 dehazed = (normalized - atmosphericLight) / t + atmosphericLight;

                // Restore HDR range
                color = dehazed * scale;
            }

            return max(vec3(0.0), color);
        }
    #endif
`;
